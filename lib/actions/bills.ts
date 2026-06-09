'use server';

import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bills, approvalEvents, payments, activityLog, billComments, billFlags, billLineItems, lineItemSplits, vendors, users } from '@/db/schema';
import { assertTransition, canTransition, isEditable, type BillLifecycle } from '@/lib/status';
import type { OcrExtraction, OcrFlag } from '@/lib/ocr';
import { DEMO_ORG } from '@/lib/demo';
import { requiredApproval, roleSatisfies, roleLabel } from '@/lib/approval-rules';
import { runAction, ActionError, type ActionResult } from '@/lib/result';
import {
  parseOrThrow,
  parseOrResult,
  idSchema,
  createBillSchema,
  updateBillSchema,
  schedulePaymentSchema,
  addCommentSchema,
  bulkAdvanceSchema,
  importBillsSchema,
} from '@/lib/validation';
import { getCurrentUserId } from './session';

type PaymentMethod = 'ach' | 'check' | 'wire' | 'card';

const rid = (p: string) => `${p}-${randomUUID()}`;

function revalidateAll() {
  for (const p of ['/dashboard', '/bills', '/approvals', '/payments', '/reports', '/vendors']) {
    revalidatePath(p);
  }
  revalidatePath('/bills/[id]', 'page');
}

async function loadBill(billId: string) {
  // Bound + trim the id before it reaches the query (defense in depth — Drizzle
  // already parameterizes `eq`, so this is validation, not injection defense).
  const id = parseOrThrow(idSchema, billId);
  const [b] = await db.select().from(bills).where(eq(bills.id, id));
  if (!b) throw new Error(`Bill not found: ${id}`);
  return b;
}

// The role of whoever is currently acting (drives the approval gate). Falls back
// to 'clerk' — the least-privileged role — if the actor row can't be resolved.
async function loadActorRole(actorId: string): Promise<string> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorId));
  return u?.role ?? 'clerk';
}

// Friendly status labels for the duplicate-bill notice.
const DUPLICATE_STATUS_LABEL: Record<string, string> = {
  draft: 'draft',
  pending_approval: 'in approval',
  approved: 'approved',
  scheduled: 'scheduled',
  paid: 'paid',
  rejected: 'rejected',
  void: 'void',
};

async function logActivity(
  orgId: string,
  billId: string,
  actorId: string,
  type: string,
  text: string,
  amountCents: number | null,
  extra?: { target?: string; quote?: string; meta?: string },
) {
  await db.insert(activityLog).values({
    id: rid('act'),
    orgId,
    billId,
    actorId,
    type,
    text,
    amountCents,
    target: extra?.target ?? null,
    quote: extra?.quote ?? null,
    meta: extra?.meta ?? null,
  });
}

export async function submitBill(billId: string) {
  const b = await loadBill(billId);
  assertTransition(b.status as BillLifecycle, 'pending_approval');
  const actor = await getCurrentUserId();
  await db.update(bills).set({ status: 'pending_approval', submittedAt: new Date(), updatedAt: new Date() }).where(eq(bills.id, billId));
  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'submit' });
  await logActivity(b.orgId, billId, actor, 'submitted', 'submitted for approval', null);
  revalidateAll();
}

export async function approveBill(billId: string): Promise<ActionResult<void>> {
  return runAction("Couldn't approve this bill — please try again.", async () => {
    const b = await loadBill(billId);
    assertTransition(b.status as BillLifecycle, 'approved');
    const actor = await getCurrentUserId();
    // Approval-rules gate: large bills require a more senior role to sign off.
    // Thrown as an ActionError so the gate message surfaces verbatim (and
    // survives the prod build) instead of collapsing to the generic fallback.
    const gate = requiredApproval(b.totalCents);
    if (gate) {
      const actorRole = await loadActorRole(actor);
      if (!roleSatisfies(actorRole, gate.requiredRole)) {
        throw new ActionError(`This bill needs ${roleLabel(gate.requiredRole)} approval`);
      }
    }
    await db.update(bills).set({ status: 'approved', approvedBy: actor, approvedAt: new Date(), updatedAt: new Date() }).where(eq(bills.id, billId));
    await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'approve' });
    await logActivity(b.orgId, billId, actor, 'approved', 'approved', b.totalCents);
    revalidateAll();
  });
}

