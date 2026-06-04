// Settle — demo seed for Summit Waste Services.
// Run with: npm run db:seed  (requires DATABASE_URL in .env.local)
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as s from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Add it to .env.local before seeding.');
const db = drizzle(neon(url), { schema: s });

/* --------------------------- helpers --------------------------- */
const NOW = new Date('2026-06-03T16:00:00.000Z'); // demo "today"
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const c = (dollars: number) => Math.round(dollars * 100); // cents

const ORG = 'org-sws';

/* ----------------------------- users --------------------------- */
const USERS = [
  { id: 'user-dana', orgId: ORG, name: 'Dana Okafor', email: 'dana@summitwaste.example', role: 'clerk' as const, mono: 'DO', description: 'Capture bills, schedule payments' },
  { id: 'user-marcus', orgId: ORG, name: 'Marcus Reyes', email: 'marcus@summitwaste.example', role: 'approver' as const, mono: 'MR', description: 'Review and sign off on bills' },
  { id: 'user-lena', orgId: ORG, name: 'Lena Whitfield', email: 'lena@summitwaste.example', role: 'controller' as const, mono: 'LW', description: 'Full ledger + payment release' },
];

/* -------------------------- GL accounts ------------------------ */
const GLS = [
  { id: 'gl-fuel', orgId: ORG, code: '5010', name: 'Fuel', type: 'expense' as const },
  { id: 'gl-tipping', orgId: ORG, code: '5020', name: 'Tipping Fees', type: 'expense' as const },
  { id: 'gl-maint', orgId: ORG, code: '5030', name: 'Fleet Maintenance', type: 'expense' as const },
  { id: 'gl-equip', orgId: ORG, code: '1500', name: 'Equipment', type: 'asset' as const },
  { id: 'gl-ins', orgId: ORG, code: '5040', name: 'Insurance', type: 'expense' as const },
  { id: 'gl-soft', orgId: ORG, code: '5050', name: 'Software', type: 'expense' as const },
  { id: 'gl-office', orgId: ORG, code: '5060', name: 'Office', type: 'expense' as const },
  { id: 'gl-tires', orgId: ORG, code: '5035', name: 'Tires', type: 'expense' as const },
];

