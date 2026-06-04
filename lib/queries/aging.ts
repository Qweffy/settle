import { db } from '@/db';
import { bills } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DEMO_NOW, DEMO_ORG } from '@/lib/demo';
import { daysBetween } from '@/lib/dates';
import type { AgingRow } from '@/lib/data/aging';

const OPEN = new Set(['draft', 'pending_approval', 'approved', 'scheduled']);
const BUCKET_COUNT = 5;

// Maps a bill's overdue age (days past due, from DEMO_NOW) to its aging-bucket index.
// 0 = Current (not yet due / undated), 1 = 1–30, 2 = 31–60, 3 = 61–90, 4 = 90+.
function bucketIndex(dueDate: Date | null): number {
  if (dueDate == null) return 0;
  const overdue = daysBetween(DEMO_NOW, dueDate);
  if (overdue <= 0) return 0;
  if (overdue <= 30) return 1;
  if (overdue <= 60) return 2;
  if (overdue <= 90) return 3;
  return 4;
}

export type AgingData = {
  rows: AgingRow[];
  colTotals: number[];
  grand: number;
};

export async function getAgingData(): Promise<AgingData> {
  const billRows = await db.query.bills.findMany({
    where: eq(bills.orgId, DEMO_ORG),
    with: { vendor: true },
  });

  const open = billRows.filter((b) => OPEN.has(b.status));

  // Accumulate per-vendor bucket sums (in cents) keyed by vendor id.
  type Acc = { vendor: string; mono: string; gl: string; cells: number[] };
  const byVendor = new Map<string, Acc>();
  for (const b of open) {
    const id = b.vendor.id;
    let acc = byVendor.get(id);
    if (!acc) {
      acc = {
        vendor: b.vendor.name,
        mono: b.vendor.mono,
        gl: b.vendor.defaultGl ?? '',
        cells: Array(BUCKET_COUNT).fill(0),
      };
      byVendor.set(id, acc);
    }
    acc.cells[bucketIndex(b.dueDate)] += b.totalCents;
  }

  const rows: AgingRow[] = [...byVendor.values()]
    .map((a) => ({
      vendor: a.vendor,
      mono: a.mono,
      gl: a.gl,
      cells: a.cells.map((cents) => cents / 100),
    }))
    .sort(
      (a, b) =>
        b.cells.reduce((s, v) => s + v, 0) - a.cells.reduce((s, v) => s + v, 0),
    );

  const colTotals = Array.from({ length: BUCKET_COUNT }, (_, i) =>
    rows.reduce((s, r) => s + r.cells[i], 0),
  );
  const grand = colTotals.reduce((s, v) => s + v, 0);

  return { rows, colTotals, grand };
}
