'use server';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  recurringBillTemplates,
  bills,
  billLineItems,
  approvalEvents,
  activityLog,
  vendors,
} from '@/db/schema';
import { getCurrentUserId } from './session';

const rid = (p: string) => `${p}-${randomUUID()}`;

// Advance a next-run date by one cadence, preserving the day-of-month where
// possible. Months/quarters use UTC calendar math; weekly is a flat +7 days.
function advance(from: Date, frequency: string): Date {
  const next = new Date(from);
  if (frequency === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (frequency === 'quarterly') {
    next.setUTCMonth(next.getUTCMonth() + 3);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

// Build the YYYYMM stamp (UTC) used in the generated invoice number.
function yyyymm(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Materialize a recurring schedule into a real bill, submitted straight into the
// approval queue, then roll the schedule forward to its next run. Returns the
// new bill id so the client can route to its cockpit.
export async function generateBillFromTemplate(templateId: string): Promise<string> {
  const [template] = await db
    .select()
    .from(recurringBillTemplates)
    .where(eq(recurringBillTemplates.id, templateId));
  if (!template) throw new Error(`Recurring template not found: ${templateId}`);

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, template.vendorId));
  if (!vendor) throw new Error(`Vendor not found: ${template.vendorId}`);

  const actor = await getCurrentUserId();
  const billId = rid('b');
  const now = new Date();
  const invoiceNumber = `${vendor.mono.toUpperCase()}-${yyyymm(template.nextRunDate)}`;

  await db.insert(bills).values({
    id: billId,
    orgId: template.orgId,
    vendorId: vendor.id,
    invoiceNumber,
    status: 'pending_approval',
    reviewStatus: 'clean',
    ocrStatus: 'none',
    source: 'email',
    issueDate: template.nextRunDate,
    dueDate: null,
    currency: 'USD',
    subtotalCents: template.amountCents,
    taxCents: 0,
    totalCents: template.amountCents,
    memo: `Recurring ${template.frequency} bill`,
    glAccount: template.glLabel,
    createdBy: actor,
    submittedAt: now,
  });

  await db.insert(billLineItems).values({
    id: rid('li'),
    billId,
    description: template.description,
    quantity: null,
    unitPriceCents: null,
    amountCents: template.amountCents,
    glLabel: template.glLabel,
    sortOrder: 0,
  });

  await db.insert(approvalEvents).values({ id: rid('appr'), billId, actorId: actor, action: 'submit' });
  await db.insert(activityLog).values({
    id: rid('act'),
    orgId: template.orgId,
    billId,
    actorId: actor,
    type: 'created',
    text: 'created this bill from a recurring schedule',
    amountCents: template.amountCents,
    target: null,
    quote: null,
    meta: null,
  });
  await db.insert(activityLog).values({
    id: rid('act'),
    orgId: template.orgId,
    billId,
    actorId: actor,
    type: 'submitted',
    text: 'submitted for approval',
    amountCents: null,
    target: null,
    quote: null,
    meta: null,
  });

  await db
    .update(recurringBillTemplates)
    .set({ nextRunDate: advance(template.nextRunDate, template.frequency), lastGeneratedAt: now })
    .where(eq(recurringBillTemplates.id, templateId));

  for (const p of ['/settings', '/bills', '/dashboard', '/approvals']) {
    revalidatePath(p);
  }
  revalidatePath('/bills/[id]', 'page');
  return billId;
}