export async function rejectBill(billId: string, note?: string) {
  const b = await loadBill(billId);
  assertTransition(b.status as BillLifecycle, 'rejected');
  const actor = await getCurrentUserId();
  await db.update(bills).set({ status: 'rejected', updatedAt: new Date() }).where(eq(bills.id, billId));
  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'reject', note: note ?? null });
  await logActivity(b.orgId, billId, actor, 'rejected', 'rejected', null);
  revalidateAll();
}

// Find a prior bill from the same vendor with the same invoice number — used by
// the bill form to warn (non-blocking) about a likely duplicate before submit.
// Matches within the demo org, trims invoice numbers on both sides, and ignores
// the bill being edited.
export async function checkDuplicate(
  vendorId: string,
  invoiceNumber: string,
  excludeBillId?: string,
): Promise<{ id: string; invoiceNumber: string; amount: number; statusLabel: string } | null> {
  const target = invoiceNumber.trim();
  if (vendorId === '' || target === '') return null;

  const candidates = await db
    .select({
      id: bills.id,
      invoiceNumber: bills.invoiceNumber,
      totalCents: bills.totalCents,
      status: bills.status,
    })
    .from(bills)
    .where(and(eq(bills.orgId, DEMO_ORG), eq(bills.vendorId, vendorId)));

  const match = candidates.find(
    (c) => c.id !== excludeBillId && c.invoiceNumber.trim() === target,
  );
  if (!match) return null;

  return {
    id: match.id,
    invoiceNumber: match.invoiceNumber,
    amount: match.totalCents / 100,
    statusLabel: DUPLICATE_STATUS_LABEL[match.status] ?? match.status,
  };
}

export async function addComment(billId: string, body: string, mentions: string[] = []) {
  parseOrThrow(addCommentSchema, { billId, body, mentions });
  const b = await loadBill(billId);
  const actor = await getCurrentUserId();
  await db.insert(billComments).values({ id: rid('cmt'), billId, authorId: actor, body, mentions });
  await logActivity(b.orgId, billId, actor, 'commented', 'commented on', null);
  revalidatePath('/bills/[id]', 'page');
  revalidatePath('/dashboard');
}

export async function resolveFlag(flagId: string, status: 'accepted' | 'dismissed') {
  parseOrThrow(idSchema, flagId);
  const [flag] = await db.select().from(billFlags).where(eq(billFlags.id, flagId));
  if (!flag) throw new Error(`Flag not found: ${flagId}`);
  await db.update(billFlags).set({ status }).where(eq(billFlags.id, flagId));
  const all = await db.select().from(billFlags).where(eq(billFlags.billId, flag.billId));
  if (all.every((f) => f.status !== 'open')) {
    await db.update(bills).set({ reviewStatus: 'reviewed', updatedAt: new Date() }).where(eq(bills.id, flag.billId));
  }
  revalidateAll();
}

export async function schedulePayment(billId: string, method: PaymentMethod, payDate: string) {
  parseOrThrow(schedulePaymentSchema, { billId, method, payDate });
  const b = await loadBill(billId);
  assertTransition(b.status as BillLifecycle, 'scheduled');
  const actor = await getCurrentUserId();
  const when = new Date(payDate);
  await db.update(bills).set({ status: 'scheduled', scheduledPayDate: when, updatedAt: new Date() }).where(eq(bills.id, billId));
  await db.insert(payments).values({
    id: rid('pay'), billId, amountCents: b.totalCents, method, payDate: when,
    status: 'scheduled', referenceNumber: `${method.toUpperCase()}-${b.invoiceNumber}`, createdBy: actor,
  });
  await logActivity(b.orgId, billId, actor, 'scheduled', 'scheduled', b.totalCents);
  revalidateAll();
}

