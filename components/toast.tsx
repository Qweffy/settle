'use client';

import { Icon } from '@/components/icon';

export type ToastData = {
  title: string;
  sub?: string;
  tone?: 'neutral' | 'red' | 'amber';
  onRetry?: () => void;
};

// The design's toast: a tone icon + title (+ optional subtitle) + optional Retry
// + a dismiss. Success → neutral; a failed action → red with the cause + Retry.
// Keeps the `.toast` class (the e2e suite asserts text inside `.toast`).
export function Toast({ title, sub, tone = 'neutral', onRetry, onClose }: ToastData & { onClose: () => void }) {
  const icon = tone === 'red' ? 'circle-x' : tone === 'amber' ? 'alert-triangle' : 'check-circle-2';
  return (
    <div className="toast">
      <span className={`tt-ic ${tone}`}><Icon name={icon} size={15} /></span>
      <div className="tt-main">
        <div className="tt-t">{title}</div>
        {sub && <div className="tt-s">{sub}</div>}
      </div>
      {onRetry && (
        <span className="tt-act" role="button" tabIndex={0} onClick={onRetry}>Retry</span>
      )}
      <span className="tt-x" role="button" tabIndex={0} aria-label="Dismiss" onClick={onClose}><Icon name="x" size={15} /></span>
    </div>
  );
}
