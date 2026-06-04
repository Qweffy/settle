import { describe, it, expect } from 'vitest';
import { dueLabel, daysBetween, timeAgo, formatShortDate } from '@/lib/dates';

const NOW = new Date('2026-06-03T16:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('dueLabel', () => {
  it('overdue', () => {
    expect(dueLabel(inDays(-3), NOW)).toEqual({ text: '3d overdue', tone: 'overdue' });
  });
  it('due today', () => {
    expect(dueLabel(NOW, NOW)).toEqual({ text: 'due today', tone: 'soon' });
  });
  it('due soon (within a week)', () => {
    expect(dueLabel(inDays(5), NOW)).toEqual({ text: 'due in 5d', tone: 'soon' });
  });
  it('far out → no label', () => {
    expect(dueLabel(inDays(30), NOW)).toEqual({ text: '', tone: 'none' });
  });
  it('no due date → dash', () => {
    expect(dueLabel(null, NOW)).toEqual({ text: '—', tone: 'none' });
  });
});

describe('daysBetween', () => {
  it('counts whole days (signed)', () => {
    expect(daysBetween(inDays(5), NOW)).toBe(5);
    expect(daysBetween(NOW, inDays(2))).toBe(-2);
  });
});

describe('timeAgo', () => {
  it('relative buckets', () => {
    expect(timeAgo(new Date(NOW.getTime() - 30_000), NOW)).toBe('just now');
    expect(timeAgo(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe('5m ago');
    expect(timeAgo(new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe('3h ago');
    expect(timeAgo(inDays(-1), NOW)).toBe('Yesterday');
    expect(timeAgo(inDays(-3), NOW)).toBe('3d ago');
  });
});

describe('formatShortDate', () => {
  it('renders "Mon D" in UTC', () => {
    expect(formatShortDate(new Date('2026-06-03T16:00:00.000Z'))).toBe('Jun 3');
  });
});