export async function markPaid(billId: string) {
  const b = await loadBill(billId);
  assertTransition(b.status as BillLifecycle, 'paid');
  const actor = await getCurrentUserId();
  await db.update(bills).set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() }).where(eq(bills.id, billId));
  await db.update(payments).set({ status: 'paid' }).where(eq(payments.billId, billId));
  await logActivity(b.orgId, billId, actor, 'paid', 'marked paid', b.totalCents);
  revalidateAll();
}

// Persist a reviewed OCR draft (from the Capture screen) as a real bill,
// submitted straight into the approval queue. Returns the new bill id so the
// client can route to its cockpit.
export async function createBillFromCapture(
  extraction: OcrExtraction,
  flags: OcrFlag[],
  vendorId: string,
  resolutions: Record<string, 'accept' | 'dismiss' | 'verify'> = {},
): Promise<string> {
  parseOrThrow(idSchema, vendorId);
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);
  const actor = await getCurrentUserId();
  const billId = rid('b');
  const now = new Date();

  // Capture-time triage carries onto the bill: accept → accepted, dismiss →
  // dismissed, verify (or untouched) stays open for the cockpit to resolve.
  // Flags map to ReviewFlag ids `f1..fN` by their order in `flags`.
  const flagStatusOf = (i: number): 'open' | 'accepted' | 'dismissed' => {
    const r = resolutions[`f${i + 1}`];
    return r === 'accept' ? 'accepted' : r === 'dismiss' ? 'dismissed' : 'open';
  };
  const openFlagCount = flags.filter((_, i) => flagStatusOf(i) === 'open').length;

  const toCents = (n: number) => Math.round(n * 100);
  const parseDate = (s: string): Date | null => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  await db.insert(bills).values({
    id: billId,
    orgId: vendor.orgId,
    vendorId: vendor.id,
    invoiceNumber: extraction.invoiceNumber,
    status: 'pending_approval',
    reviewStatus: flags.length === 0 ? 'clean' : openFlagCount > 0 ? 'flagged' : 'reviewed',
    ocrStatus: 'done',
    source: 'ocr',
    issueDate: parseDate(extraction.issueDate),
    dueDate: parseDate(extraction.dueDate),
    currency: extraction.currency || 'USD',
    subtotalCents: toCents(extraction.subtotal),
    taxCents: toCents(extraction.tax),
    totalCents: toCents(extraction.total),
    memo: `Captured from ${extraction.invoiceNumber} via OCR`,
    glAccount: extraction.lineItems[0]?.glGuess ?? vendor.defaultGl ?? null,
    createdBy: actor,
    submittedAt: now,
  });

  if (extraction.lineItems.length > 0) {
    await db.insert(billLineItems).values(
      extraction.lineItems.map((l, i) => ({
        id: rid('li'),
        billId,
        description: l.description,
        quantity: l.quantity != null ? Math.round(l.quantity) : null,
        unitPriceCents: l.unitPrice != null ? toCents(l.unitPrice) : null,
        amountCents: toCents(l.amount),
        glLabel: l.glGuess,
        sortOrder: i,
      })),
    );
  }

  if (flags.length > 0) {
    await db.insert(billFlags).values(
      flags.map((f, i) => ({
        id: rid('flag'),
        billId,
        type: f.type,
        severity: f.severity,
        title: f.title,
        message: f.message,
        lineRef: f.lineRef ?? null,
        status: flagStatusOf(i),
      })),
    );
  }

  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'submit' });
  await logActivity(vendor.orgId, billId, actor, 'created', 'created this bill from a captured invoice', toCents(extraction.total));
  await logActivity(vendor.orgId, billId, actor, 'submitted', 'submitted for approval', null);
  revalidateAll();
  return billId;
}

type NewBillLine = {
  description: string;
  quantity: number | null;
  unitPriceCents: number | null;
  amountCents: number;
  glLabel: string;
  kind?: 'expense' | 'item';
  splits?: { glLabel: string; amountCents: number }[];
};

