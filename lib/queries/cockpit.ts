import { db } from '@/db';
import { bills, users, activityLog } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { DEMO_NOW, DEMO_ORG } from '@/lib/demo';
import { requiredApproval, roleSatisfies } from '@/lib/approval-rules';
import { getCurrentUserId } from '@/lib/actions/session';
import type {
  Bill,
  Line,
  Totals,
  Flag,
  FlagSev,
  HistoryItem,
  TimelineNode,
  TimelineEvent,
  TimelineComment,
  BodySegment,
  Person,
} from '@/lib/data/cockpit';

const DAY = 86_400_000;

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

const ROLE_LABEL: Record<string, string> = {
  clerk: 'AP Clerk',
  approver: 'Approver',
  controller: 'Controller',
};

export type CockpitData = {
  bill: Bill;
  lines: Line[];
  totals: Totals;
  flags: Flag[];
  history: HistoryItem[];
  timeline: TimelineNode[];
  roles: Person[];
  approvalGate: { requiredRole: string; label: string; canApprove: boolean } | null;
};

// "Jun 9, 2026"
function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// "May 8"
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// "Jun 1 · 9:14 AM"
function timelineStamp(d: Date): string {
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  return `${date} · ${time}`;
}

function dueHintLabel(due: Date | null): string {
  if (!due) return 'No due date';
  const days = Math.round((due.getTime() - DEMO_NOW.getTime()) / DAY);
  if (days < 0) return `${-days} days overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

const sevOf = (s: string): FlagSev => (s === 'high' || s === 'med' || s === 'low' ? s : 'low');

export async function getCockpitData(billId: string): Promise<CockpitData | null> {
  const bill = await db.query.bills.findFirst({
    where: eq(bills.id, billId),
    with: {
      vendor: true,
      createdByUser: true,
      lineItems: true,
      flags: true,
      comments: { with: { author: true } },
      approvals: { with: { actor: true } },
    },
  });
  if (!bill) return null;

  // Org users → drive @-mentions in the composer + actor lookups.
  const userRows = await db.select().from(users).where(eq(users.orgId, DEMO_ORG));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  // Manual edits aren't synthetic timeline nodes — pull them from the audit log.
  const editEvents = await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.billId, bill.id), eq(activityLog.type, 'edited')));

  // Vendor's prior invoices → the history strip.
  const priorRows = await db.query.bills.findMany({
    where: and(eq(bills.vendorId, bill.vendorId), ne(bills.id, bill.id)),
  });

  const openFlags = bill.flags.filter((f) => f.status === 'open');
  const ordered = [...bill.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  // Approver = whoever signed off if approved, else the org's approver-role
  // user. The submit event's actor is the *submitter*, not the approver.
  const approveEvent = bill.approvals.find((a) => a.action === 'approve');
  const approver =
    approveEvent?.actor?.name ??
    (approveEvent?.actorId ? userById.get(approveEvent.actorId)?.name : undefined) ??
    userRows.find((u) => u.role === 'approver')?.name ??
    'Marcus Reyes';

  /* ---------- header ---------- */
  const billShape: Bill = {
    id: bill.id,
    vendor: bill.vendor.name,
    mono: bill.vendor.mono,
    inv: bill.invoiceNumber,
    amount: bill.totalCents / 100,
    status: bill.status === 'paid' ? 'paid' : 'approval',
    statusLabel: bill.status === 'paid' ? 'Paid' : 'In approval',
    due: bill.dueDate ? longDate(bill.dueDate) : '—',
    dueHint: dueHintLabel(bill.dueDate),
    issued: bill.issueDate ? longDate(bill.issueDate) : '—',
    terms: TERMS_LABEL[bill.vendor.terms] ?? bill.vendor.terms,
    gl: bill.glAccount ?? '',
    account: 'Operating ••4821',
    method: METHOD_LABEL[bill.vendor.defaultMethod] ?? bill.vendor.defaultMethod,
    poNumber: null,
    memo: bill.memo ?? '',
    flagged: openFlags.length > 0,
    approver,
    secondApprover: true,
  };

  /* ---------- line items ---------- */
  // A line is "flagged" when an open flag cites it (lineRef like "Line 2 · …").
  const flaggedLineIdx = new Set(
    openFlags
      .map((f) => f.lineRef?.match(/Line\s+(\d+)/i)?.[1])
      .filter((n): n is string => n != null)
      .map((n) => parseInt(n, 10) - 1),
  );
  const lines: Line[] = ordered.map((l, i) => ({
    id: l.id,
    desc: l.description,
    qty: l.quantity != null ? l.quantity.toLocaleString('en-US') : '1',
    unit: (l.unitPriceCents ?? l.amountCents) / 100,
    amount: l.amountCents / 100,
    gl: l.glLabel ?? bill.glAccount ?? '',
    split: false,
    flag: flaggedLineIdx.has(i) || undefined,
  }));

  const totals: Totals = {
    subtotal: bill.subtotalCents / 100,
    tax: bill.taxCents / 100,
    total: bill.totalCents / 100,
  };

  /* ---------- AI review flags ---------- */
  const flags: Flag[] = bill.flags.map((f) => ({
    id: f.id,
    sev: sevOf(f.severity),
    title: f.title,
    reason: f.message,
    cite: f.lineRef ?? '',
  }));

  /* ---------- history: vendor's prior invoices ---------- */
  const history: HistoryItem[] = priorRows
    .filter((b): b is typeof b & { issueDate: Date } => b.issueDate != null)
    .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
    .slice(0, 3)
    .map((b) => ({
      inv: b.invoiceNumber,
      date: b.paidAt ? shortDate(b.paidAt) : shortDate(b.issueDate),
      amount: b.totalCents / 100,
      status: 'paid',
    }));

  /* ---------- unified timeline ---------- */
  type Entry = { at: number; node: TimelineNode };
  const entries: Entry[] = [];

  if (bill.createdAt) {
    const creator = bill.createdByUser;
    entries.push({
      at: bill.createdAt.getTime(),
      node: {
        id: 'created',
        kind: 'event',
        icon: 'file-plus-2',
        who: creator?.name ?? 'Settle',
        mono: creator?.mono ?? 'S',
        text:
          bill.source === 'manual'
            ? 'created this bill manually'
            : bill.ocrStatus === 'done'
              ? 'created this bill from a captured invoice'
              : 'created this bill from an emailed PDF',
        time: timelineStamp(bill.createdAt),
      } satisfies TimelineEvent,
    });
    // Settle auto-coded (1 min after creation) — only for Settle-ingested bills, not manual entry
    if (bill.source !== 'manual') {
      const coded = new Date(bill.createdAt.getTime() + 60_000);
      entries.push({
        at: coded.getTime(),
        node: {
          id: 'coded',
          kind: 'event',
          icon: 'sparkles',
          who: 'Settle',
          mono: 'S',
          accent: 'approval',
          text: `auto-coded all ${ordered.length} lines to ${bill.glAccount ?? 'GL'} and matched the vendor`,
          time: timelineStamp(coded),
        } satisfies TimelineEvent,
      });
    }
    // Settle flagged N issues (2 min after creation)
    if (bill.flags.length > 0) {
      const flagged = new Date(bill.createdAt.getTime() + 120_000);
      entries.push({
        at: flagged.getTime(),
        node: {
          id: 'flagged',
          kind: 'event',
          icon: 'flag',
          who: 'Settle',
          mono: 'S',
          accent: 'review',
          text: `flagged ${bill.flags.length} issue${bill.flags.length === 1 ? '' : 's'} for review`,
          time: timelineStamp(flagged),
        } satisfies TimelineEvent,
      });
    }
  }

  // approval events (submit / approve / reject)
  for (const a of bill.approvals) {
    const actor = a.actorId ? userById.get(a.actorId) : undefined;
    const verb =
      a.action === 'submit' ? 'submitted for approval' : a.action === 'approve' ? 'approved this bill' : 'rejected this bill';
    entries.push({
      at: a.createdAt.getTime(),
      node: {
        id: a.id,
        kind: 'event',
        icon: a.action === 'submit' ? 'send' : a.action === 'approve' ? 'check' : 'x',
        who: actor?.name ?? a.actor?.name ?? 'Settle',
        mono: actor?.mono ?? a.actor?.mono ?? 'S',
        text: verb,
        sub: a.action === 'submit' ? `Routed to ${approver} · requires a second approver` : a.note ?? undefined,
        time: timelineStamp(a.createdAt),
      } satisfies TimelineEvent,
    });
  }

  // comments (@-mentions resolved from the mentions array)
  for (const cm of bill.comments) {
    const mentionNames = (cm.mentions ?? [])
      .map((id) => userById.get(id)?.name)
      .filter((n): n is string => n != null);
    entries.push({
      at: cm.createdAt.getTime(),
      node: {
        id: cm.id,
        kind: 'comment',
        who: cm.author?.name ?? 'Someone',
        mono: cm.author?.mono ?? '?',
        time: timelineStamp(cm.createdAt),
        body: buildBody(cm.body, mentionNames),
      } satisfies TimelineComment,
    });
  }

  // manual edits (from the audit log — not a synthetic node)
  for (const ev of editEvents) {
    const editor = ev.actorId ? userById.get(ev.actorId) : undefined;
    entries.push({
      at: ev.createdAt.getTime(),
      node: {
        id: ev.id,
        kind: 'event',
        icon: 'pencil',
        who: editor?.name ?? 'Someone',
        mono: editor?.mono ?? '?',
        text: 'edited this bill',
        time: timelineStamp(ev.createdAt),
      } satisfies TimelineEvent,
    });
  }

  entries.sort((a, b) => a.at - b.at);
  const timeline: TimelineNode[] = entries.map((e) => e.node);

  // trailing "waiting on approval" node (only while in approval)
  if (bill.status === 'pending_approval') {
    timeline.push({
      id: 'pending',
      kind: 'event',
      icon: 'clock',
      who: 'Settle',
      mono: 'S',
      accent: 'review',
      text: 'is waiting on your approval',
      sub: 'You are listed as the approver',
      time: 'Now',
      pending: true,
    } satisfies TimelineEvent);
  }

  /* ---------- people for @-mentions ---------- */
  const roles: Person[] = userRows.map((u) => ({
    id: u.id,
    role: ROLE_LABEL[u.role] ?? u.role,
    name: u.name,
    mono: u.mono,
    desc: u.description ?? '',
  }));

  /* ---------- approval-rules gate ---------- */
  // Large bills route to a more senior role. Resolve the current actor's role to
  // decide whether they may approve right now (drives the cockpit's gate chip).
  const gate = requiredApproval(bill.totalCents);
  let approvalGate: CockpitData['approvalGate'] = null;
  if (gate) {
    const actorId = await getCurrentUserId();
    const actorRole = userRows.find((u) => u.id === actorId)?.role ?? 'clerk';
    approvalGate = {
      requiredRole: gate.requiredRole,
      label: gate.label,
      canApprove: roleSatisfies(actorRole, gate.requiredRole),
    };
  }

  return { bill: billShape, lines, totals, flags, history, timeline, roles, approvalGate };
}

// Resolve mention names into the comment body. The seed stores the prose
// without inline @tokens + a separate mentions[] array; we surface mentions
// as leading mention chips, matching the cockpit's comment rendering.
function buildBody(text: string, mentionNames: string[]): BodySegment[] {
  const segs: BodySegment[] = [];
  for (const name of mentionNames) {
    segs.push({ t: 'mention', v: `@${name}` });
    segs.push({ t: 'text', v: ' ' });
  }
  segs.push({ t: 'text', v: text });
  return segs;
}
