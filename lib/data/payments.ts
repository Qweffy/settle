// Settle — Payments data

export type PaymentMethodKey = 'ach' | 'wire' | 'check' | 'card';

export const METHODS: Record<PaymentMethodKey, { label: string; icon: string; sub: string }> = {
  ach: { label: 'ACH', icon: 'building', sub: 'Operating ••4821' },
  wire: { label: 'Wire', icon: 'arrow-left-right', sub: 'Operating ••4821' },
  check: { label: 'Check', icon: 'scroll-text', sub: 'mailed' },
  card: { label: 'Card', icon: 'credit-card', sub: 'AP Card ••6620' },
};

export type PaymentStatusKey = 'scheduled' | 'processing' | 'paid' | 'failed';

export const STATUS: Record<PaymentStatusKey, { label: string; bg: string; ink: string; solid: string }> = {
  scheduled: { label: 'Scheduled', bg: '--scheduled-bg', ink: '--scheduled-ink', solid: '--scheduled-solid' },
  processing: { label: 'Processing', bg: '--approval-bg', ink: '--approval-ink', solid: '--approval-solid' },
  paid: { label: 'Paid', bg: '--paid-bg', ink: '--paid-ink', solid: '--paid-solid' },
  failed: { label: 'Failed', bg: '--failed-bg', ink: '--failed-ink', solid: '--failed-solid' },
};

export type PaymentRow = {
  id: string;
  billId: string;
  vendor: string;
  mono: string;
  amount: number;
  bills: number;
  method: PaymentMethodKey;
  date: string;
  status: PaymentStatusKey;
  ref: string;
};

// scheduled payments (upcoming)
export const SCHEDULED: PaymentRow[] = [
  { id: 's1', billId: 'b-pen-88120', vendor: 'Penske Truck Leasing', mono: 'PT', amount: 63000.0, bills: 2, method: 'ach', date: 'Jun 12', status: 'scheduled', ref: 'PMT-20614' },
  { id: 's2', billId: 'b-heil-18950', vendor: 'Heil Environmental', mono: 'HE', amount: 18950.0, bills: 1, method: 'ach', date: 'Jun 12', status: 'scheduled', ref: 'PMT-20615' },
  { id: 's3', billId: 'b-rla-44871', vendor: 'Regional Landfill Authority', mono: 'RL', amount: 86400.0, bills: 1, method: 'wire', date: 'Jun 13', status: 'processing', ref: 'PMT-20616' },
  { id: 's4', billId: 'b-sam-10044', vendor: 'Samsara', mono: 'SA', amount: 7900.0, bills: 1, method: 'card', date: 'Jun 16', status: 'scheduled', ref: 'PMT-20617' },
  { id: 's5', billId: 'b-wq-24760', vendor: 'Wastequip', mono: 'WQ', amount: 24760.0, bills: 1, method: 'check', date: 'Jun 18', status: 'scheduled', ref: 'PMT-20618' },
];

// paid payments (history)
export const PAID: PaymentRow[] = [
  { id: 'p1', billId: 'b-rla-43900', vendor: 'Regional Landfill Authority', mono: 'RL', amount: 81750.0, bills: 1, method: 'wire', date: 'May 1', status: 'paid', ref: 'PMT-20588' },
  { id: 'p2', billId: 'b-wex-0428', vendor: 'WEX Fleet Fuel', mono: 'WF', amount: 48900.0, bills: 1, method: 'ach', date: 'May 8', status: 'paid', ref: 'PMT-20590' },
  { id: 'p3', billId: 'b-cintas-4620', vendor: 'Cintas', mono: 'CN', amount: 4620.0, bills: 2, method: 'ach', date: 'May 28', status: 'paid', ref: 'PMT-20601' },
  { id: 'p4', billId: 'b-trv-44200', vendor: 'Travelers', mono: 'TR', amount: 44200.0, bills: 1, method: 'ach', date: 'May 16', status: 'failed', ref: 'PMT-20595' },
  { id: 'p5', billId: 'b-mcn-12300', vendor: 'McNeilus', mono: 'MC', amount: 12300.0, bills: 1, method: 'check', date: 'May 12', status: 'paid', ref: 'PMT-20593' },
  { id: 'p6', billId: 'b-heil-16480', vendor: 'Heil Environmental', mono: 'HE', amount: 16480.0, bills: 1, method: 'ach', date: 'May 9', status: 'paid', ref: 'PMT-20591' },
];

export type ModalBill = { id: string; inv: string; due: string; amount: number; gl: string; checked: boolean };
export type ModalMethod = { id: PaymentMethodKey; label: string; sub: string; icon: string };

export type PaymentModal = {
  vendor: string;
  mono: string;
  terms: string;
  openBills: ModalBill[];
  methods: ModalMethod[];
};

// --- schedule payment modal: a vendor with multiple approved open bills (to show consolidation) ---
export const MODAL: PaymentModal = {
  vendor: 'Penske Truck Leasing', mono: 'PT', terms: 'Net 30',
  openBills: [
    { id: 'm1', inv: 'PEN-88120', due: 'Jun 12', amount: 31500.0, gl: 'Equipment', checked: true },
    { id: 'm2', inv: 'PEN-87655', due: 'Jun 20', amount: 31500.0, gl: 'Equipment', checked: true },
    { id: 'm3', inv: 'PEN-87102', due: 'Jul 2', amount: 28900.0, gl: 'Equipment', checked: false },
  ],
  methods: [
    { id: 'ach', label: 'ACH', sub: 'Operating ••4821 · free · 1–2 days', icon: 'building' },
    { id: 'wire', label: 'Wire', sub: 'Operating ••4821 · $15 · same day', icon: 'arrow-left-right' },
    { id: 'check', label: 'Check', sub: 'Mailed · 5–7 days', icon: 'scroll-text' },
  ],
};