/* ---------------------------- vendors -------------------------- */
const VENDORS = [
  { id: 'v-landfill', name: 'Regional Landfill Authority', mono: 'RL', defaultGl: 'Tipping Fees', terms: 'net_30' as const, defaultMethod: 'ach' as const, bankLast4: '8830', cadence: 'monthly', email: 'billing@regionallandfill.example', phone: '(800) 555-0188', address: '1400 Transfer Station Rd, Tacoma, WA 98421', taxId: '91-1822041' },
  { id: 'v-wex', name: 'WEX Fleet Fuel', mono: 'WF', defaultGl: 'Fuel', terms: 'net_15' as const, defaultMethod: 'ach' as const, bankLast4: '0142', cadence: 'monthly', email: 'fleet-billing@wexinc.example', phone: '(800) 555-0142', address: '1 Hancock St, Portland, ME 04101', taxId: '01-0526993' },
  { id: 'v-travelers', name: 'Travelers', mono: 'TR', defaultGl: 'Insurance', terms: 'net_30' as const, defaultMethod: 'ach' as const, bankLast4: '5521', cadence: 'monthly', email: 'commercial@travelers.example', phone: '(866) 555-0100', address: '485 Lexington Ave, New York, NY 10017', taxId: '06-1234567' },
  { id: 'v-penske', name: 'Penske Truck Leasing', mono: 'PT', defaultGl: 'Equipment', terms: 'net_30' as const, defaultMethod: 'ach' as const, bankLast4: '3098', cadence: 'monthly', email: 'ar@penske.example', phone: '(800) 555-0177', address: '2675 Morgantown Rd, Reading, PA 19607', taxId: '23-1486328' },
  { id: 'v-heil', name: 'Heil Environmental', mono: 'HE', defaultGl: 'Fleet Maintenance', terms: 'net_45' as const, defaultMethod: 'check' as const, bankLast4: '7741', cadence: null, email: 'parts@heil.example', phone: '(866) 555-0143', address: '4301 Gault Ave N, Fort Payne, AL 35967', taxId: '62-0445789' },
  { id: 'v-mcneilus', name: 'McNeilus', mono: 'MC', defaultGl: 'Fleet Maintenance', terms: 'net_30' as const, defaultMethod: 'check' as const, bankLast4: '2210', cadence: null, email: 'service@mcneilus.example', phone: '(888) 555-0190', address: '524 County Rd 28, Dodge Center, MN 55927', taxId: '41-0993210' },
  { id: 'v-samsara', name: 'Samsara', mono: 'SA', defaultGl: 'Software', terms: 'net_30' as const, defaultMethod: 'card' as const, bankLast4: '4417', cadence: 'monthly', email: 'ar@samsara.example', phone: '(415) 555-0123', address: '1 De Haro St, San Francisco, CA 94107', taxId: '47-2871837' },
  { id: 'v-wastequip', name: 'Wastequip', mono: 'WQ', defaultGl: 'Equipment', terms: 'net_45' as const, defaultMethod: 'check' as const, bankLast4: '6650', cadence: null, email: 'orders@wastequip.example', phone: '(877) 555-0155', address: '6525 Morrison Blvd, Charlotte, NC 28211', taxId: '20-1573829' },
  { id: 'v-cintas', name: 'Cintas', mono: 'CN', defaultGl: 'Office', terms: 'net_15' as const, defaultMethod: 'ach' as const, bankLast4: '9921', cadence: 'weekly', email: 'billing@cintas.example', phone: '(800) 555-0166', address: '6800 Cintas Blvd, Mason, OH 45040', taxId: '31-1188630' },
  { id: 'v-pilot', name: 'Pilot Flying J', mono: 'PF', defaultGl: 'Fuel', terms: 'net_15' as const, defaultMethod: 'ach' as const, bankLast4: '1180', cadence: 'monthly', email: 'fleet@pilot.example', phone: '(865) 555-0111', address: '5508 Lonas Dr, Knoxville, TN 37909', taxId: '62-1543210' },
  { id: 'v-republic', name: 'Republic Services', mono: 'RS', defaultGl: 'Tipping Fees', terms: 'net_30' as const, defaultMethod: 'ach' as const, bankLast4: '4420', cadence: 'monthly', email: 'ap@republic.example', phone: '(800) 555-0120', address: '18500 N Allied Way, Phoenix, AZ 85054', taxId: '65-0716904' },
  { id: 'v-goodyear', name: 'Goodyear Commercial', mono: 'GY', defaultGl: 'Tires', terms: 'net_30' as const, defaultMethod: 'check' as const, bankLast4: '3370', cadence: null, email: 'fleet@goodyear.example', phone: '(800) 555-0130', address: '200 Innovation Way, Akron, OH 44316', taxId: '34-0253240' },
];

type Line = { description: string; qty?: number; unit?: number; amount: number; gl: string; kind?: 'expense' | 'item' };
type Flag = { type: (typeof s.flagType.enumValues)[number]; severity: 'high' | 'med' | 'low'; title: string; message: string; lineRef?: string; status?: 'open' | 'dismissed' | 'accepted' };
type Comment = { author: string; body: string; mentions?: string[]; daysAgo: number };
type SeedBill = {
  id: string; vendor: string; invoice: string; status: (typeof s.billStatus.enumValues)[number];
  issue: number; due: number | null; gl: string; memo?: string;
  lines: Line[]; tax?: number; flags?: Flag[]; comments?: Comment[];
  paidOn?: number; payMethod?: 'ach' | 'check' | 'wire' | 'card'; payRef?: string; payStatus?: 'scheduled' | 'paid' | 'failed';
  approvedBy?: string; submittedDaysAgo?: number;
};

