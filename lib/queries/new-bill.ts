import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bills, vendors, glAccounts, allocationTemplates } from '@/db/schema';
import { getActiveOrg } from '@/lib/actions/session';

export type NewBillVendor = { id: string; name: string; mono: string; defaultGl: string | null; terms: string };
export type NewBillGl = { id: string; code: string; name: string };
export type AllocationTemplate = { id: string; name: string; vendorId: string | null; lines: { glLabel: string; percentBps: number }[] };
export type NewBillFormData = { vendors: NewBillVendor[]; glAccounts: NewBillGl[]; allocationTemplates: AllocationTemplate[] };

// Vendors + chart of accounts for the manual "New bill" form dropdowns.
export async function getNewBillFormData(): Promise<NewBillFormData> {
  const org = await getActiveOrg();
  const vendorRows = await db
    .select({ id: vendors.id, name: vendors.name, mono: vendors.mono, defaultGl: vendors.defaultGl, terms: vendors.terms })
    .from(vendors)
    .where(and(eq(vendors.orgId, org), eq(vendors.status, 'active')))
    .orderBy(asc(vendors.name));

  const glRows = await db
    .select({ id: glAccounts.id, code: glAccounts.code, name: glAccounts.name })
    .from(glAccounts)
    .where(eq(glAccounts.orgId, org))
    .orderBy(asc(glAccounts.name));

  const templateRows = await db
    .select({ id: allocationTemplates.id, name: allocationTemplates.name, vendorId: allocationTemplates.vendorId, lines: allocationTemplates.lines })
    .from(allocationTemplates)
    .where(eq(allocationTemplates.orgId, org))
    .orderBy(asc(allocationTemplates.name));

  return { vendors: vendorRows, glAccounts: glRows, allocationTemplates: templateRows };
}

export type BillFormInitialLine = {
  description: string;
  qty: string;
  unit: string;
  amount: string;
  glLabel: string;
  kind: 'expense' | 'item';
  splits: { glLabel: string; amount: string }[];
};

export type BillFormInitial = {
  vendorId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  memo: string;
  tax: string;
  lines: BillFormInitialLine[];
};

// Load an existing bill in the shape the BillForm consumes (for editing).
export async function getBillForEdit(billId: string): Promise<BillFormInitial | null> {
  const bill = await db.query.bills.findFirst({
    where: eq(bills.id, billId),
    with: { lineItems: { with: { splits: true } } },
  });
  if (!bill) return null;
  const toInputDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  const centsToStr = (c: number | null) => (c != null ? (c / 100).toString() : '');
  const ordered = [...bill.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    vendorId: bill.vendorId,
    invoiceNumber: bill.invoiceNumber,
    issueDate: toInputDate(bill.issueDate),
    dueDate: toInputDate(bill.dueDate),
    memo: bill.memo ?? '',
    tax: bill.taxCents ? (bill.taxCents / 100).toString() : '',
    lines: ordered.map((l) => ({
      description: l.description,
      qty: l.quantity != null ? l.quantity.toString() : '',
      unit: centsToStr(l.unitPriceCents),
      amount: centsToStr(l.amountCents),
      glLabel: l.glLabel ?? '',
      kind: l.kind,
      splits: l.splits.map((s) => ({ glLabel: s.glLabel, amount: centsToStr(s.amountCents) })),
    })),
  };
}
