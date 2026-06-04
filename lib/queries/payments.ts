import { db } from '@/db';
import { bills } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEMO_ORG } from '@/lib/demo';
import { formatShortDate } from '@/lib/dates';
import type {
  ModalBill,
  ModalMethod,
  PaymentMethodKey,
  PaymentModal,
  PaymentRow,
  PaymentStatusKey,
} from '@/lib/data/payments';

// Schedule-payment modal method options (presentation copy; mirrors the static design).
const MODAL_METHODS: ModalMethod[] = [
  { id: 'ach', label: 'ACH', sub: 'Operating ••4821 · free · 1–2 days', icon: 'building' },
  { id: 'wire', label: 'Wire', sub: 'Operating ••4821 · $15 · same day', icon: 'arrow-left-right' },
  { id: 'check', label: 'Check', sub: 'Mailed · 5–7 days', icon: 'scroll-text' },
];

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: 'Due on receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

export type PaymentsData = {
  scheduled: PaymentRow[];
  paid: PaymentRow[];
  schedTotal: number;
  paidTotal: number;
  paidCount: number;
  failedTotal: number;
  failedCount: number;
  modal: PaymentModal | null;
};

export async function getPaymentsData(): Promise<PaymentsData> {
  const billRows = await db.query.bills.findMany({
    where: eq(bills.orgId, DEMO_ORG),
    with: { vendor: true, payments: true },
  });

  type Flat = { payment: (typeof billRows)[number]['payments'][number]; bill: (typeof billRows)[number] };
  const flat: Flat[] = billRows.flatMap((b) => b.payments.map((payment) => ({ payment, bill: b })));

  const toRow = (f: Flat): PaymentRow => ({
    id: f.payment.id,
    billId: f.bill.id,
    vendor: f.bill.vendor.name,
    mono: f.bill.vendor.mono,
    amount: f.payment.amountCents / 100,
    bills: 1, // one payment per bill in the current data; consolidation hint hides at 1
    method: f.payment.method as PaymentMethodKey,
    date: f.payment.payDate ? formatShortDate(f.payment.payDate) : '—',
    status: f.payment.status as PaymentStatusKey,
    ref: f.payment.referenceNumber ?? '—',
  });

  const byDate = (a: Flat, b: Flat) =>
    (a.payment.payDate?.getTime() ?? 0) - (b.payment.payDate?.getTime() ?? 0);

  const scheduled = flat
    .filter((f) => f.payment.status === 'scheduled' || f.payment.status === 'processing')
    .sort(byDate)
    .map(toRow);

  // Paid tab shows cleared and failed payments (failed surfaces as "needs attention").
  const paid = flat
    .filter((f) => f.payment.status === 'paid' || f.payment.status === 'failed')
    .sort((a, b) => byDate(b, a))
    .map(toRow);

  const schedTotal = scheduled.reduce((s, r) => s + r.amount, 0);
  const paidRows = paid.filter((r) => r.status === 'paid');
  const paidTotal = paidRows.reduce((s, r) => s + r.amount, 0);
  const failedRows = paid.filter((r) => r.status === 'failed');
  const failedTotal = failedRows.reduce((s, r) => s + r.amount, 0);

  // Schedule-payment modal: pick the vendor with the most open (approved/scheduled,
  // not-yet-paid) bills so the consolidation story has something to show.
  const open = billRows.filter(
    (b) =>
      (b.status === 'approved' || b.status === 'scheduled') &&
      b.paidAt == null,
  );
  const byVendor = new Map<string, typeof open>();
  for (const b of open) {
    const arr = byVendor.get(b.vendorId) ?? [];
    arr.push(b);
    byVendor.set(b.vendorId, arr);
  }
  let bestVendorId: string | null = null;
  let bestCount = 0;
  for (const [vid, arr] of byVendor) {
    if (arr.length > bestCount) {
      bestCount = arr.length;
      bestVendorId = vid;
    }
  }

  let modal: PaymentModal | null = null;
  if (bestVendorId) {
    const vendorBills = (byVendor.get(bestVendorId) ?? []).sort(
      (a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
    );
    const vendor = vendorBills[0].vendor;
    const openBills: ModalBill[] = vendorBills.map((b, i) => ({
      id: b.id,
      inv: b.invoiceNumber,
      due: b.dueDate ? formatShortDate(b.dueDate) : '—',
      amount: b.totalCents / 100,
      gl: b.glAccount ?? '',
      checked: i < 2, // preselect the two nearest-due bills
    }));
    modal = {
      vendor: vendor.name,
      mono: vendor.mono,
      terms: TERMS_LABEL[vendor.terms] ?? vendor.terms,
      openBills,
      methods: MODAL_METHODS,
    };
  }

  return {
    scheduled,
    paid,
    schedTotal,
    paidTotal,
    paidCount: paidRows.length,
    failedTotal,
    failedCount: failedRows.length,
    modal,
  };
}