const BILLS: SeedBill[] = [
  // ---- paid (history + aging) ----
  { id: 'b-rl-44102', vendor: 'v-landfill', invoice: 'INV-44102', status: 'paid', issue: -38, due: -33, gl: 'Tipping Fees', memo: 'April MSW disposal — Cedar Hills transfer',
    lines: [{ description: 'Tipping fees — MSW disposal', amount: 79250, gl: 'gl-tipping' }, { description: 'State environmental fee', amount: 2500, gl: 'gl-tipping' }],
    paidOn: -33, payMethod: 'ach', payRef: 'ACH-44102', payStatus: 'paid', approvedBy: 'user-marcus' },
  { id: 'b-wex-0428', vendor: 'v-wex', invoice: 'STMT-0428', status: 'paid', issue: -32, due: -26, gl: 'Fuel', memo: 'April fleet diesel — all depots',
    lines: [{ description: 'Diesel — fleet fuel (all depots)', qty: 13600, unit: 3.42, amount: 46512, gl: 'gl-fuel' }, { description: 'Fuel surcharge', amount: 1900, gl: 'gl-fuel' }, { description: 'Card & transaction fees', amount: 488, gl: 'gl-fuel' }],
    paidOn: -26, payMethod: 'ach', payRef: 'ACH-0428', payStatus: 'paid', approvedBy: 'user-marcus' },
  { id: 'b-cintas-4471', vendor: 'v-cintas', invoice: 'CIN-4471', status: 'paid', issue: -12, due: -6, gl: 'Office', memo: 'Uniform & mat service — May wk 4',
    lines: [{ description: 'Uniform rental + laundry', amount: 1810, gl: 'gl-office' }, { description: 'Facility mats', amount: 500, gl: 'gl-office' }],
    paidOn: -6, payMethod: 'ach', payRef: 'ACH-4471', payStatus: 'paid', approvedBy: 'user-marcus' },
  { id: 'b-republic-2210', vendor: 'v-republic', invoice: 'RS-2210', status: 'paid', issue: -70, due: -64, gl: 'Tipping Fees', memo: 'Overflow disposal — Q1',
    lines: [{ description: 'Roll-off disposal — overflow', amount: 14800, gl: 'gl-tipping' }],
    paidOn: -64, payMethod: 'ach', payRef: 'ACH-2210', payStatus: 'paid', approvedBy: 'user-lena' },
  { id: 'b-pilot-7781', vendor: 'v-pilot', invoice: 'PFJ-7781', status: 'paid', issue: -95, due: -88, gl: 'Fuel', memo: 'Over-road diesel — long-haul',
    lines: [{ description: 'Diesel — over-road', qty: 8200, unit: 3.38, amount: 27716, gl: 'gl-fuel' }],
    paidOn: -88, payMethod: 'ach', payRef: 'ACH-7781', payStatus: 'paid', approvedBy: 'user-lena' },

  // ---- failed payment ----
  { id: 'b-sam-09980', vendor: 'v-samsara', invoice: 'SAM-09980', status: 'approved', issue: -22, due: -18, gl: 'Software', memo: 'Telematics — May subscription',
    lines: [{ description: 'GPS / telematics — 42 vehicles', amount: 7900, gl: 'gl-soft' }],
    paidOn: -18, payMethod: 'card', payRef: 'CARD-09980', payStatus: 'failed', approvedBy: 'user-marcus' },

  // ---- overdue + flagged ----
  { id: 'b-rl-44871', vendor: 'v-landfill', invoice: 'INV-44871', status: 'pending_approval', issue: -8, due: -4, gl: 'Tipping Fees', memo: 'May MSW disposal — Cedar Hills transfer', submittedDaysAgo: 3,
    lines: [{ description: 'Tipping fees — MSW disposal', qty: 1340, unit: 62.57, amount: 83850, gl: 'gl-tipping' }, { description: 'Fuel / energy surcharge', amount: 1700, gl: 'gl-tipping' }, { description: 'State environmental fee', amount: 850, gl: 'gl-tipping' }],
    flags: [{ type: 'amount_deviation', severity: 'high', title: 'Tonnage 18% above 3-month average', message: '1,340 tons vs ~1,135 avg. Verify the haul logs for the period.', lineRef: 'Line 1 · Tipping fees' }],
    comments: [{ author: 'user-lena', body: 'Tonnage spike lines up with the Cedar Hills closure week. Confirm with ops before release.', mentions: ['user-marcus'], daysAgo: 2 }] },

  // ---- WEX cockpit bill (in approval, 3 flags, full timeline) ----
  { id: 'b-wex-0529', vendor: 'v-wex', invoice: 'STMT-0529', status: 'pending_approval', issue: -3, due: 6, gl: 'Fuel', memo: 'Fleet diesel — May statement (all depots)', submittedDaysAgo: 2,
    lines: [
      { description: 'Diesel — fleet fuel (all depots)', qty: 14200, unit: 3.42, amount: 48564, gl: 'gl-fuel' },
      { description: 'Fuel surcharge', qty: 1, unit: 2890, amount: 2890, gl: 'gl-fuel' },
      { description: 'Card & transaction fees', qty: 1, unit: 726, amount: 726, gl: 'gl-fuel' },
    ],
    flags: [
      { type: 'anomalous_surcharge', severity: 'high', title: 'Fuel surcharge 32% above 6-mo average', message: "This statement's surcharge is $2,890 vs ~$2,190 typical. WEX indexes the surcharge to the diesel spot price, which spiked in late May.", lineRef: 'Line 2 · Fuel surcharge' },
      { type: 'amount_deviation', severity: 'med', title: 'Unit price up 9% vs prior statement', message: '$3.42/gal this period vs $3.14/gal on STMT-0428. Above the 5% variance threshold on your Fuel GL.', lineRef: 'Line 1 · Diesel' },
      { type: 'amount_deviation', severity: 'low', title: 'Gallons 12% above monthly average', message: '14,200 gal vs ~12,700 gal trailing average. Within seasonal range for May; no action usually needed.', lineRef: 'Line 1 · Diesel' },
    ],
    comments: [
      { author: 'user-marcus', body: 'the fuel surcharge jumped again — can you confirm it against the contract before I approve?', mentions: ['user-lena'], daysAgo: 1 },
      { author: 'user-lena', body: "Pulled the WEX contract — the surcharge is indexed to the diesel spot price, so it's legitimate but high this month. OK to approve. I'll flag it in the month-end review.", mentions: ['user-marcus'], daysAgo: 1 },
    ] },

  // ---- due soon ----
  { id: 'b-travelers-06', vendor: 'v-travelers', invoice: 'TRV-2026-06', status: 'pending_approval', issue: -2, due: 7, gl: 'Insurance', memo: 'Commercial auto — June premium', submittedDaysAgo: 1,
    lines: [{ description: 'Commercial auto liability — fleet', amount: 39200, gl: 'gl-ins' }, { description: 'Cargo & environmental rider', amount: 5000, gl: 'gl-ins' }] },

  // ---- scheduled ----
  { id: 'b-penske-88120', vendor: 'v-penske', invoice: 'PEN-88120', status: 'scheduled', issue: -6, due: 9, gl: 'Equipment', memo: 'Truck lease — June (12 units)',
    lines: [{ description: 'Full-service lease — 12 roll-off trucks', amount: 29800, gl: 'gl-equip' }, { description: 'Maintenance reserve', amount: 1700, gl: 'gl-equip' }],
    paidOn: 9, payMethod: 'ach', payRef: 'ACH-88120', payStatus: 'scheduled', approvedBy: 'user-marcus' },
  { id: 'b-heil-5567', vendor: 'v-heil', invoice: 'HEIL-5567', status: 'scheduled', issue: -5, due: 9, gl: 'Fleet Maintenance', memo: 'Packer rebuild — unit 312',
    lines: [{ description: 'Hydraulic packer rebuild kit', amount: 14200, gl: 'gl-maint' }, { description: 'Labor — 38 hrs', qty: 38, unit: 125, amount: 4750, gl: 'gl-maint' }],
    paidOn: 9, payMethod: 'check', payRef: 'CHK-5567', payStatus: 'scheduled', approvedBy: 'user-marcus' },
  { id: 'b-penske-87655', vendor: 'v-penske', invoice: 'PEN-87655', status: 'scheduled', issue: -1, due: 17, gl: 'Equipment', memo: 'Truck lease — June (transfer fleet)',
    lines: [{ description: 'Full-service lease — transfer fleet', amount: 31500, gl: 'gl-equip' }],
    paidOn: 17, payMethod: 'ach', payRef: 'ACH-87655', payStatus: 'scheduled', approvedBy: 'user-lena' },

  // ---- needs review (flagged, no PO) ----
  { id: 'b-mcn-3391', vendor: 'v-mcneilus', invoice: 'MCN-3391', status: 'pending_approval', issue: -4, due: 11, gl: 'Fleet Maintenance', memo: 'Body & hoist parts — units 207, 311', submittedDaysAgo: 1,
    lines: [{ description: 'Hoist cylinder assembly', amount: 6200, gl: 'gl-maint' }, { description: 'Tailgate seal kit', amount: 1420, gl: 'gl-maint' }, { description: 'Freight', amount: 1800, gl: 'gl-maint' }],
    flags: [{ type: 'missing_po', severity: 'med', title: 'No matching PO for line items over $5,000', message: 'Hoist cylinder assembly ($6,200) has no purchase order on file. Procurement policy requires a PO above $5,000.', lineRef: 'Line 1 · Hoist cylinder assembly' }] },

  // ---- in approval, flagged ----
  { id: 'b-sam-10044', vendor: 'v-samsara', invoice: 'SAM-10044', status: 'pending_approval', issue: -1, due: 13, gl: 'Software', memo: 'Telematics — June subscription', submittedDaysAgo: 1,
    lines: [{ description: 'GPS / telematics — 44 vehicles', amount: 7900, gl: 'gl-soft' }],
    flags: [{ type: 'amount_deviation', severity: 'med', title: 'Unit price up 12% vs prior contract term', message: 'Per-vehicle rate rose from $160 to $179.55. Confirm the renewal terms were approved.', lineRef: 'Line 1 · Telematics' }] },

  // ---- drafts ----
  { id: 'b-cintas-4490', vendor: 'v-cintas', invoice: 'CIN-4490', status: 'draft', issue: -1, due: 15, gl: 'Office', memo: 'Uniform & mat service — June wk 1',
    lines: [{ description: 'Uniform rental + laundry', amount: 1810, gl: 'gl-office' }, { description: 'Facility mats', amount: 500, gl: 'gl-office' }],
    flags: [{ type: 'possible_duplicate', severity: 'low', title: 'Possible duplicate of CIN-4471', message: 'Same vendor and amount ($2,310.00) as CIN-4471 paid on May 28. Confirm this is the new weekly cycle, not a re-bill.' }] },
  { id: 'b-wastequip-7720', vendor: 'v-wastequip', invoice: 'WQ-7720', status: 'draft', issue: -2, due: null, gl: 'Equipment', memo: '20-yd roll-off containers (qty 8)',
    lines: [{ description: '20-yard roll-off containers', qty: 8, unit: 2845, amount: 22760, gl: 'gl-equip' }, { description: 'Freight & delivery', amount: 2000, gl: 'gl-equip' }] },

  // ---- extra aging fillers ----
  { id: 'b-goodyear-3370', vendor: 'v-goodyear', invoice: 'GY-3370', status: 'approved', issue: -55, due: -25, gl: 'Tires', memo: 'Drive tires — 18 units',
    lines: [{ description: 'Commercial drive tires (set)', qty: 18, unit: 612, amount: 11016, gl: 'gl-tires' }] },
  { id: 'b-heil-5501', vendor: 'v-heil', invoice: 'HEIL-5501', status: 'approved', issue: -100, due: -70, gl: 'Fleet Maintenance', memo: 'Brake service — Q1 fleet',
    lines: [{ description: 'Brake service — 9 units', amount: 8650, gl: 'gl-maint' }] },
];

