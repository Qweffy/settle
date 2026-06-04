// Settle — Capture flow (upload → AI review) data
import { apForwardingAddress } from '@/lib/ap-inbox';

export const FORWARD_EMAIL = apForwardingAddress('Summit Waste Services');

// ---- state 1: recent uploads ----
export type RecentState = 'draft' | 'reading' | 'processed';
export type RecentUpload = {
  file: string;
  vendor: string;
  size: string;
  time: string;
  state: RecentState;
};

export const RECENT: RecentUpload[] = [
  { file: 'WEX_Fleet_May.pdf', vendor: 'WEX Fleet Fuel', size: '248 KB', time: '2m ago', state: 'draft' },
  { file: 'Penske_88120.pdf', vendor: 'Penske Truck Leasing', size: '96 KB', time: 'just now', state: 'reading' },
  { file: 'Heil_5567.pdf', vendor: 'Heil Environmental', size: '180 KB', time: '1h ago', state: 'processed' },
  { file: 'Cintas_4490.jpg', vendor: 'Cintas', size: '1.2 MB', time: '3h ago', state: 'draft' },
];

export type RecentStateMeta = { label: string; tone: string; icon: string };

export const RECENT_STATE: Record<RecentState, RecentStateMeta> = {
  draft: { label: 'Draft created', tone: 'approval', icon: 'file-check-2' },
  reading: { label: 'Reading…', tone: 'review', icon: 'loader' },
  processed: { label: 'Processed', tone: 'paid', icon: 'check' },
};

// ---- state 2: processing steps ----
export type ProcessStep = {
  label: string;
  detail: string;
  done: boolean;
  active?: boolean;
};

export const STEPS: ProcessStep[] = [
  { label: 'Detected vendor', detail: 'Regional Landfill Authority', done: true },
  { label: 'Read line items', detail: '4 lines · $85,400.00', done: true },
  { label: 'Coded to GL accounts', detail: 'Tipping Fees, Office', done: true },
  { label: 'Running 6 risk checks', detail: 'duplicates, fraud, variance…', done: false, active: true },
];

// ---- state 3: extracted draft ----
export type Draft = {
  vendor: string;
  vendorMatched: boolean;
  vendorSub: string;
  inv: string;
  issued: string;
  due: string;
  terms: string;
  po: string | null;
  gl: string;
  memo: string;
  method: string;
  remit: string;
  confidence: number;
};

export const DRAFT: Draft = {
  vendor: 'Regional Landfill Authority',
  vendorMatched: true,
  vendorSub: 'Matched · prior bills on file',
  inv: 'INV-1046',
  issued: 'Jun 1, 2026',
  due: 'Jul 1, 2026',
  terms: 'Net 30',
  po: null,
  gl: 'Tipping Fees',
  memo: 'May MSW disposal — Cedar Hills transfer',
  method: 'ACH',
  remit: '••7782',
  confidence: 92,
};

export type LineFlag = false | 'amber' | 'red';
export type LineItem = {
  id: string;
  desc: string;
  qty: string;
  unit: number | null;
  amount: number;
  gl: string;
  flag: LineFlag;
  isNew?: boolean;
};

export const LINES: LineItem[] = [
  { id: 'l1', desc: 'Tipping fees — MSW disposal', qty: '1,300', unit: 64.5, amount: 83850.0, gl: 'Tipping Fees', flag: false },
  { id: 'l2', desc: 'Fuel / energy surcharge', qty: '—', unit: null, amount: 412.0, gl: 'Tipping Fees', flag: 'amber' },
  { id: 'l3', desc: 'Administrative fee', qty: '—', unit: null, amount: 250.0, gl: 'Office', flag: 'amber', isNew: true },
  { id: 'l4', desc: 'State environmental fee', qty: '—', unit: null, amount: 888.0, gl: 'Tipping Fees', flag: false },
];

export type Totals = { subtotal: number; tax: number; total: number };
export const TOTALS: Totals = { subtotal: 85400.0, tax: 0.0, total: 85400.0 };

export const GL_OPTIONS: string[] = ['Tipping Fees', 'Fuel', 'Fleet Maintenance', 'Equipment', 'Insurance', 'Software', 'Office'];

// ---- AI Bill Review flags ----
export type FlagSev = 'amber' | 'red';
export type ReviewFlag = {
  id: string;
  sev: FlagSev;
  icon: string;
  title: string;
  reason: string;
  cite: string;
  fraud?: boolean;
};

export const FLAGS: ReviewFlag[] = [
  {
    id: 'f1',
    sev: 'amber',
    icon: 'trending-up',
    title: 'Fuel surcharge $412 — 32% above this vendor’s 6-month average',
    reason: 'Regional Landfill’s fuel surcharge has averaged ~$312 across the last 6 invoices. This statement charges $412.',
    cite: 'Line 2 · Fuel / energy surcharge',
  },
  {
    id: 'f2',
    sev: 'amber',
    icon: 'plus-circle',
    title: 'New “admin fee” $250 not seen on prior Regional Landfill invoices',
    reason: 'No administrative-fee line appears on the last 12 invoices from this vendor. Confirm it’s contractual before approving.',
    cite: 'Line 3 · Administrative fee',
  },
  {
    id: 'f3',
    sev: 'red',
    icon: 'copy',
    title: 'Possible duplicate of INV-1042 (same amount, 4 days apart)',
    reason: 'INV-1042 for $85,400.00 was received May 28 and is already scheduled. This invoice matches the amount to the cent.',
    cite: 'Header · Invoice # & amount',
  },
  {
    id: 'f4',
    sev: 'red',
    fraud: true,
    icon: 'shield-alert',
    title: 'Regional Landfill’s bank account changed since last payment',
    reason: 'Remit-to account ends ••7782; your last 14 payments went to ••3310. Verify the change with a known contact before paying — common vendor-impersonation pattern.',
    cite: 'Payment details · Remit-to',
  },
];

export type SevMeta = { label: string; solid: string; bg: string; ink: string };
export const SEV: Record<FlagSev, SevMeta> = {
  amber: { label: 'Review', solid: '--review-solid', bg: '--review-bg', ink: '--review-ink' },
  red: { label: 'High', solid: '--failed-solid', bg: '--failed-bg', ink: '--failed-ink' },
};
