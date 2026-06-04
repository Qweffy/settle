import { DEMO_NOW } from './demo';

const DAY = 86_400_000;

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function timeAgo(d: Date, now: Date = DEMO_NOW): string {
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatShortDate(d);
}

export type DueTone = 'overdue' | 'soon' | 'none';

export function dueLabel(due: Date | null, now: Date = DEMO_NOW): { text: string; tone: DueTone } {
  if (!due) return { text: '—', tone: 'none' };
  const days = Math.round((due.getTime() - now.getTime()) / DAY);
  if (days < 0) return { text: `${-days}d overdue`, tone: 'overdue' };
  if (days === 0) return { text: 'due today', tone: 'soon' };
  if (days <= 7) return { text: `due in ${days}d`, tone: 'soon' };
  return { text: '', tone: 'none' };
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}
