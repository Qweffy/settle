// Settle — Vendor detail: Regional Landfill Authority
import type { StatusKey } from './shell';

export type Vendor = {
  name: string;
  mono: string;
  category: string;
  vendorId: string;
  terms: string;
  method: string;
  account: string;
  bankChanged: boolean;
  status: string;
  since: string;
  contact: string;
  phone: string;
  address: string;
  taxMasked: string;
};

export const VENDOR: Vendor = {
  name: 'Regional Landfill Authority',
  mono: 'RL',
  category: 'Tipping fees · Disposal',
  vendorId: 'VEND-0042',
  terms: 'Net 30',
  method: 'ACH',
  account: '••1234',
  bankChanged: true,
  status: 'active',
  since: 'Vendor since 2019',
  contact: 'billing@regionallandfill.example',
  phone: '(253) 555-0142',
  address: 'Cedar Hills Transfer Station · Tacoma, WA',
  taxMasked: '91-••••204',
};

export type VendorScore = {
  label: string;
  value: string;
  sub: string;
  delta: string;
  dir: 'up' | 'down';
  tone: 'neutral' | 'bad' | 'good';
};

export const SCORE: VendorScore[] = [
  { label: 'Total spent YTD', value: '$486,320', sub: 'across 14 bills', delta: '+6.2%', dir: 'up', tone: 'neutral' },
  { label: 'On-time payment rate', value: '93%', sub: '13 of 14 on time', delta: '+2 pts', dir: 'up', tone: 'good' },
  { label: 'Avg days to pay', value: '27.4', sub: 'days · terms Net 30', delta: '−1.8d', dir: 'down', tone: 'good' },
  { label: 'Open bills', value: '2', sub: '$86,400 outstanding', delta: '1 overdue', dir: 'up', tone: 'bad' },
];

export type TrendPoint = { m: string; v: number };

// tipping-fee surcharge trend (last 6 months, $ per statement)
export const TREND: TrendPoint[] = [
  { m: 'Dec', v: 268 },
  { m: 'Jan', v: 281 },
  { m: 'Feb', v: 305 },
  { m: 'Mar', v: 298 },
  { m: 'Apr', v: 352 },
  { m: 'May', v: 412 },
];

export const TREND_AVG = 319;

export type HistoryStatus = 'paid' | 'overdue' | 'scheduled';
export type HistoryBill = {
  inv: string;
  amount: number;
  status: HistoryStatus;
  issued: string;
  paid: string;
};

// bills history
export const HISTORY: HistoryBill[] = [
  { inv: 'INV-44871', amount: 86400.0, status: 'overdue', issued: 'May 28', paid: '—' },
  { inv: 'INV-44102', amount: 81750.0, status: 'paid', issued: 'May 1', paid: 'May 1' },
  { inv: 'INV-43388', amount: 79980.0, status: 'paid', issued: 'Apr 2', paid: 'Apr 4' },
  { inv: 'INV-42710', amount: 77420.0, status: 'paid', issued: 'Mar 3', paid: 'Mar 6' },
  { inv: 'INV-42044', amount: 74900.0, status: 'paid', issued: 'Feb 1', paid: 'Feb 2' },
  { inv: 'INV-41390', amount: 72180.0, status: 'paid', issued: 'Jan 3', paid: 'Jan 9' },
  { inv: 'INV-40722', amount: 70540.0, status: 'paid', issued: 'Dec 2', paid: 'Dec 4' },
  { inv: 'INV-40044', amount: 68910.0, status: 'paid', issued: 'Nov 1', paid: 'Nov 1' },
];

export type StatusMeta = { label: string; bg: string; ink: string; solid: string };

export const STATUS: Record<HistoryStatus, StatusMeta> = {
  paid: { label: 'Paid', bg: '--paid-bg', ink: '--paid-ink', solid: '--paid-solid' },
  overdue: { label: 'Overdue', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
  scheduled: { label: 'Scheduled', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
};

export type { StatusKey };
