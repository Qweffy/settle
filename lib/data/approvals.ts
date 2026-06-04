// Settle — Approvals queue data (viewing as Approver: Marcus Reyes)

export type ApprovalSev = 'high' | 'med';

export const SEV: Record<ApprovalSev, { label: string; solid: string; bg: string; ink: string }> = {
  high: { label: 'High', solid: '--failed-solid', bg: '--failed-bg', ink: '--failed-ink' },
  med: { label: 'Medium', solid: '--review-solid', bg: '--review-bg', ink: '--review-ink' },
};

export type ApprovalUrgency = 'overdue' | 'soon' | 'later';

export type BillLine = { desc: string; amount: number; gl: string };

export type ApprovalFlag = { sev: ApprovalSev; title: string; reason: string };

export type ApprovalBill = {
  id: string;
  urgency: ApprovalUrgency;
  vendor: string;
  mono: string;
  inv: string;
  amount: number;
  gl: string;
  due: string;
  dueHint: string;
  issued: string;
  terms: string;
  method: string;
  account: string;
  summary: string;
  flagged: boolean;
  submittedBy: string;
  submittedMono: string;
  submittedTime: string;
  requiresSecond: boolean;
  secondApprover?: string;
  lines: BillLine[];
  flags: ApprovalFlag[];
};

// bills awaiting MY (Marcus's) approval, with a cockpit summary for the preview
export const BILLS: ApprovalBill[] = [
  {
    id: 'b1', urgency: 'overdue', vendor: 'Regional Landfill Authority', mono: 'RL',
    inv: 'INV-44871', amount: 86400.0, gl: 'Tipping Fees', due: 'May 30', dueHint: '4d overdue',
    issued: 'May 28, 2026', terms: 'Net 30', method: 'ACH', account: 'Operating ••4821',
    summary: 'Flagged: tonnage 18% above the trailing 3-month average.', flagged: true,
    submittedBy: 'Dana Okafor', submittedMono: 'DO', submittedTime: 'Jun 1',
    requiresSecond: true, secondApprover: 'Lena Whitfield',
    lines: [
      { desc: 'Tipping fees — MSW disposal', amount: 83850.0, gl: 'Tipping Fees' },
      { desc: 'Fuel / energy surcharge', amount: 1700.0, gl: 'Tipping Fees' },
      { desc: 'State environmental fee', amount: 850.0, gl: 'Tipping Fees' },
    ],
    flags: [
      { sev: 'high', title: 'Tonnage 18% above 3-month average', reason: '1,340 tons vs ~1,135 avg. Verify the haul logs for the period.' },
    ],
  },
  {
    id: 'b2', urgency: 'soon', vendor: 'WEX Fleet Fuel', mono: 'WF',
    inv: 'STMT-0529', amount: 52180.0, gl: 'Fuel', due: 'Jun 9', dueHint: 'due in 6d',
    issued: 'May 31, 2026', terms: 'Net 9', method: 'ACH', account: 'Operating ••4821',
    summary: 'Flagged: fuel surcharge 32% above the 6-month average.', flagged: true,
    submittedBy: 'Dana Okafor', submittedMono: 'DO', submittedTime: 'Jun 1',
    requiresSecond: true, secondApprover: 'Lena Whitfield',
    lines: [
      { desc: 'Diesel — fleet fuel (all depots)', amount: 48564.0, gl: 'Fuel' },
      { desc: 'Fuel surcharge', amount: 2890.0, gl: 'Fuel' },
      { desc: 'Card & transaction fees', amount: 726.0, gl: 'Fuel' },
    ],
    flags: [
      { sev: 'high', title: 'Fuel surcharge 32% above 6-mo average', reason: '$2,890 vs ~$2,190 typical. Indexed to the diesel spot price.' },
      { sev: 'med', title: 'Unit price up 9% vs prior statement', reason: '$3.42/gal vs $3.14/gal on STMT-0428.' },
    ],
  },
  {
    id: 'b3', urgency: 'soon', vendor: 'Travelers', mono: 'TR',
    inv: 'TRV-2026-06', amount: 44200.0, gl: 'Insurance', due: 'Jun 10', dueHint: 'due in 7d',
    issued: 'Jun 1, 2026', terms: 'Net 30', method: 'ACH', account: 'Operating ••4821',
    summary: 'Recurring monthly auto-insurance premium, unchanged from last month.', flagged: false,
    submittedBy: 'Dana Okafor', submittedMono: 'DO', submittedTime: 'Jun 2',
    requiresSecond: false,
    lines: [
      { desc: 'Commercial auto — fleet premium', amount: 44200.0, gl: 'Insurance' },
    ],
    flags: [],
  },
  {
    id: 'b4', urgency: 'later', vendor: 'McNeilus', mono: 'MC',
    inv: 'MCN-3391', amount: 9420.0, gl: 'Fleet Maintenance', due: 'Jun 14', dueHint: 'due in 11d',
    issued: 'Jun 2, 2026', terms: 'Net 15', method: 'ACH', account: 'Operating ••4821',
    summary: 'Flagged: no matching PO for line items over $5,000.', flagged: true,
    submittedBy: 'Dana Okafor', submittedMono: 'DO', submittedTime: 'Jun 2',
    requiresSecond: false,
    lines: [
      { desc: 'Hydraulic cylinder rebuild — Unit 214', amount: 6120.0, gl: 'Fleet Maintenance' },
      { desc: 'Packer blade set', amount: 2480.0, gl: 'Fleet Maintenance' },
      { desc: 'Shop labor — 12 hrs', amount: 820.0, gl: 'Fleet Maintenance' },
    ],
    flags: [
      { sev: 'med', title: 'No matching PO for lines over $5,000', reason: 'The $6,120 cylinder rebuild has no purchase order on file.' },
    ],
  },
  {
    id: 'b5', urgency: 'later', vendor: 'Samsara', mono: 'SA',
    inv: 'SAM-10044', amount: 7900.0, gl: 'Software', due: 'Jun 16', dueHint: 'due in 13d',
    issued: 'Jun 1, 2026', terms: 'Net 15', method: 'Card', account: 'AP Card ••6620',
    summary: 'Recurring telematics subscription, in line with history.', flagged: false,
    submittedBy: 'Dana Okafor', submittedMono: 'DO', submittedTime: 'Jun 1',
    requiresSecond: false,
    lines: [
      { desc: 'GPS & telematics — 142 vehicles', amount: 7100.0, gl: 'Software' },
      { desc: 'Driver safety add-on', amount: 800.0, gl: 'Software' },
    ],
    flags: [],
  },
];

export type ApprovalGroup = { id: ApprovalUrgency; label: string; tone: string; note: string };

export const GROUPS: ApprovalGroup[] = [
  { id: 'overdue', label: 'Overdue', tone: '--failed-solid', note: 'Pay immediately' },
  { id: 'soon', label: 'Due soon', tone: '--overdue-solid', note: 'This week' },
  { id: 'later', label: 'Later', tone: '--fg-3', note: 'Next 2 weeks' },
];
