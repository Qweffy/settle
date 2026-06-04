'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bills, approvalEvents, payments, activityLog, billComments, billFlags } from '@/db/schema';
import { assertTransition, type BillLifecycle } from '@/lib/status';
import { getCurrentUserId } from './session';

type PaymentMethod = 'ach' | 'check' | 'wire' | 'card';

const rid = (p: string) => `${p}-${randomUUID()}`;

function revalidateAll() {
  for (const p of ['/dashboard', '/bills', '/bills/cockpit', '/approvals', '/payments', '/reports', '/vendors']) {
    revalidatePath(p);
  }
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
  revalidatePath('/bills/cockpit');
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