/* ------------------------- activity log ------------------------ */
const ACTIVITY = [
  { actor: 'user-marcus', type: 'approved', text: 'approved', target: 'Heil Environmental', amount: c(18950), daysAgo: 0, meta: null as string | null, quote: null as string | null },
  { actor: 'user-dana', type: 'scheduled', text: 'scheduled', target: 'Penske Truck Leasing', amount: c(31500), daysAgo: 0, meta: 'for Jun 12', quote: null },
  { actor: 'user-lena', type: 'commented', text: 'commented on', target: 'WEX Fleet Fuel', amount: null, daysAgo: 0, meta: null, quote: 'Confirm surcharge with vendor before approving.' },
  { actor: 'v-travelers', type: 'failed', text: 'payment failed', target: 'Travelers', amount: c(44200), daysAgo: 0, meta: 'insufficient funds in Operating ••4821', quote: null },
  { actor: 'system', type: 'synced', text: 'synced 14 bills from QuickBooks', target: null, amount: null, daysAgo: 0, meta: null, quote: null },
  { actor: 'user-dana', type: 'created', text: 'created', target: 'Wastequip', amount: c(24760), daysAgo: -1, meta: 'as draft', quote: null },
  { actor: 'user-marcus', type: 'approved', text: 'approved', target: 'Samsara', amount: c(7900), daysAgo: -1, meta: null, quote: null },
];

