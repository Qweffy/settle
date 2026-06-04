// Settle — Dashboard data, themed for Summit Waste Services
import type { StatusKey } from './shell';

export type Score = {
  label: string;
  value: number;
  sub: string;
  delta: string;
  dir: 'up' | 'down';
  tone: 'neutral' | 'bad' | 'good';
  spark: number[];
};

export const SCORE: Score[] = [
  { label: 'Total payable', value: 482150.0, sub: '19 open bills', delta: '+8.2%', dir: 'up', tone: 'neutral', spark: [392, 401, 388, 410, 423, 418, 431, 445, 452, 460, 471, 482] },
  { label: 'Overdue', value: 86400.0, sub: '1 bill · Regional Landfill', delta: '+$22,400', dir: 'up', tone: 'bad', spark: [12, 10, 9, 8, 14, 22, 18, 40, 52, 60, 72, 86] },
  { label: 'Due this week', value: 128640.0, sub: '6 bills', delta: '−12%', dir: 'down', tone: 'good', spark: [180, 172, 165, 150, 162, 158, 149, 142, 138, 134, 131, 128] },
  { label: 'Pending approval', value: 60080.0, sub: '2 bills · 1 needs 2nd approver', delta: '+1 bill', dir: 'up', tone: 'neutral', spark: [40, 44, 42, 48, 46, 52, 50, 55, 53, 58, 57, 60] },
];

export type ReviewSev = 'high' | 'med' | 'low';
export type ReviewItem = { vendor: string; mono: string; amount: number; sev: ReviewSev; reason: string; gl: string };

export const REVIEW: ReviewItem[] = [
  { vendor: 'WEX Fleet Fuel', mono: 'WF', amount: 52180.0, sev: 'high', reason: 'Fuel surcharge 32% above 6-mo average', gl: 'Fuel' },
  { vendor: 'Regional Landfill Authority', mono: 'RL', amount: 86400.0, sev: 'high', reason: 'Tonnage 18% higher than trailing 3-mo average', gl: 'Tipping Fees' },
  { vendor: 'McNeilus', mono: 'MC', amount: 9420.0, sev: 'med', reason: 'No matching PO for line items over $5,000', gl: 'Fleet Maintenance' },
  { vendor: 'Samsara', mono: 'SA', amount: 7900.0, sev: 'med', reason: 'Unit price up 12% vs prior contract term', gl: 'Software' },
  { vendor: 'Cintas', mono: 'CN', amount: 2310.0, sev: 'low', reason: 'Possible duplicate of CIN-4471 paid May 28', gl: 'Office' },
];

export type ExpectedItem = { vendor: string; mono: string; gl: string; cadence: string; expected: string; late: number; typical: string };

export const EXPECTED: ExpectedItem[] = [
  { vendor: 'Regional Landfill Authority', mono: 'RL', gl: 'Tipping Fees', cadence: 'Monthly', expected: 'Jun 1', late: 2, typical: '$80k–90k' },
  { vendor: 'Travelers', mono: 'TR', gl: 'Insurance', cadence: 'Monthly', expected: 'Jun 1', late: 2, typical: '$44,200.00' },
  { vendor: 'Penske Truck Leasing', mono: 'PT', gl: 'Equipment', cadence: 'Monthly', expected: 'May 28', late: 6, typical: '$31,500.00' },
  { vendor: 'Cintas', mono: 'CN', gl: 'Office', cadence: 'Weekly', expected: 'May 30', late: 4, typical: '~$2,300' },
];

export type CashOutWeek = { wk: string; amount: number; current?: boolean };

export const CASHOUT: CashOutWeek[] = [
  { wk: 'Jun 2', amount: 128640, current: true },
  { wk: 'Jun 9', amount: 96200 },
  { wk: 'Jun 16', amount: 52400 },
  { wk: 'Jun 23', amount: 74900 },
  { wk: 'Jun 30', amount: 38100 },
  { wk: 'Jul 7', amount: 61500 },
];

export type ActivityType =
  | 'approved'
  | 'scheduled'
  | 'commented'
  | 'synced'
  | 'created'
  | 'failed'
  | 'submitted'
  | 'rejected'
  | 'paid'
  | 'edited';
export type ActivityItem = {
  type: ActivityType;
  who: string;
  mono: string;
  text: string;
  target?: string;
  amount?: number;
  meta?: string;
  quote?: string;
  time: string;
};

export const ACTIVITY: ActivityItem[] = [
  { type: 'approved', who: 'Marcus Reyes', mono: 'MR', text: 'approved', target: 'Heil Environmental', amount: 18950.0, time: '12m ago' },
  { type: 'scheduled', who: 'Dana Okafor', mono: 'DO', text: 'scheduled', target: 'Penske Truck Leasing', amount: 31500.0, meta: 'for Jun 12', time: '40m ago' },
  { type: 'commented', who: 'Lena Whitfield', mono: 'LW', text: 'commented on', target: 'WEX Fleet Fuel', quote: 'Confirm surcharge with vendor before approving.', time: '1h ago' },
  { type: 'failed', who: 'Travelers', mono: 'TR', text: 'payment failed', amount: 44200.0, meta: 'insufficient funds in Operating ••4821', time: '3h ago' },
  { type: 'synced', who: 'Settle', mono: 'S', text: 'synced 14 bills from QuickBooks', time: '4h ago' },
  { type: 'created', who: 'Dana Okafor', mono: 'DO', text: 'created', target: 'Wastequip', amount: 24760.0, meta: 'as draft', time: 'Yesterday' },
  { type: 'approved', who: 'Marcus Reyes', mono: 'MR', text: 'approved', target: 'Samsara', amount: 7900.0, time: 'Yesterday' },
];

export const SEV: Record<ReviewSev, { label: string; solid: string; bg: string; ink: string }> = {
  high: { label: 'High', solid: '--failed-solid', bg: '--failed-bg', ink: '--failed-ink' },
  med: { label: 'Medium', solid: '--review-solid', bg: '--review-bg', ink: '--review-ink' },
  low: { label: 'Low', solid: '--draft-solid', bg: '--draft-bg', ink: '--draft-ink' },
};

export const ACT_ICON: Record<ActivityType, { icon: string; color: string }> = {
  approved: { icon: 'check-circle-2', color: '--paid-solid' },
  scheduled: { icon: 'calendar-clock', color: '--scheduled-solid' },
  commented: { icon: 'message-square', color: '--fg-3' },
  synced: { icon: 'refresh-cw', color: '--approval-solid' },
  created: { icon: 'file-plus-2', color: '--fg-3' },
  failed: { icon: 'alert-triangle', color: '--failed-solid' },
  submitted: { icon: 'send-horizontal', color: '--approval-solid' },
  rejected: { icon: 'circle-x', color: '--failed-solid' },
  paid: { icon: 'banknote', color: '--paid-solid' },
  edited: { icon: 'pencil', color: '--fg-3' },
};

// Defensive fallback so an unmapped activity type can never crash the feed.
export const ACT_ICON_FALLBACK = { icon: 'circle', color: '--fg-3' } as const;

export type { StatusKey };
