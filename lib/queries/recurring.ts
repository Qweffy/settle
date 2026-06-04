import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { recurringBillTemplates } from '@/db/schema';
import { DEMO_NOW, DEMO_ORG } from '@/lib/demo';
import { formatShortDate } from '@/lib/dates';

const DAY = 86_400_000;

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  quarterly: 'Quarterly',
};

export type RecurringDueTone = 'overdue' | 'soon' | 'upcoming';

export type RecurringRow = {
  id: string;
  vendor: string;
  mono: string;
  description: string;
  frequencyLabel: string;
  amount: number;
  nextRun: string;
  dueTone: RecurringDueTone;
  dueText: string;
  active: string;
};

// Bucket a next-run date relative to "today": overdue if past, soon within a
// week, otherwise upcoming. Produces a human phrase for the row badge.
function dueState(nextRun: Date, now: Date): { tone: RecurringDueTone; text: string } {
  const days = Math.round((nextRun.getTime() - now.getTime()) / DAY);
  if (days < 0) {
    const n = -days;
    return { tone: 'overdue', text: `${n} ${n === 1 ? 'day' : 'days'} overdue` };
  }
  if (days === 0) return { tone: 'soon', text: 'due today' };
  if (days <= 7) return { tone: 'soon', text: `in ${days} ${days === 1 ? 'day' : 'days'}` };
  return { tone: 'upcoming', text: `in ${days} days` };
}

// Recurring bill schedules for the demo org, with their vendor and a derived
// due badge, ordered by which fires next.
export async function getRecurringTemplates(): Promise<RecurringRow[]> {
  const rows = await db.query.recurringBillTemplates.findMany({
    where: eq(recurringBillTemplates.orgId, DEMO_ORG),
    orderBy: asc(recurringBillTemplates.nextRunDate),
    with: { vendor: { columns: { name: true, mono: true } } },
  });

  return rows.map((r) => {
    const due = dueState(r.nextRunDate, DEMO_NOW);
    return {
      id: r.id,
      vendor: r.vendor?.name ?? 'Unknown vendor',
      mono: r.vendor?.mono ?? '—',
      description: r.description,
      frequencyLabel: FREQUENCY_LABEL[r.frequency] ?? r.frequency,
      amount: r.amountCents / 100,
      nextRun: formatShortDate(r.nextRunDate),
      dueTone: due.tone,
      dueText: due.text,
      active: r.active,
    };
  });
}