/* ----------------------------- run ----------------------------- */
let seq = 0;
const nid = (p: string) => `${p}-${(++seq).toString().padStart(4, '0')}`;

async function main() {
  console.info('Clearing existing data…');
  await db.delete(s.activityLog);
  await db.delete(s.billComments);
  await db.delete(s.payments);
  await db.delete(s.approvalEvents);
  await db.delete(s.billFlags);
  await db.delete(s.billLineItems);
  await db.delete(s.bills);
  await db.delete(s.vendors);
  await db.delete(s.glAccounts);
  await db.delete(s.users);
  await db.delete(s.organizations);

  console.info('Seeding org, users, GL accounts, vendors…');
  await db.insert(s.organizations).values({ id: ORG, name: 'Summit Waste Services', sub: 'Operating · ••4821', mono: 'SW' });
  await db.insert(s.users).values(USERS);
  await db.insert(s.glAccounts).values(GLS);
  await db.insert(s.vendors).values(VENDORS.map((v) => ({ ...v, orgId: ORG, status: 'active' })));

  console.info(`Seeding ${BILLS.length} bills with line items, flags, payments, comments…`);
  for (const b of BILLS) {
    const subtotal = b.lines.reduce((sum, l) => sum + c(l.amount), 0);
    const tax = b.tax != null ? c(b.tax) : 0;
    const total = subtotal + tax;
    const hasOpenFlags = (b.flags ?? []).some((f) => (f.status ?? 'open') === 'open');

    await db.insert(s.bills).values({
      id: b.id, orgId: ORG, vendorId: b.vendor, invoiceNumber: b.invoice, status: b.status,
      reviewStatus: hasOpenFlags ? 'flagged' : 'clean',
      ocrStatus: 'done',
      issueDate: day(b.issue), dueDate: b.due == null ? null : day(b.due),
      subtotalCents: subtotal, taxCents: tax, totalCents: total,
      memo: b.memo, glAccount: b.gl, attachmentUrl: `/invoices/${b.invoice}.pdf`,
      createdBy: 'user-dana',
      submittedAt: b.submittedDaysAgo != null ? day(-b.submittedDaysAgo) : null,
      approvedBy: b.approvedBy ?? null,
      approvedAt: b.approvedBy ? day(b.issue + 1) : null,
      scheduledPayDate: b.payStatus === 'scheduled' && b.paidOn != null ? day(b.paidOn) : null,
      paidAt: b.payStatus === 'paid' && b.paidOn != null ? day(b.paidOn) : null,
      createdAt: day(b.issue),
    });

    await db.insert(s.billLineItems).values(
      b.lines.map((l, i) => ({
        id: nid('line'), billId: b.id, description: l.description,
        quantity: l.qty ?? null, unitPriceCents: l.unit != null ? c(l.unit) : null,
        amountCents: c(l.amount), glAccountId: l.gl, glLabel: GLS.find((g) => g.id === l.gl)?.name ?? null,
        kind: l.kind ?? 'expense', sortOrder: i,
      })),
    );

    if (b.flags?.length) {
      await db.insert(s.billFlags).values(
        b.flags.map((f) => ({
          id: nid('flag'), billId: b.id, type: f.type, severity: f.severity,
          title: f.title, message: f.message, lineRef: f.lineRef ?? null, status: f.status ?? 'open',
        })),
      );
    }

    if (b.submittedDaysAgo != null) {
      await db.insert(s.approvalEvents).values({ id: nid('appr'), billId: b.id, actorId: 'user-dana', action: 'submit', createdAt: day(-b.submittedDaysAgo) });
    }
    if (b.approvedBy) {
      await db.insert(s.approvalEvents).values({ id: nid('appr'), billId: b.id, actorId: b.approvedBy, action: 'approve', note: null, createdAt: day(b.issue + 1) });
    }

    if (b.payStatus && b.paidOn != null) {
      await db.insert(s.payments).values({
        id: nid('pay'), billId: b.id, amountCents: total, method: b.payMethod ?? 'ach',
        payDate: day(b.paidOn), status: b.payStatus, referenceNumber: b.payRef ?? null, createdBy: 'user-dana',
      });
    }

    if (b.comments?.length) {
      await db.insert(s.billComments).values(
        b.comments.map((cm) => ({
          id: nid('cmt'), billId: b.id, authorId: cm.author, body: cm.body,
          mentions: cm.mentions ?? [], createdAt: day(-cm.daysAgo),
        })),
      );
    }
  }

  console.info(`Seeding ${ACTIVITY.length} activity entries…`);
  await db.insert(s.activityLog).values(
    ACTIVITY.map((a) => ({
      id: nid('act'), orgId: ORG, billId: null,
      actorId: a.actor, type: a.type, text: a.text, target: a.target,
      amountCents: a.amount, meta: a.meta, quote: a.quote, createdAt: day(a.daysAgo),
    })),
  );

  console.info('✓ Seed complete.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
