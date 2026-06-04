// Settle — Bills list data, themed for Summit Waste Services
import type { StatusKey } from './shell';

export type Tab = { id: string; label: string; count: number };

export const TABS: Tab[] = [
  { id: 'all', label: 'All', count: 14 },
  { id: 'draft', label: 'Drafts', count: 2 },
  { id: 'approval', label: 'In approval', count: 3 },
  { id: 'scheduled', label: 'Scheduled', count: 3 },
  { id: 'paid', label: 'Paid', count: 3 },
  { id: 'review', label: 'Needs review', count: 3 },
];

export type Filter = { id: string; label: string };

export const FILTERS: Filter[] = [
  { id: 'status', label: 'Status' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'gl', label: 'GL account' },
  { id: 'due', label: 'Due date' },
  { id: 'amount', label: 'Amount' },
];

export type StatusMeta = { label: string; bg: string; ink: string; solid: string };

// status drives the pill; values are intentionally local to this screen
export const STATUS: Record<StatusKey, StatusMeta> = {
  paid: { label: 'Paid', bg: '--paid-bg', ink: '--paid-ink', solid: '--paid-solid' },
  scheduled: { label: 'Scheduled', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
  approval: { label: 'In approval', bg: '--approval-bg', ink: '--approval-ink', solid: '--approval-solid' },
  dueSoon: { label: 'Due soon', bg: '--overdue-bg', ink: '--overdue-ink', solid: '--overdue-solid' },
  overdue: { label: 'Overdue', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
  failed: { label: 'Failed', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
  draft: { label: 'Draft', bg: '--draft-bg', ink: '--draft-ink', solid: '--draft-solid' },
  review: { label: 'Needs review', bg: '--review-bg', ink: '--review-ink', solid: '--review-solid' },
  approved: { label: 'Approved', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
  rejected: { label: 'Rejected', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
};

export type DueTone = 'overdue' | 'soon' | 'none';

export type BillRow = {
  id: string;
  vendor: string;
  mono: string;
  inv: string;
  amount: number;
  due: string;
  dueHint: string;
  dueTone: DueTone;
  status: StatusKey;
  gl: string;
  flag: string | null;
  tabs: string[];
};

// tab membership for filtering
// status drives the pill; `tabs` lists which lifecycle buckets a row belongs to
export const ROWS: BillRow[] = [
  { id: 'b01', vendor: 'Regional Landfill Authority', mono: 'RL', inv: 'INV-44871', amount: 86400.0,
    due: 'May 30', dueHint: '4d overdue', dueTone: 'overdue', status: 'overdue', gl: 'Tipping Fees',
    flag: 'Tonnage 18% above 3-mo avg', tabs: ['all', 'approval', 'review'] },
  { id: 'b02', vendor: 'WEX Fleet Fuel', mono: 'WF', inv: 'STMT-0529', amount: 52180.0,
    due: 'Jun 9', dueHint: 'due in 6d', dueTone: 'soon', status: 'approval', gl: 'Fuel',
    flag: 'Fuel surcharge 32% above 6-mo avg', tabs: ['all', 'approval', 'review'] },
  { id: 'b03', vendor: 'Travelers', mono: 'TR', inv: 'TRV-2026-06', amount: 44200.0,
    due: 'Jun 10', dueHint: 'due in 7d', dueTone: 'soon', status: 'dueSoon', gl: 'Insurance',
    flag: null, tabs: ['all'] },
  { id: 'b04', vendor: 'Penske Truck Leasing', mono: 'PT', inv: 'PEN-88120', amount: 31500.0,
    due: 'Jun 12', dueHint: 'due in 9d', dueTone: 'soon', status: 'scheduled', gl: 'Equipment',
    flag: null, tabs: ['all', 'scheduled'] },
  { id: 'b05', vendor: 'Heil Environmental', mono: 'HE', inv: 'HEIL-5567', amount: 18950.0,
    due: 'Jun 12', dueHint: 'due in 9d', dueTone: 'soon', status: 'scheduled', gl: 'Fleet Maintenance',
    flag: null, tabs: ['all', 'scheduled'] },
  { id: 'b06', vendor: 'McNeilus', mono: 'MC', inv: 'MCN-3391', amount: 9420.0,
    due: 'Jun 14', dueHint: 'due in 11d', dueTone: 'none', status: 'review', gl: 'Fleet Maintenance',
    flag: 'No matching PO for lines over $5,000', tabs: ['all', 'review'] },
  { id: 'b07', vendor: 'Samsara', mono: 'SA', inv: 'SAM-10044', amount: 7900.0,
    due: 'Jun 16', dueHint: 'due in 13d', dueTone: 'none', status: 'approval', gl: 'Software',
    flag: null, tabs: ['all', 'approval'] },
  { id: 'b08', vendor: 'Wastequip', mono: 'WQ', inv: 'WQ-7720', amount: 24760.0,
    due: '—', dueHint: 'no due date', dueTone: 'none', status: 'draft', gl: 'Equipment',
    flag: null, tabs: ['all', 'draft'] },
  { id: 'b09', vendor: 'Cintas', mono: 'CN', inv: 'CIN-4490', amount: 2310.0,
    due: 'Jun 18', dueHint: 'due in 15d', dueTone: 'none', status: 'draft', gl: 'Office',
    flag: null, tabs: ['all', 'draft'] },
  { id: 'b10', vendor: 'Penske Truck Leasing', mono: 'PT', inv: 'PEN-87655', amount: 31500.0,
    due: 'Jun 20', dueHint: 'due in 17d', dueTone: 'none', status: 'scheduled', gl: 'Equipment',
    flag: null, tabs: ['all', 'scheduled'] },
  { id: 'b11', vendor: 'Regional Landfill Authority', mono: 'RL', inv: 'INV-44102', amount: 81750.0,
    due: 'May 1', dueHint: 'paid May 1', dueTone: 'none', status: 'paid', gl: 'Tipping Fees',
    flag: null, tabs: ['all', 'paid'] },
  { id: 'b12', vendor: 'WEX Fleet Fuel', mono: 'WF', inv: 'STMT-0428', amount: 48900.0,
    due: 'May 9', dueHint: 'paid May 8', dueTone: 'none', status: 'paid', gl: 'Fuel',
    flag: null, tabs: ['all', 'paid'] },
  { id: 'b13', vendor: 'Cintas', mono: 'CN', inv: 'CIN-4471', amount: 2310.0,
    due: 'May 28', dueHint: 'paid May 28', dueTone: 'none', status: 'paid', gl: 'Office',
    flag: null, tabs: ['all', 'paid'] },
  { id: 'b14', vendor: 'Samsara', mono: 'SA', inv: 'SAM-09980', amount: 7900.0,
    due: 'May 16', dueHint: 'failed May 16', dueTone: 'overdue', status: 'failed', gl: 'Software',
    flag: null, tabs: ['all'] },
];

export type Col = { id: string; label: string };

export type { StatusKey };

export const COLS: Col[] = [
  { id: 'inv', label: 'Invoice #' },
  { id: 'amount', label: 'Amount' },
  { id: 'due', label: 'Due date' },
  { id: 'status', label: 'Status' },
  { id: 'gl', label: 'GL account' },
  { id: 'flag', label: 'AI flag' },
];

export type SortKey = 'vendor' | 'amount' | 'due';
export type Sort = { key: SortKey; dir: 'asc' | 'desc' };

// A saved bills-list view — a named snapshot of the table's filter state. The
// shape is pure UI state, persisted as JSON (see the `saved_views` table).
export type SavedViewConfig = {
  tab: string;
  query: string;
  sort: Sort;
  filters: string[]; // active filter-chip ids
  cols: string[]; // visible column ids
  density: number; // row height in px
};
export type SavedView = { id: string; name: string; config: SavedViewConfig };
