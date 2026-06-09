import { db } from '@/db';
import { bills, vendors, users, activityLog } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { DEMO_NOW } from '@/lib/demo';
import { getActiveOrg } from '@/lib/actions/session';
import { timeAgo, formatShortDate } from '@/lib/dates';
import type {
  Score,
  ReviewItem,
  ExpectedItem,
  CashOutWeek,
  ActivityItem,
  ActivityType,
} from '@/lib/data/dashboard';

const DAY = 86_400_000;
const SEV_RANK: Record<string, number> = { high: 3, med: 2, low: 1 };
const OPEN = new Set(['draft', 'pending_approval', 'approved', 'scheduled']);

export type DashboardData = {
  score: Score[];
  review: ReviewItem[];
  expected: ExpectedItem[];
  cashout: CashOutWeek[];
  activity: ActivityItem[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = DEMO_NOW;
  const org = await getActiveOrg();

  const billRows = await db.query.bills.findMany({
    where: eq(bills.orgId, org),
    with: { vendor: true, flags: true },
  });
  const vendorRows = await db.query.vendors.findMany({
    where: eq(vendors.orgId, org),
    with: { bills: true },
  });
  const userRows = await db.select().from(users).where(eq(users.orgId, org));
  const acts = await db.query.activityLog.findMany({
    where: eq(activityLog.orgId, org),
    orderBy: desc(activityLog.createdAt),
    limit: 8,
  });

  const open = billRows.filter((b) => OPEN.has(b.status));
  const sumCents = (arr: typeof open) => arr.reduce((sm, b) => sm + b.totalCents, 0);

  const overdue = open.filter((b) => b.status !== 'scheduled' && b.dueDate != null && b.dueDate.getTime() < now.getTime());
  const dueWeek = open.filter((b) => b.dueDate != null && b.dueDate.getTime() >= now.getTime() && b.dueDate.getTime() - now.getTime() <= 7 * DAY);
  const pending = open.filter((b) => b.status === 'pending_approval');

  // Scorecards: values are real; deltas/sparklines are illustrative (no historical series yet).
  const score: Score[] = [
    { label: 'Total payable', value: sumCents(open) / 100, sub: `${open.length} open bills`, delta: '+8.2%', dir: 'up', tone: 'neutral', spark: [392, 401, 388, 410, 423, 418, 431, 445, 452, 460, 471, 482] },
    { label: 'Overdue', value: sumCents(overdue) / 100, sub: overdue.length === 1 ? `1 bill · ${overdue[0].vendor.name}` : `${overdue.length} bills`, delta: '+$22,400', dir: 'up', tone: 'bad', spark: [12, 10, 9, 8, 14, 22, 18, 40, 52, 60, 72, 86] },
    { label: 'Due this week', value: sumCents(dueWeek) / 100, sub: `${dueWeek.length} bills`, delta: '−12%', dir: 'down', tone: 'good', spark: [180, 172, 165, 150, 162, 158, 149, 142, 138, 134, 131, 128] },
    { label: 'Pending approval', value: sumCents(pending) / 100, sub: `${pending.length} bills`, delta: '+1 bill', dir: 'up', tone: 'neutral', spark: [40, 44, 42, 48, 46, 52, 50, 55, 53, 58, 57, 60] },
  ];

  // Needs review — bills with open AI flags, ranked by severity.
  const review: ReviewItem[] = billRows
    .map((b) => ({ b, openFlags: b.flags.filter((f) => f.status === 'open') }))
    .filter((x) => x.openFlags.length > 0)
    .map(({ b, openFlags }) => {
      const top = [...openFlags].sort((a, c) => SEV_RANK[c.severity] - SEV_RANK[a.severity])[0];
      return {
        vendor: b.vendor.name,
        mono: b.vendor.mono,
        amount: b.totalCents / 100,
        sev: top.severity,
        reason: top.title,
        gl: b.glAccount ?? '',
      };
    })
    .sort((a, c) => SEV_RANK[c.sev] - SEV_RANK[a.sev])
    .slice(0, 6);

  // Expected bills not received — recurring vendors overdue for an invoice (cadence-based).
  const expected: ExpectedItem[] = vendorRows
    .filter((v) => v.cadence === 'monthly' || v.cadence === 'weekly')
    .map((v) => {
      const period = v.cadence === 'weekly' ? 7 : 30;
      const issued = v.bills
        .map((b) => b.issueDate)
        .filter((d): d is Date => d != null)
        .sort((a, b) => b.getTime() - a.getTime());
      const last = issued[0] ?? null;
      const expectedDate = last ? new Date(last.getTime() + period * DAY) : now;
      const late = Math.floor((now.getTime() - expectedDate.getTime()) / DAY);
      const amounts = v.bills.map((b) => b.totalCents).filter((n) => n > 0);
      const avg = amounts.length ? amounts.reduce((s, n) => s + n, 0) / amounts.length / 100 : 0;
      return {
        vendor: v.name,
        mono: v.mono,
        gl: v.defaultGl ?? '',
        cadence: v.cadence === 'weekly' ? 'Weekly' : 'Monthly',
        expected: formatShortDate(expectedDate),
        late,
        typical: avg >= 1000 ? `~$${Math.round(avg / 1000)}k` : `~$${Math.round(avg).toLocaleString('en-US')}`,
      };
    })
    .filter((e) => e.late >= 0)
    .sort((a, b) => b.late - a.late)
    .slice(0, 4);

  // Cash out by week — open bills bucketed into the next 6 weeks by due date.
  const cashout: CashOutWeek[] = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getTime() + i * 7 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    const amount =
      open
        .filter((b) => b.dueDate != null && b.dueDate.getTime() >= start.getTime() && b.dueDate.getTime() < end.getTime())
        .reduce((s, b) => s + b.totalCents, 0) / 100;
    return { wk: formatShortDate(start), amount, current: i === 0 };
  });

  // Activity feed — resolve actorId → name/mono (user, vendor, or system).
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const vendorById = new Map(vendorRows.map((v) => [v.id, v]));
  const activity: ActivityItem[] = acts.map((a) => {
    const u = a.actorId ? userById.get(a.actorId) : undefined;
    const v = a.actorId ? vendorById.get(a.actorId) : undefined;
    return {
      type: a.type as ActivityType,
      who: u?.name ?? v?.name ?? 'Settle',
      mono: u?.mono ?? v?.mono ?? 'S',
      text: a.text,
      target: a.target ?? undefined,
      amount: a.amountCents != null ? a.amountCents / 100 : undefined,
      meta: a.meta ?? undefined,
      quote: a.quote ?? undefined,
      time: timeAgo(a.createdAt),
    };
  });

  return { score, review, expected, cashout, activity };
}
