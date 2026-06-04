// Settle — AP Aging report data
export type Bucket = {
  id: string;
  label: string;
  tone: string;
  color: string;
};

// aging buckets — tone escalates with age
export const BUCKETS: Bucket[] = [
  { id: 'current', label: 'Current', tone: 'paid', color: '--paid-solid' },
  { id: 'b30', label: '1–30 days', tone: 'scheduled', color: '--scheduled-solid' },
  { id: 'b60', label: '31–60 days', tone: 'review', color: '--review-solid' },
  { id: 'b90', label: '61–90 days', tone: 'overdue', color: '--overdue-solid' },
  { id: 'b90plus', label: '90+ days', tone: 'failed', color: '--failed-solid' },
];

export type AgingRow = {
  vendor: string;
  mono: string;
  gl: string;
  cells: number[];
};

// vendor × bucket matrix [current, 1-30, 31-60, 61-90, 90+]
export const ROWS: AgingRow[] = [
  { vendor: 'Regional Landfill Authority', mono: 'RL', gl: 'Tipping Fees', cells: [0, 0, 86400.0, 0, 0] },
  { vendor: 'WEX Fleet Fuel', mono: 'WF', gl: 'Fuel', cells: [0, 52180.0, 0, 0, 0] },
  { vendor: 'Travelers', mono: 'TR', gl: 'Insurance', cells: [44200.0, 0, 0, 0, 0] },
  { vendor: 'Penske Truck Leasing', mono: 'PT', gl: 'Equipment', cells: [63000.0, 0, 0, 0, 0] },
  { vendor: 'Heil Environmental', mono: 'HE', gl: 'Fleet Maintenance', cells: [18950.0, 0, 0, 0, 0] },
  { vendor: 'McNeilus', mono: 'MC', gl: 'Fleet Maintenance', cells: [9420.0, 0, 0, 0, 0] },
  { vendor: 'Wastequip', mono: 'WQ', gl: 'Equipment', cells: [0, 24760.0, 0, 0, 0] },
  { vendor: 'Samsara', mono: 'SA', gl: 'Software', cells: [7900.0, 0, 0, 0, 0] },
  { vendor: 'Cintas', mono: 'CN', gl: 'Office', cells: [2310.0, 0, 2310.0, 0, 0] },
  { vendor: 'Pacific Equipment Repair', mono: 'PE', gl: 'Fleet Maintenance', cells: [0, 0, 0, 14800.0, 0] },
  { vendor: 'Northwest Tire Co.', mono: 'NW', gl: 'Fleet Maintenance', cells: [0, 0, 0, 0, 6240.0] },
];

// column totals
export const COL_TOTALS: number[] = BUCKETS.map((_, i) => ROWS.reduce((s, r) => s + r.cells[i], 0));
export const GRAND: number = COL_TOTALS.reduce((s, v) => s + v, 0);
