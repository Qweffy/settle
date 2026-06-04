import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  deriveDisplayStatus,
  DUE_SOON_DAYS,
} from '@/lib/status';

const NOW = new Date('2026-06-03T16:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('canTransition / assertTransition (lifecycle state machine)', () => {
  it('allows the happy-path transitions', () => {
    expect(canTransition('draft', 'pending_approval')).toBe(true);
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('approved', 'scheduled')).toBe(true);
    expect(canTransition('scheduled', 'paid')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('draft', 'paid')).toBe(false);
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('paid', 'approved')).toBe(false);
    expect(canTransition('void', 'draft')).toBe(false);
  });

  it('paid and void are terminal', () => {
    expect(ALLOWED_TRANSITIONS.paid).toEqual([]);
    expect(ALLOWED_TRANSITIONS.void).toEqual([]);
  });

  it('assertTransition throws on illegal, is silent on legal', () => {
    expect(() => assertTransition('draft', 'paid')).toThrow(/Illegal bill transition/);
    expect(() => assertTransition('pending_approval', 'approved')).not.toThrow();
  });
});

describe('deriveDisplayStatus', () => {
  const base = { reviewStatus: 'clean' as const, dueDate: null as Date | null, now: NOW };

  it('maps simple/terminal statuses directly', () => {
    expect(deriveDisplayStatus({ ...base, status: 'paid' })).toBe('paid');
    expect(deriveDisplayStatus({ ...base, status: 'scheduled' })).toBe('scheduled');
    expect(deriveDisplayStatus({ ...base, status: 'draft' })).toBe('draft');
    expect(deriveDisplayStatus({ ...base, status: 'rejected' })).toBe('rejected');
    expect(deriveDisplayStatus({ ...base, status: 'void' })).toBe('draft');
  });

  it('a failed payment wins over everything', () => {
    expect(deriveDisplayStatus({ ...base, status: 'scheduled', paymentFailed: true })).toBe('failed');
  });

  it('pending_approval + flagged → review', () => {
    expect(deriveDisplayStatus({ ...base, status: 'pending_approval', reviewStatus: 'flagged' })).toBe('review');
  });

  it('overdue once the due date has passed', () => {
    expect(deriveDisplayStatus({ ...base, status: 'approved', dueDate: inDays(-1) })).toBe('overdue');
  });

  it('dueSoon within the 7-day window', () => {
    expect(deriveDisplayStatus({ ...base, status: 'approved', dueDate: inDays(3) })).toBe('dueSoon');
  });

  it('approved / approval when far out', () => {
    expect(deriveDisplayStatus({ ...base, status: 'approved', dueDate: inDays(30) })).toBe('approved');
    expect(deriveDisplayStatus({ ...base, status: 'pending_approval', dueDate: inDays(30) })).toBe('approval');
  });

  it('DUE_SOON_DAYS is 7', () => {
    expect(DUE_SOON_DAYS).toBe(7);
  });
});
