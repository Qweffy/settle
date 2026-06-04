import type { StatusKey } from '@/lib/data/shell';

export type BillLifecycle =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'paid'
  | 'rejected'
  | 'void';

// Single source of truth for allowed lifecycle transitions (state machine).
export const ALLOWED_TRANSITIONS: Record<BillLifecycle, BillLifecycle[]> = {
  draft: ['pending_approval', 'void'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['scheduled', 'rejected'],
  scheduled: ['paid', 'approved'], // unschedule back to approved
  paid: [],
  rejected: ['draft'],
  void: [],
};

export function canTransition(from: BillLifecycle, to: BillLifecycle): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BillLifecycle, to: BillLifecycle): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal bill transition: ${from} → ${to}`);
  }
}

// Statuses whose fields may still be edited. Past approval, editing would
// silently invalidate an approval or a queued payment, and paid/rejected/void
// are effectively final — so only pre-decision bills are editable.
export const EDITABLE_STATUSES: BillLifecycle[] = ['draft', 'pending_approval'];
export function isEditable(status: BillLifecycle): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export const DUE_SOON_DAYS = 7;
const DAY_MS = 86_400_000;

type DeriveInput = {
  status: BillLifecycle;
  reviewStatus: 'clean' | 'flagged' | 'reviewed';
  dueDate: Date | null;
  paymentFailed?: boolean;
  now?: Date;
};

// Derives the single status pill shown in the UI from lifecycle + due date + review + payment.
export function deriveDisplayStatus(bill: DeriveInput): StatusKey {
  const now = bill.now ?? new Date();
  if (bill.paymentFailed) return 'failed';
  switch (bill.status) {
    case 'paid':
      return 'paid';
    case 'scheduled':
      return 'scheduled';
    case 'draft':
      return 'draft';
    case 'rejected':
      return 'rejected';
    case 'void':
      return 'draft';
    case 'approved':
    case 'pending_approval': {
      const due = bill.dueDate?.getTime();
      if (due != null && due < now.getTime()) return 'overdue';
      if (bill.status === 'pending_approval' && bill.reviewStatus === 'flagged') return 'review';
      if (due != null && due - now.getTime() <= DUE_SOON_DAYS * DAY_MS) return 'dueSoon';
      return bill.status === 'approved' ? 'approved' : 'approval';
    }
    default:
      return 'draft';
  }
}