// Persist each line's GL splits. The caller must pass the inserted line item's
// id; percentBps is the split's share of the line total, in basis points.
async function insertLineSplits(rows: { lineItemId: string; lineAmountCents: number; splits: { glLabel: string; amountCents: number }[] }[]) {
  const values = rows.flatMap(({ lineItemId, lineAmountCents, splits }) =>
    splits.map((s) => ({
      id: rid('split'),
      lineItemId,
      glLabel: s.glLabel,
      amountCents: s.amountCents,
      percentBps: lineAmountCents > 0 ? Math.round((s.amountCents / lineAmountCents) * 10000) : null,
    })),
  );
  if (values.length > 0) await db.insert(lineItemSplits).values(values);
}

// Persist a manually-entered bill (New bill form) and submit it for approval.
export async function createBill(input: {
  vendorId: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  memo: string | null;
  taxCents: number;
  lineItems: NewBillLine[];
}): Promise<ActionResult<string>> {
  const parsed = parseOrResult(createBillSchema, input);
  if (!parsed.ok) return parsed;
  return runAction("Couldn't save this bill — please try again.", async () => {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId));
    if (!vendor) throw new ActionError('Vendor not found.');
    const actor = await getCurrentUserId();
    const billId = rid('b');
    const now = new Date();

    const parseDate = (s: string | null): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const subtotalCents = input.lineItems.reduce((sum, l) => sum + l.amountCents, 0);
    const totalCents = subtotalCents + input.taxCents;

    await db.insert(bills).values({
      id: billId,
      orgId: vendor.orgId,
      vendorId: vendor.id,
      invoiceNumber: input.invoiceNumber,
      status: 'pending_approval',
      reviewStatus: 'clean',
      ocrStatus: 'none',
      source: 'manual',
      issueDate: parseDate(input.issueDate),
      dueDate: parseDate(input.dueDate),
      currency: 'USD',
      subtotalCents,
      taxCents: input.taxCents,
      totalCents,
      memo: input.memo,
      glAccount: input.lineItems[0]?.glLabel ?? vendor.defaultGl ?? null,
      createdBy: actor,
      submittedAt: now,
    });

    if (input.lineItems.length > 0) {
      const lineRows = input.lineItems.map((l, i) => ({
        id: rid('li'),
        billId,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        amountCents: l.amountCents,
        glLabel: l.glLabel,
        kind: l.kind ?? 'expense',
        sortOrder: i,
      }));
      await db.insert(billLineItems).values(lineRows);
      await insertLineSplits(
        input.lineItems
          .map((l, i) => ({ lineItemId: lineRows[i].id, lineAmountCents: l.amountCents, splits: l.splits ?? [] }))
          .filter((r) => r.splits.length > 0),
      );
    }

    await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'submit' });
    await logActivity(vendor.orgId, billId, actor, 'created', 'created this bill manually', totalCents);
    await logActivity(vendor.orgId, billId, actor, 'submitted', 'submitted for approval', null);
    revalidateAll();
    return billId;
  });
}

