import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { vendors, glAccounts } from '@/db/schema';
import { DEMO_ORG } from '@/lib/demo';

export type NewBillVendor = { id: string; name: string; mono: string; defaultGl: string | null; terms: string };
export type NewBillGl = { id: string; code: string; name: string };
export type NewBillFormData = { vendors: NewBillVendor[]; glAccounts: NewBillGl[] };

// Vendors + chart of accounts for the manual "New bill" form dropdowns.
export async function getNewBillFormData(): Promise<NewBillFormData> {
  const vendorRows = await db
    .select({ id: vendors.id, name: vendors.name, mono: vendors.mono, defaultGl: vendors.defaultGl, terms: vendors.terms })
    .from(vendors)
    .where(and(eq(vendors.orgId, DEMO_ORG), eq(vendors.status, 'active')))
    .orderBy(asc(vendors.name));

  const glRows = await db
    .select({ id: glAccounts.id, code: glAccounts.code, name: glAccounts.name })
    .from(glAccounts)
    .where(eq(glAccounts.orgId, DEMO_ORG))
    .orderBy(asc(glAccounts.name));

  return { vendors: vendorRows, glAccounts: glRows };
}
