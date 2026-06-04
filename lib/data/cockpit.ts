// Settle — Bill Detail "cockpit" data (WEX Fleet Fuel, flagged bill)

export type Bill = {
  id: string;
  vendor: string;
  mono: string;
  inv: string;
  amount: number;
  status: 'approval' | 'paid';
  statusLabel: string;
  due: string;
  dueHint: string;
  issued: string;
  terms: string;
  gl: string;
  account: string;
  method: string;
  poNumber: string | null;
  memo: string;
  flagged: boolean;
  approver: string;
  secondApprover: boolean;
};

// ---- the bill ----
export const BILL: Bill = {
  id: 'b-wex-0529',
  vendor: 'WEX Fleet Fuel', mono: 'WF', inv: 'STMT-0529',
  amount: 52180.0, status: 'approval', statusLabel: 'In approval',
  due: 'Jun 9, 2026', dueHint: 'Due in 6 days', issued: 'May 31, 2026',
  terms: 'Net 9', gl: 'Fuel', account: 'Operating ••4821', method: 'ACH',
  poNumber: null, memo: 'Fleet diesel — May statement (all depots)',
  flagged: true, approver: 'Marcus Reyes', secondApprover: true,
};

export type Line = {
  id: string;
  desc: string;
  qty: string;
  unit: number;
  amount: number;
  gl: string;
  split: boolean;
  splits?: { gl: string; amount: number }[];
  flag?: boolean;
};

// ---- line items ----
export const LINES: Line[] = [
  { id: 'l1', desc: 'Diesel — fleet fuel (all depots)', qty: '14,200 gal', unit: 3.42, amount: 48564.0, gl: 'Fuel', split: false },
  { id: 'l2', desc: 'Fuel surcharge', qty: '1', unit: 2890.0, amount: 2890.0, gl: 'Fuel', split: false, flag: true },
  { id: 'l3', desc: 'Card & transaction fees', qty: '1', unit: 726.0, amount: 726.0, gl: 'Fuel', split: true },
];

export type Totals = { subtotal: number; tax: number; total: number };

export const TOTALS: Totals = { subtotal: 52180.0, tax: 0.0, total: 52180.0 };

export const GL_OPTIONS: string[] = ['Fuel', 'Tipping Fees', 'Fleet Maintenance', 'Equipment', 'Insurance', 'Software', 'Office'];

export type FlagSev = 'high' | 'med' | 'low';
export type Flag = { id: string; sev: FlagSev; title: string; reason: string; cite: string };

// ---- AI Bill Review ----
export const FLAGS: Flag[] = [
  { id: 'f1', sev: 'high', title: 'Fuel surcharge 32% above 6-mo average',
    reason: 'This statement’s surcharge is $2,890.00 vs ~$2,190 typical. WEX indexes the surcharge to the diesel spot price, which spiked in late May.',
    cite: 'Line 2 · Fuel surcharge' },
  { id: 'f2', sev: 'med', title: 'Unit price up 9% vs prior statement',
    reason: '$3.42/gal this period vs $3.14/gal on STMT-0428. Above the 5% variance threshold on your Fuel GL.',
    cite: 'Line 1 · Diesel' },
  { id: 'f3', sev: 'low', title: 'Gallons 12% above monthly average',
    reason: '14,200 gal vs ~12,700 gal trailing average. Within seasonal range for May; no action usually needed.',
    cite: 'Line 1 · Diesel' },
];

export type SevMeta = { label: string; solid: string; bg: string; ink: string };

export const SEV: Record<FlagSev, SevMeta> = {
  high: { label: 'High', solid: '--failed-solid', bg: '--failed-bg', ink: '--failed-ink' },
  med: { label: 'Medium', solid: '--review-solid', bg: '--review-bg', ink: '--review-ink' },
  low: { label: 'Low', solid: '--draft-solid', bg: '--draft-bg', ink: '--draft-ink' },
};

export type HistoryItem = { inv: string; date: string; amount: number; status: 'paid' };

// ---- last 3 invoices from this vendor ----
export const HISTORY: HistoryItem[] = [
  { inv: 'STMT-0428', date: 'May 8', amount: 48900.0, status: 'paid' },
  { inv: 'STMT-0327', date: 'Apr 9', amount: 46210.0, status: 'paid' },
  { inv: 'STMT-0226', date: 'Mar 10', amount: 44830.0, status: 'paid' },
];

export type BodySegment = { t: 'text' | 'mention'; v: string };

export type TimelineEvent = {
  id: string;
  kind: 'event';
  icon: string;
  who: string;
  mono: string;
  text: string;
  time: string;
  accent?: 'review' | 'approval';
  sub?: string;
  pending?: boolean;
};

export type TimelineComment = {
  id: string;
  kind: 'comment';
  who: string;
  mono: string;
  time: string;
  body: BodySegment[];
};

export type TimelineNode = TimelineEvent | TimelineComment;

// ---- unified timeline (oldest → newest) ----
export const TIMELINE: TimelineNode[] = [
  { id: 't1', kind: 'event', icon: 'file-plus-2', who: 'Dana Okafor', mono: 'DO',
    text: 'created this bill from an emailed PDF', time: 'Jun 1 · 9:14 AM' },
  { id: 't2', kind: 'event', icon: 'sparkles', who: 'Settle', mono: 'S', accent: 'approval',
    text: 'auto-coded all 3 lines to Fuel and matched the vendor', time: 'Jun 1 · 9:15 AM' },
  { id: 't3', kind: 'event', icon: 'flag', who: 'Settle', mono: 'S', accent: 'review',
    text: 'flagged 2 issues for review', time: 'Jun 1 · 9:16 AM' },
  { id: 't4', kind: 'event', icon: 'send', who: 'Dana Okafor', mono: 'DO',
    text: 'submitted for approval', sub: 'Routed to Marcus Reyes · requires a second approver', time: 'Jun 1 · 2:30 PM' },
  { id: 't5', kind: 'comment', who: 'Marcus Reyes', mono: 'MR', time: 'Jun 2 · 10:02 AM',
    body: [{ t: 'mention', v: '@Lena Whitfield' }, { t: 'text', v: ' the fuel surcharge jumped again — can you confirm it against the contract before I approve?' }] },
  { id: 't6', kind: 'comment', who: 'Lena Whitfield', mono: 'LW', time: 'Jun 2 · 11:20 AM',
    body: [{ t: 'text', v: 'Pulled the WEX contract — the surcharge is indexed to the diesel spot price, so it’s legitimate but high this month. ' }, { t: 'mention', v: '@Marcus Reyes' }, { t: 'text', v: ' OK to approve. I’ll flag it in the month-end review.' }] },
  { id: 't7', kind: 'event', icon: 'clock', who: 'Settle', mono: 'S', accent: 'review',
    text: 'is waiting on your approval', sub: 'You are listed as the approver', time: 'Now', pending: true },
];

export type Person = { id: string; role: string; name: string; mono: string; desc: string };

export const ROLES: Person[] = [
  { id: 'clerk', role: 'AP Clerk', name: 'Dana Okafor', mono: 'DO', desc: 'Capture bills, schedule payments' },
  { id: 'approver', role: 'Approver', name: 'Marcus Reyes', mono: 'MR', desc: 'Review and sign off on bills' },
  { id: 'controller', role: 'Controller', name: 'Lena Whitfield', mono: 'LW', desc: 'Full ledger + payment release' },
];
