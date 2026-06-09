// Settle — App shell data, themed for Summit Waste Services

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  review?: number;
  count?: number;
  sub?: string;
};

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/dashboard' },
  { id: 'bills', label: 'Bills', icon: 'file-text', href: '/bills', review: 3 },
  { id: 'capture', label: 'Capture', icon: 'scan-line', href: '/capture' },
  { id: 'approvals', label: 'Approvals', icon: 'check-circle-2', href: '/approvals', count: 5 },
  { id: 'vendors', label: 'Vendors', icon: 'building-2', href: '/vendors' },
  { id: 'payments', label: 'Payments', icon: 'banknote', href: '/payments' },
  { id: 'reports', label: 'Reports', icon: 'bar-chart-3', href: '/reports', sub: 'AP Aging' },
];

export type Entity = { id: string; name: string; sub: string; mono: string };

export const ENTITIES: Entity[] = [
  { id: 'org-sws', name: 'Summit Waste Services', sub: 'Operating · ••4821', mono: 'SW' },
  { id: 'org-sts', name: 'Summit Transfer Stations', sub: 'Operating · ••6307', mono: 'ST' },
  { id: 'org-crc', name: 'Cascade Recycling Co.', sub: 'Operating · ••1192', mono: 'CR' },
];

export type Role = { id: string; role: string; name: string; mono: string; desc: string; userId: string };

export const ROLES: Role[] = [
  { id: 'clerk', role: 'AP Clerk', name: 'Dana Okafor', mono: 'DO', desc: 'Capture bills, schedule payments', userId: 'user-dana' },
  { id: 'approver', role: 'Approver', name: 'Marcus Reyes', mono: 'MR', desc: 'Review and sign off on bills', userId: 'user-marcus' },
  { id: 'controller', role: 'Controller', name: 'Lena Whitfield', mono: 'LW', desc: 'Full ledger + payment release', userId: 'user-lena' },
];

export type CmdAction = { id: string; label: string; icon: string; keys: string[] };
export type CmdRecent = { id: string; label: string; sub: string; icon: string; kind: string; href: string };
export type CmdNav = { id: string; label: string; icon: string; hint: string; href: string };

export const CMD_ACTIONS: CmdAction[] = [
  { id: 'newbill', label: 'New bill', icon: 'plus', keys: ['⌘', 'N'] },
  { id: 'capture', label: 'Capture a bill', icon: 'scan-line', keys: ['G', 'C'] },
  { id: 'record', label: 'Record payment', icon: 'banknote', keys: ['⌘', 'P'] },
  { id: 'vendor', label: 'Add vendor', icon: 'building-2', keys: ['⌘', '⇧', 'V'] },
];

export const CMD_RECENT: CmdRecent[] = [
  { id: 'r1', label: 'Regional Landfill Authority', sub: 'INV-44871 · Tipping fees · $86,400.00', icon: 'file-text', kind: 'bill', href: '/bills' },
  { id: 'r2', label: 'WEX Fleet Fuel', sub: 'STMT-0529 · Fuel · in approval', icon: 'file-text', kind: 'bill', href: '/bills' },
  { id: 'r3', label: 'Penske Truck Leasing', sub: 'Vendor · Net 30 · 14 bills', icon: 'building-2', kind: 'vendor', href: '/vendors' },
  { id: 'r4', label: 'Heil Environmental', sub: 'Vendor · Fleet maintenance', icon: 'building-2', kind: 'vendor', href: '/vendors' },
];

export const CMD_NAV: CmdNav[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', hint: 'G D', href: '/dashboard' },
  { id: 'bills', label: 'Bills', icon: 'file-text', hint: 'G B', href: '/bills' },
  { id: 'approvals', label: 'Approvals', icon: 'check-circle-2', hint: 'G A', href: '/approvals' },
  { id: 'vendors', label: 'Vendors', icon: 'building-2', hint: 'G V', href: '/vendors' },
  { id: 'payments', label: 'Payments', icon: 'banknote', hint: 'G P', href: '/payments' },
  { id: 'reports', label: 'Reports · AP Aging', icon: 'bar-chart-3', hint: 'G R', href: '/reports' },
];

export type StatusKey =
  | 'paid'
  | 'scheduled'
  | 'approval'
  | 'approved'
  | 'dueSoon'
  | 'overdue'
  | 'failed'
  | 'draft'
  | 'rejected'
  | 'review';

export type StatusMeta = { label: string; bg: string; ink: string; solid: string };

export const STATUS: Record<StatusKey, StatusMeta> = {
  paid: { label: 'Paid', bg: '--paid-bg', ink: '--paid-ink', solid: '--paid-solid' },
  scheduled: { label: 'Scheduled', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
  approval: { label: 'In approval', bg: '--approval-bg', ink: '--approval-ink', solid: '--approval-solid' },
  dueSoon: { label: 'Due soon', bg: '--overdue-bg', ink: '--overdue-ink', solid: '--overdue-solid' },
  overdue: { label: 'Overdue', bg: '--overdue-bg', ink: '--overdue-ink', solid: '--overdue-solid' },
  failed: { label: 'Failed', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
  draft: { label: 'Draft', bg: '--draft-bg', ink: '--draft-ink', solid: '--draft-solid' },
  review: { label: 'Needs review', bg: '--review-bg', ink: '--review-ink', solid: '--review-solid' },
  approved: { label: 'Approved', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
  rejected: { label: 'Rejected', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
};
