'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';

export type ErrorAction = { label: string; href?: string; onClick?: () => void; primary?: boolean };

// The design's full-page error state (`.estate`): a tone medallion + title +
// body + primary/ghost actions + a mono meta line. Shared by the Next error
// boundaries (error.tsx / not-found.tsx / global-error.tsx) — name the cause,
// then the next step. No dead ends.
export function ErrorState({
  tone = 'neutral',
  icon,
  title,
  body,
  actions = [],
  meta,
  spinner,
}: {
  tone?: 'red' | 'amber' | 'neutral';
  icon: string;
  title: string;
  body: string;
  actions?: ErrorAction[];
  meta?: string;
  spinner?: boolean;
}) {
  return (
    <div className="estate-wrap">
      <div className="estate">
        <span className={`estate-med ${tone}`}><Icon name={icon} size={25} /></span>
        <div className="estate-title">{title}</div>
        <div className="estate-body">{body}</div>
        {actions.length > 0 && (
          <div className="estate-actions">
            {actions.map((a, i) => {
              const cls = `btn btn-sm ${a.primary ? 'btn-primary' : 'btn-ghost'}`;
              return a.href ? (
                <Link key={i} href={a.href} className={cls}>{a.label}</Link>
              ) : (
                <button key={i} type="button" className={cls} onClick={a.onClick}>{a.label}</button>
              );
            })}
          </div>
        )}
        {meta && (
          <div className="estate-meta">
            <Icon name={spinner ? 'loader' : 'info'} size={12} className={spinner ? 'spin' : ''} />
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
