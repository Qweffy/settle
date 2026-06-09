import { db } from '@/db';
import { bills, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { DEMO_NOW } from '@/lib/demo';
import { getActiveOrg } from '@/lib/actions/session';
import { dueLabel, formatShortDate, timeAgo } from '@/lib/dates';
import type {
  ApprovalBill,
  ApprovalFlag,
  ApprovalSev,
  ApprovalUrgency,
  BillLine,
} from '@/lib/data/approvals';

const DAY = 86_400_000;
const SEV_RANK: Record<ApprovalSev, number> = { high: 2, med: 1 };

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

const ACCOUNT_LABEL: Record<string, string> = {
  ach: 'Operating ••4821',
  wire: 'Operating ••4821',
  check: 'mailed check',
  card: 'AP Card ••6620',
};

export type ApprovalsData = {
  bills: ApprovalBill[];
  approverName: string;
  approverMono: string;
};

function urgencyFor(due: Date | null, now: Date): ApprovalUrgency {
  if (!due) return 'later';
  const t = due.getTime();
  if (t < now.getTime()) return 'overdue';
  if (t - now.getTime() <= 7 * DAY) return 'soon';
  return 'later';
}

// Map a stored flag severity to the queue's display severity (low folds into med).
function displaySev(severity: 'high' | 'med' | 'low'): ApprovalSev {
  return severity === 'high' ? 'high' : 'med';
}

export async function getApprovalsData(): Promise<ApprovalsData> {
  const now = DEMO_NOW;
  const org = await getActiveOrg();

  // The approver whose queue this is (controller signs off as the second approver).
  const userRows = await db.select().from(users).where(eq(users.orgId, org));
  const approver = userRows.find((u) => u.role === 'approver');
  const controller = userRows.find((u) => u.role === 'controller');
  const usersById = new Map(userRows.map((u) => [u.id, u]));

  const billRows = await db.query.bills.findMany({
    where: and(eq(bills.orgId, org), eq(bills.status, 'pending_approval')),
    with: {
      vendor: true,
      lineItems: { orderBy: (li, { asc }) => asc(li.sortOrder) },
      flags: true,
    },
  });

  const list: ApprovalBill[] = billRows
    .map((b) => {
      const openFlags = b.flags.filter((f) => f.status === 'open');
      const flags: ApprovalFlag[] = openFlags
        .filter((f) => f.severity !== 'low')
        .map((f) => ({ sev: displaySev(f.severity), title: f.title, reason: f.message }))
        .sort((a, c) => SEV_RANK[c.sev] - SEV_RANK[a.sev]);

      const top = flags[0];
      const flagged = flags.length > 0;
      const summary = top
        ? `Flagged: ${top.title.charAt(0).toLowerCase() + top.title.slice(1)}.`
        : `Recurring ${b.glAccount ?? 'bill'}, in line with history.`;

      const lines: BillLine[] = b.lineItems.map((li) => ({
        desc: li.description,
        amount: li.amountCents / 100,
        gl: li.glLabel ?? b.glAccount ?? '',
      }));

      const due = dueLabel(b.dueDate, now);
      const submitter = b.createdBy ? usersById.get(b.createdBy) : undefined;
      // High-risk bills require the controller to co-sign as the second approver.
      const requiresSecond = flags.some((f) => f.sev === 'high');

      return {
        id: b.id,
        urgency: urgencyFor(b.dueDate, now),
        vendor: b.vendor.name,
        mono: b.vendor.mono,
        inv: b.invoiceNumber,
        amount: b.totalCents / 100,
        gl: b.glAccount ?? '',
        due: b.dueDate ? formatShortDate(b.dueDate) : '—',
        dueHint: due.text || (b.dueDate ? `due ${formatShortDate(b.dueDate)}` : 'no due date'),
        issued: b.issueDate
          ? b.issueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
          : '—',
        terms: TERMS_LABEL[b.vendor.terms] ?? b.vendor.terms,
        method: METHOD_LABEL[b.vendor.defaultMethod] ?? b.vendor.defaultMethod,
        account: ACCOUNT_LABEL[b.vendor.defaultMethod] ?? 'Operating ••4821',
        summary,
        flagged,
        submittedBy: submitter?.name ?? 'Settle',
        submittedMono: submitter?.mono ?? 'S',
        submittedTime: b.submittedAt ? timeAgo(b.submittedAt, now) : 'recently',
        requiresSecond,
        secondApprover: requiresSecond ? controller?.name : undefined,
        lines,
        flags,
      } satisfies ApprovalBill;
    })
    // Order: overdue first, then soonest due.
    .sort((a, c) => {
      const rank: Record<ApprovalUrgency, number> = { overdue: 0, soon: 1, later: 2 };
      if (rank[a.urgency] !== rank[c.urgency]) return rank[a.urgency] - rank[c.urgency];
      return c.amount - a.amount;
    });

  return {
    bills: list,
    approverName: approver?.name ?? 'Approver',
    approverMono: approver?.mono ?? 'AP',
  };
}