// Update an existing bill's fields + line items (from the Edit form).
export async function updateBill(
  billId: string,
  input: {
    vendorId: string;
    invoiceNumber: string;
    issueDate: string | null;
    dueDate: string | null;
    memo: string | null;
    taxCents: number;
    lineItems: NewBillLine[];
  },
): Promise<ActionResult<string>> {
  const parsed = parseOrResult(updateBillSchema, input);
  if (!parsed.ok) return parsed;
  return runAction("Couldn't save your changes — please try again.", async () => {
    const b = await loadBill(billId);
    // State guard: only pre-decision bills are editable. Past approval, editing
    // would silently invalidate an approval or a queued payment.
    if (!isEditable(b.status as BillLifecycle)) {
      throw new ActionError(`This bill can't be edited once it's ${DUPLICATE_STATUS_LABEL[b.status] ?? b.status}.`);
    }
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId));
    if (!vendor) throw new ActionError('Vendor not found.');
    const actor = await getCurrentUserId();

    const parseDate = (s: string | null): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const subtotalCents = input.lineItems.reduce((sum, l) => sum + l.amountCents, 0);
    const totalCents = subtotalCents + input.taxCents;

    await db
      .update(bills)
      .set({
        vendorId: vendor.id,
        invoiceNumber: input.invoiceNumber,
        issueDate: parseDate(input.issueDate),
        dueDate: parseDate(input.dueDate),
        memo: input.memo,
        taxCents: input.taxCents,
        subtotalCents,
        totalCents,
        glAccount: input.lineItems[0]?.glLabel ?? vendor.defaultGl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, billId));

    // Replace line items wholesale — simplest correct strategy for a small set.
    // Their splits cascade away on delete, so we just reinsert fresh below.
    await db.delete(billLineItems).where(eq(billLineItems.billId, billId));
    if (input.lineItems.length > 0) {
      const lineRows = input.lineItems.map((l, i) => ({
        id: rid('li'),
        billId,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        amountCents: l.amountCents,
        glLabel: l.glLabel,
        kind: l.kind ?? 'expense',
        sortOrder: i,
      }));
      await db.insert(billLineItems).values(lineRows);
      await insertLineSplits(
        input.lineItems
          .map((l, i) => ({ lineItemId: lineRows[i].id, lineAmountCents: l.amountCents, splits: l.splits ?? [] }))
          .filter((r) => r.splits.length > 0),
      );
    }

    await logActivity(b.orgId, billId, actor, 'edited', 'edited this bill', totalCents);
    revalidateAll();
    return billId;
  });
}

export type BulkAction = 'submit' | 'approve' | 'schedule' | 'pay';

// Each bulk action's target lifecycle status, so eligibility is checked against
// the state machine rather than a hardcoded status condition.
const BULK_TARGET: Record<BulkAction, BillLifecycle> = {
  submit: 'pending_approval',
  approve: 'approved',
  schedule: 'scheduled',
  pay: 'paid',
};

// Apply one lifecycle transition to many bills at once, skipping any that aren't
// eligible per ALLOWED_TRANSITIONS (plus the approval gate for 'approve').
// Returns how many advanced vs were skipped.
export async function bulkAdvance(ids: string[], action: BulkAction): Promise<{ done: number; skipped: number }> {
  const parsed = parseOrThrow(bulkAdvanceSchema, { ids, action });
  const actor = await getCurrentUserId();
  // Resolve the actor's role once — the approval gate applies to every bill in
  // an 'approve' batch, skipping any the actor isn't senior enough to sign off.
  const actorRole = parsed.action === 'approve' ? await loadActorRole(actor) : 'clerk';
  const now = new Date();
  const target = BULK_TARGET[parsed.action];
  let done = 0;
  let skipped = 0;

  for (const id of parsed.ids) {
    // Each bill advances independently — a single bad row (missing bill, transient
    // DB error) is counted as skipped and logged, never failing the whole batch.
    try {
      const b = await loadBill(id);
      // Eligibility is driven by the state machine (can't drift from
      // ALLOWED_TRANSITIONS); the approval gate is an extra predicate on 'approve'.
      const eligible =
        canTransition(b.status as BillLifecycle, target) &&
        (parsed.action !== 'approve' ||
          roleSatisfies(actorRole, requiredApproval(b.totalCents)?.requiredRole ?? 'approver'));
      if (!eligible) {
        skipped++;
        continue;
      }

      switch (parsed.action) {
        case 'submit':
          await db.update(bills).set({ status: 'pending_approval', submittedAt: now, updatedAt: now }).where(eq(bills.id, id));
          await db.insert(approvalEvents).values({ id: rid('appr'), billId: id, actorId: actor, action: 'submit' });
          await logActivity(b.orgId, id, actor, 'submitted', 'submitted for approval', null);
          break;
        case 'approve':
          await db.update(bills).set({ status: 'approved', approvedBy: actor, approvedAt: now, updatedAt: now }).where(eq(bills.id, id));
          await db.insert(approvalEvents).values({ id: rid('appr'), billId: id, actorId: actor, action: 'approve' });
          await logActivity(b.orgId, id, actor, 'approved', 'approved', b.totalCents);
          break;
        case 'schedule': {
          const when = new Date(now.getTime() + 5 * 86_400_000);
          const [vendor] = await db.select().from(vendors).where(eq(vendors.id, b.vendorId));
          const method = (vendor?.defaultMethod ?? 'ach') as PaymentMethod;
          await db.update(bills).set({ status: 'scheduled', scheduledPayDate: when, updatedAt: now }).where(eq(bills.id, id));
          await db.insert(payments).values({
            id: rid('pay'), billId: id, amountCents: b.totalCents, method, payDate: when,
            status: 'scheduled', referenceNumber: `${method.toUpperCase()}-${b.invoiceNumber}`, createdBy: actor,
          });
          await logActivity(b.orgId, id, actor, 'scheduled', 'scheduled', b.totalCents);
          break;
        }
        case 'pay':
          await db.update(bills).set({ status: 'paid', paidAt: now, updatedAt: now }).where(eq(bills.id, id));
          await db.update(payments).set({ status: 'paid' }).where(eq(payments.billId, id));
          await logActivity(b.orgId, id, actor, 'paid', 'marked paid', b.totalCents);
          break;
      }
      done++;
    } catch (e) {
      console.error(`[bulkAdvance] ${parsed.action} failed for ${id}:`, e);
      skipped++;
    }
  }

  revalidateAll();
  return { done, skipped };
}

