'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bills, approvalEvents, payments, activityLog, billComments, billFlags, billLineItems, vendors } from '@/db/schema';
import { assertTransition, type BillLifecycle } from '@/lib/status';
import type { OcrExtraction, OcrFlag } from '@/lib/ocr';
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
  const [b] = await db.select().from(bills).where(eq(bills.id, billId));
  if (!b) throw new Error(`Bill not found: ${billId}`);
  return b;
}

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

export async function approveBill(billId: string) {
  const b = await loadBill(billId);
  assertTransition(b.status as BillLifecycle, 'approved');
  const actor = await getCurrentUserId();
  await db.update(bills).set({ status: 'approved', approvedBy: actor, approvedAt: new Date(), updatedAt: new Date() }).where(eq(bills.id, billId));
  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'approve' });
  await logActivity(b.orgId, billId, actor, 'approved', 'approved', b.totalCents);
  revalidateAll();
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

export async function addComment(billId: string, body: string, mentions: string[] = []) {
  const b = await loadBill(billId);
  const actor = await getCurrentUserId();
  await db.insert(billComments).values({ id: rid('cmt'), billId, authorId: actor, body, mentions });
  await logActivity(b.orgId, billId, actor, 'commented', 'commented on', null);
  revalidatePath('/bills/[id]', 'page');
  revalidatePath('/dashboard');
}

export async function resolveFlag(flagId: string, status: 'accepted' | 'dismissed') {
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
): Promise<string> {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);
  const actor = await getCurrentUserId();
  const billId = rid('b');
  const now = new Date();

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
    reviewStatus: flags.length > 0 ? 'flagged' : 'clean',
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
      flags.map((f) => ({
        id: rid('flag'),
        billId,
        type: f.type,
        severity: f.severity,
        title: f.title,
        message: f.message,
        lineRef: f.lineRef ?? null,
        status: 'open' as const,
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
};

// Persist a manually-entered bill (New bill form) and submit it for approval.
export async function createBill(input: {
  vendorId: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  memo: string | null;
  taxCents: number;
  lineItems: NewBillLine[];
}): Promise<string> {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId));
  if (!vendor) throw new Error(`Vendor not found: ${input.vendorId}`);
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
    await db.insert(billLineItems).values(
      input.lineItems.map((l, i) => ({
        id: rid('li'),
        billId,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        amountCents: l.amountCents,
        glLabel: l.glLabel,
        sortOrder: i,
      })),
    );
  }

  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'submit' });
  await logActivity(vendor.orgId, billId, actor, 'created', 'created this bill manually', totalCents);
  await logActivity(vendor.orgId, billId, actor, 'submitted', 'submitted for approval', null);
  revalidateAll();
  return billId;
}
