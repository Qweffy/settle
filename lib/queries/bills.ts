import { db } from '@/db';
import { bills, vendors, savedViews } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { DEMO_NOW } from '@/lib/demo';
import { getActiveOrg } from '@/lib/actions/session';
import { dueLabel, formatShortDate } from '@/lib/dates';
import { deriveDisplayStatus, type BillLifecycle } from '@/lib/status';
import type { BillRow, Tab, DueTone, SavedView } from '@/lib/data/bills';
import type { StatusKey } from '@/lib/data/shell';

export type BillsData = {
  tabs: Tab[];
  rows: BillRow[];
  vendorNames: string[];
  views: SavedView[];
};

// Which lifecycle buckets (tabs) a row belongs to. `all` always; `review`
// when it has open flags; the rest mirror the lifecycle status.
function tabsFor(status: StatusKey, hasOpenFlag: boolean): string[] {
  const t = ['all'];
  if (status === 'draft') t.push('draft');
  if (status === 'approval' || status === 'approved' || status === 'review' || status === 'dueSoon' || status === 'overdue') t.push('approval');
  if (status === 'scheduled') t.push('scheduled');
  if (status === 'paid') t.push('paid');
  if (hasOpenFlag) t.push('review');
  return t;
}

// The bottom hint under the due date. Paid/failed bills surface the payment
// date instead of a countdown; drafts without a due date say so.
function dueHintFor(
  status: StatusKey,
  due: Date | null,
  paidAt: Date | null,
  failedAt: Date | null,
  label: { text: string; tone: DueTone },
): { hint: string; tone: DueTone } {
  if (status === 'paid' && paidAt) return { hint: `paid ${formatShortDate(paidAt)}`, tone: 'none' };
  if (status === 'failed' && failedAt) return { hint: `failed ${formatShortDate(failedAt)}`, tone: 'overdue' };
  if (!due) return { hint: 'no due date', tone: 'none' };
  return { hint: label.text, tone: label.tone };
}

export async function getBillsData(): Promise<BillsData> {
  const now = DEMO_NOW;
  const org = await getActiveOrg();

  const [billRows, orgVendors, viewRows] = await Promise.all([
    db.query.bills.findMany({
      where: eq(bills.orgId, org),
      with: { vendor: true, flags: true, payments: true },
    }),
    db.select({ name: vendors.name }).from(vendors).where(eq(vendors.orgId, org)),
    db.select().from(savedViews).where(eq(savedViews.orgId, org)).orderBy(desc(savedViews.createdAt)),
  ]);

  const rows: BillRow[] = billRows.map((b) => {
    const openFlags = b.flags.filter((f) => f.status === 'open');
    const paymentFailed = b.payments.some((p) => p.status === 'failed');
    const failedPay = b.payments.find((p) => p.status === 'failed');

    const status = deriveDisplayStatus({
      status: b.status as BillLifecycle,
      reviewStatus: b.reviewStatus,
      dueDate: b.dueDate,
      paymentFailed,
      now,
    });

    const label = dueLabel(b.dueDate, now);
    const { hint, tone } = dueHintFor(status, b.dueDate, b.paidAt, failedPay?.payDate ?? null, label);

    return {
      id: b.id,
      vendor: b.vendor.name,
      mono: b.vendor.mono,
      inv: b.invoiceNumber,
      amount: b.totalCents / 100,
      due: b.dueDate ? formatShortDate(b.dueDate) : '—',
      dueHint: hint,
      dueTone: tone,
      status,
      gl: b.glAccount ?? '',
      flag: openFlags.length > 0 ? openFlags[0].title : null,
      tabs: tabsFor(status, openFlags.length > 0),
    };
  });

  const count = (tabId: string) =>
    tabId === 'all' ? rows.length : rows.filter((r) => r.tabs.includes(tabId)).length;

  const tabs: Tab[] = [
    { id: 'all', label: 'All', count: count('all') },
    { id: 'draft', label: 'Drafts', count: count('draft') },
    { id: 'approval', label: 'In approval', count: count('approval') },
    { id: 'scheduled', label: 'Scheduled', count: count('scheduled') },
    { id: 'paid', label: 'Paid', count: count('paid') },
    { id: 'review', label: 'Needs review', count: count('review') },
  ];

  return {
    tabs,
    rows,
    vendorNames: orgVendors.map((v) => v.name),
    views: viewRows.map((v) => ({ id: v.id, name: v.name, config: v.config })),
  };
}