export type ImportRow = {
  vendor: string;
  invoiceNumber: string;
  amount: number; // dollars
  dueDate: string | null;
  gl: string;
  description?: string;
};

// Bulk-create bills from a parsed CSV. Resolves each vendor by name within the
// demo org (case-insensitive) and creates a draft bill + a single line item, so
// imports land in the Drafts tab for review rather than straight into approval.
// Rows with an unknown vendor, blank invoice #, or non-positive amount are
// skipped. Returns how many were created vs skipped.
export async function importBills(rows: ImportRow[]): Promise<{ created: number; skipped: number }> {
  parseOrThrow(importBillsSchema, rows);
  const actor = await getCurrentUserId();
  const orgVendors = await db.select().from(vendors).where(eq(vendors.orgId, DEMO_ORG));
  const byName = new Map(orgVendors.map((v) => [v.name.trim().toLowerCase(), v]));

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // One unparseable/unwritable row never sinks the whole import — it's skipped
    // and logged so the rest of the file still lands in Drafts.
    try {
      const vendor = byName.get(row.vendor.trim().toLowerCase());
      const amountCents = Math.round(row.amount * 100);
      if (!vendor || row.invoiceNumber.trim() === '' || !Number.isFinite(amountCents) || amountCents <= 0) {
        skipped++;
        continue;
      }

      const billId = rid('b');
      const due = row.dueDate ? new Date(row.dueDate) : null;
      const gl = row.gl.trim() || vendor.defaultGl || null;

      await db.insert(bills).values({
        id: billId,
        orgId: vendor.orgId,
        vendorId: vendor.id,
        invoiceNumber: row.invoiceNumber.trim(),
        status: 'draft',
        reviewStatus: 'clean',
        ocrStatus: 'none',
        source: 'manual',
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        currency: 'USD',
        subtotalCents: amountCents,
        taxCents: 0,
        totalCents: amountCents,
        memo: 'Imported from CSV',
        glAccount: gl,
        createdBy: actor,
      });
      await db.insert(billLineItems).values({
        id: rid('li'),
        billId,
        description: row.description?.trim() || row.gl.trim() || 'Imported line item',
        amountCents,
        glLabel: gl,
        sortOrder: 0,
      });
      await logActivity(vendor.orgId, billId, actor, 'created', 'imported this bill from CSV', amountCents);
      created++;
    } catch (e) {
      console.error(`[importBills] failed to import "${row.invoiceNumber}":`, e);
      skipped++;
    }
  }

  revalidateAll();
  return { created, skipped };
}
