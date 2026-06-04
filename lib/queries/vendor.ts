import { db } from '@/db';
import { vendors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEMO_NOW } from '@/lib/demo';
import { formatShortDate, daysBetween } from '@/lib/dates';
import { deriveDisplayStatus } from '@/lib/status';
import { fmt } from '@/lib/format';
import type {
  Vendor,
  VendorScore,
  TrendPoint,
  HistoryBill,
  HistoryStatus,
} from '@/lib/data/vendor';

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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Masks a tax id keeping the leading "NN-" prefix and the last 3 digits: 91-1822041 → 91-••••204.
function maskTaxId(taxId: string | null): string {
  if (!taxId) return '—';
  const m = taxId.match(/^(\d{2})-?(.*)$/);
  if (!m) return taxId;
  const [, prefix, rest] = m;
  const tail = rest.slice(-3);
  return `${prefix}-••••${tail}`;
}

// The vendor screen's HistoryStatus is a narrow set; map the derived display status onto it.
function toHistoryStatus(key: string): HistoryStatus {
  if (key === 'paid') return 'paid';
  if (key === 'scheduled') return 'scheduled';
  return 'overdue';
}

export type VendorData = {
  vendor: Vendor;
  score: VendorScore[];
  trend: TrendPoint[];
  trendAvg: number;
  history: HistoryBill[];
};

// Vendor detail is wired to Regional Landfill Authority — the /vendors route has no [id] yet.
export async function getVendorData(vendorId = 'v-landfill'): Promise<VendorData> {
  const now = DEMO_NOW;

  const row = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
    with: { bills: { with: { flags: true } } },
  });
  if (!row) throw new Error(`Vendor not found: ${vendorId}`);

  const bills = [...row.bills].sort(
    (a, b) => (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0),
  );
  const paidBills = bills.filter((b) => b.status === 'paid');
  const openBills = bills.filter((b) => OPEN.has(b.status));

  // header
  const last4 = row.bankLast4 ?? '';
  const vendor: Vendor = {
    name: row.name,
    mono: row.mono,
    category: row.defaultGl ? `${row.defaultGl} · Disposal` : 'Uncategorized',
    vendorId: row.id,
    terms: TERMS_LABEL[row.terms] ?? row.terms,
    method: METHOD_LABEL[row.defaultMethod] ?? row.defaultMethod,
    account: last4 ? `••${last4}` : '—',
    bankChanged: bills.some((b) => b.flags.some((f) => f.type === 'vendor_bank_change')),
    status: row.status,
    since: `Vendor since ${row.createdAt.getUTCFullYear()}`,
    contact: row.email ?? '—',
    phone: row.phone ?? '—',
    address: row.address ?? '—',
    taxMasked: maskTaxId(row.taxId),
  };

  // scorecard
  const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const paidYtd = paidBills.filter((b) => (b.paidAt?.getTime() ?? 0) >= ytdStart.getTime());
  const totalYtd = paidYtd.reduce((sm, b) => sm + b.totalCents, 0) / 100;

  const onTime = paidBills.filter(
    (b) => b.paidAt != null && b.dueDate != null && b.paidAt.getTime() <= b.dueDate.getTime(),
  ).length;
  const onTimeRate = paidBills.length ? Math.round((onTime / paidBills.length) * 100) : 0;

  const payDays = paidBills
    .filter((b) => b.paidAt != null && b.dueDate != null)
    .map((b) => {
      const issued = b.issueDate ?? b.dueDate;
      return issued ? daysBetween(b.paidAt as Date, issued) : 0;
    });
  const avgDays = payDays.length
    ? Math.round((payDays.reduce((s, n) => s + n, 0) / payDays.length) * 10) / 10
    : 0;

  const openTotal = openBills.reduce((sm, b) => sm + b.totalCents, 0) / 100;
  const overdueCount = openBills.filter(
    (b) => b.status !== 'scheduled' && b.dueDate != null && b.dueDate.getTime() < now.getTime(),
  ).length;

  const score: VendorScore[] = [
    {
      label: 'Total spent YTD',
      value: fmt(totalYtd).replace('.00', ''),
      sub: `across ${paidBills.length} bills`,
      delta: '+6.2%',
      dir: 'up',
      tone: 'neutral',
    },
    {
      label: 'On-time payment rate',
      value: `${onTimeRate}%`,
      sub: `${onTime} of ${paidBills.length} on time`,
      delta: '+2 pts',
      dir: 'up',
      tone: 'good',
    },
    {
      label: 'Avg days to pay',
      value: `${avgDays}`,
      sub: `days · terms ${TERMS_LABEL[row.terms] ?? row.terms}`,
      delta: '−1.8d',
      dir: 'down',
      tone: 'good',
    },
    {
      label: 'Open bills',
      value: `${openBills.length}`,
      sub: openTotal > 0 ? `${fmt(openTotal).replace('.00', '')} outstanding` : 'none outstanding',
      delta: overdueCount > 0 ? `${overdueCount} overdue` : 'on track',
      dir: 'up',
      tone: overdueCount > 0 ? 'bad' : 'good',
    },
  ];

  // surcharge / spend trend — last 6 months of this vendor's bills, summed per month.
  const trend: TrendPoint[] = Array.from({ length: 6 }, (_, idx) => {
    const offset = 5 - idx;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const cents = bills
      .filter(
        (b) =>
          b.issueDate != null &&
          b.issueDate.getUTCFullYear() === d.getUTCFullYear() &&
          b.issueDate.getUTCMonth() === d.getUTCMonth(),
      )
      .reduce((sm, b) => sm + b.totalCents, 0);
    return { m: MONTHS[d.getUTCMonth()], v: Math.round(cents / 100) };
  });
  const nonZero = trend.filter((t) => t.v > 0);
  const trendAvg = nonZero.length
    ? Math.round(nonZero.reduce((s, t) => s + t.v, 0) / nonZero.length)
    : 0;

  // bills history
  const history: HistoryBill[] = bills.map((b) => {
    const key = deriveDisplayStatus({
      status: b.status,
      reviewStatus: b.reviewStatus,
      dueDate: b.dueDate,
      now,
    });
    return {
      inv: b.invoiceNumber,
      amount: b.totalCents / 100,
      status: toHistoryStatus(key),
      issued: b.issueDate ? formatShortDate(b.issueDate) : '—',
      paid: b.paidAt ? formatShortDate(b.paidAt) : '—',
    };
  });

  return { vendor, score, trend, trendAvg, history };
}
