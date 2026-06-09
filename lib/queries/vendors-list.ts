import { db } from '@/db';
import { getActiveOrg } from '@/lib/actions/session';

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: 'Due on receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};
const METHOD_LABEL: Record<string, string> = {
  ach: 'ACH',
  check: 'Check',
  wire: 'Wire',
  card: 'Card',
};
const OPEN = new Set(['draft', 'pending_approval', 'approved', 'scheduled']);

export type VendorListItem = {
  id: string;
  name: string;
  mono: string;
  category: string;
  termsLabel: string;
  methodLabel: string;
  status: string;
  billCount: number;
  openCount: number;
  outstanding: number;
  ytdSpend: number;
  bankChanged: boolean;
};

// All vendors for the demo org with rolled-up bill metrics, for the /vendors list.
export async function getVendorsList(): Promise<VendorListItem[]> {
  const org = await getActiveOrg();
  const rows = await db.query.vendors.findMany({
    with: { bills: { with: { flags: true } } },
  });

  return rows
    .filter((row) => row.orgId === org)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => {
      const openBills = row.bills.filter((b) => OPEN.has(b.status));
      const paidBills = row.bills.filter((b) => b.status === 'paid');
      const outstanding = openBills.reduce((sum, b) => sum + b.totalCents, 0) / 100;
      const ytdSpend = paidBills.reduce((sum, b) => sum + b.totalCents, 0) / 100;
      return {
        id: row.id,
        name: row.name,
        mono: row.mono,
        category: row.defaultGl ?? 'Uncategorized',
        termsLabel: TERMS_LABEL[row.terms] ?? row.terms,
        methodLabel: METHOD_LABEL[row.defaultMethod] ?? row.defaultMethod,
        status: row.status,
        billCount: row.bills.length,
        openCount: openBills.length,
        outstanding,
        ytdSpend,
        bankChanged: row.bills.some((b) => b.flags.some((f) => f.type === 'vendor_bank_change')),
      };
    });
}

export type VendorFormInitial = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  terms: string;
  defaultMethod: string;
  bankLast4: string;
  defaultGl: string;
};

// Load a vendor's editable fields in the shape VendorForm consumes ('' for nulls).
export async function getVendorForEdit(vendorId: string): Promise<VendorFormInitial | null> {
  const row = await db.query.vendors.findFirst({
    where: (v, { eq }) => eq(v.id, vendorId),
  });
  if (!row) return null;
  return {
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    taxId: row.taxId ?? '',
    terms: row.terms,
    defaultMethod: row.defaultMethod,
    bankLast4: row.bankLast4 ?? '',
    defaultGl: row.defaultGl ?? '',
  };
}
