'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import {
  SEV,
  ACT_ICON,
  ACT_ICON_FALLBACK,
  type Score,
  type ActivityItem,
  type ReviewItem,
  type ExpectedItem,
  type CashOutWeek,
} from '@/lib/data/dashboard';
import type { DashboardData } from '@/lib/queries/dashboard';
import './dashboard.css';

function Sparkline({ points, w = 96, h = 36 }: { points: number[]; w?: number; h?: number }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const pts = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" preserveAspectRatio="none" style={{ flexShrink: 0 }}>
      <polyline points={area} fill="color-mix(in srgb, var(--primary) 10%, transparent)" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Scorecard({ c }: { c: Score }) {
  return (
    <div className="scard">
      <div className="sc-top"><span className="sc-label">{c.label}</span></div>
      <div className="sc-val">{fmt(c.value)}</div>
      <div className="sc-sub">{c.sub}</div>
      <div className="sc-foot">
        <span className={'delta ' + c.tone}>
          <Icon name={c.dir === 'up' ? 'trending-up' : 'trending-down'} size={13} />
          {c.delta}
          <span className="delta-cap">MoM</span>
        </span>
        <Sparkline points={c.spark} />
      </div>
    </div>
  );
}

function NeedsReview({ items }: { items: ReviewItem[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="pt">Needs review</span>
        <span className="ai"><Icon name="sparkles" size={12} />AI flagged</span>
        <span className="pcount">{items.length}</span>
        <span className="pa">Review all<Icon name="arrow-right" size={13} /></span>
      </div>
      {items.map((r, i) => {
        const sev = SEV[r.sev];
        return (
          <div className="rv-item" key={i}>
            <span className="rv-av">{r.mono}<span className="rv-sev" style={{ background: `var(${sev.solid})` }} /></span>
            <div className="rv-main">
              <div className="rv-line1">
                <span className="rv-vendor">{r.vendor}</span>
                <span className="rv-gl">· {r.gl}</span>
              </div>
              <div className="rv-reason">{r.reason}</div>
            </div>
            <div className="rv-right">
              <span className="rv-amt">{fmt(r.amount)}</span>
              <span className="sev-pill" style={{ background: `var(${sev.bg})`, color: `var(${sev.ink})` }}>
                <span className="dot" style={{ background: `var(${sev.solid})` }} />{sev.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Expected({ items }: { items: ExpectedItem[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="pt">Expected bills not received</span>
        <span className="pcount">{items.length}</span>
      </div>
      {items.map((e, i) => (
        <div className="exp-item" key={i}>
          <span className="exp-av">{e.mono}</span>
          <div className="exp-main">
            <div className="exp-vendor">{e.vendor}</div>
            <div className="exp-sub">{e.cadence} · {e.gl} · typ. {e.typical}</div>
          </div>
          <div className="exp-right">
            <span className="exp-late">{e.late}d late</span>
            <div className="exp-exp">Expected {e.expected}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CashOut({ weeks }: { weeks: CashOutWeek[] }) {
  const max = Math.max(...weeks.map((c) => c.amount), 1);
  const total = weeks.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="panel">
      <div className="panel-head"><span className="pt">Cash out by week</span><span className="pa">Next 6 weeks</span></div>
      <div className="chart-body">
        <div className="chart-legend">Scheduled outflow</div>
        <div className="chart-total">{fmt(total)}</div>
        <div className="chart-bars">
          {weeks.map((c, i) => (
            <div className={'bar-col' + (c.current ? ' current' : '')} key={i} title={fmt(c.amount)}>
              <span className="bar-amt">{'$' + Math.round(c.amount / 1000) + 'k'}</span>
              <div className="bar" style={{ height: Math.max(6, Math.round((c.amount / max) * 86)) + 'px' }} />
              <span className="bar-wk">{c.wk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityText({ a }: { a: ActivityItem }) {
  return (
    <span className="act-text">
      <b>{a.who}</b> {a.text}
      {a.target && <> <b>{a.target}</b></>}
      {a.amount != null && <> <span className="act-amt">{fmt(a.amount)}</span></>}
    </span>
  );
}

function Activity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="panel">
      <div className="panel-head"><span className="pt">Recent activity</span><span className="pa">View all<Icon name="arrow-right" size={13} /></span></div>
      <div className="activity">
        {items.map((a, i) => {
          const ic = ACT_ICON[a.type] ?? ACT_ICON_FALLBACK;
          return (
            <div className="act-item" key={i}>
              <span className="act-ic"><Icon name={ic.icon} size={15} style={{ color: `var(${ic.color})` }} /></span>
              <div className="act-body">
                <ActivityText a={a} />
                {a.meta && <div className="act-meta">{a.meta}</div>}
                {a.quote && <div className="act-quote">“{a.quote}”</div>}
              </div>
              <span className="act-time">{a.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Non-blocking sync banner (the design's `.banner.amber`): an integration that
// fell behind, surfaced without blocking the dashboard. Retry shows progress;
// Dismiss hides it for the session. Fails at the smallest scope — the page works.
function SyncBanner() {
  const [state, setState] = useState<'error' | 'syncing' | 'gone'>('error');
  if (state === 'gone') return null;
  const syncing = state === 'syncing';
  const retry = () => {
    setState('syncing');
    setTimeout(() => setState('gone'), 1300);
  };
  return (
    <div className="banner amber">
      <Icon name="refresh-cw" size={18} className={'bn-ic' + (syncing ? ' spin' : '')} />
      <div className="bn-main">
        <div className="bn-t">{syncing ? 'Syncing with QuickBooks…' : 'Couldn’t sync with QuickBooks'}</div>
        <div className="bn-s">
          {syncing ? 'Posting 14 bills to the ledger' : '14 bills are waiting to post · last synced 2h ago'}
        </div>
      </div>
      {!syncing && (
        <div className="bn-acts">
          <button className="bn-btn solid-amber" onClick={retry}><Icon name="refresh-cw" size={12} />Retry</button>
          <button className="bn-btn ghost-amber" onClick={() => setState('gone')}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const [range, setRange] = useState('This month');
  return (
    <div className="screen-dashboard">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Dashboard</h1>
            <div className="ph-sub">Tuesday, June 3 · Summit Waste Services · last synced 2 min ago</div>
          </div>
          <div className="ph-actions">
            <div className="seg">
              {['This week', 'This month', 'Quarter'].map((r) => (
                <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
            <button className="btn btn-ghost"><Icon name="arrow-left-right" size={15} />Reconcile</button>
          </div>
        </div>

        <SyncBanner />

        <div className="scards">
          {data.score.map((c) => <Scorecard key={c.label} c={c} />)}
        </div>

        <div className="dash-grid">
          <div className="dash-left">
            <NeedsReview items={data.review} />
            <div className="left-row">
              <Expected items={data.expected} />
              <CashOut weeks={data.cashout} />
            </div>
          </div>
          <Activity items={data.activity} />
        </div>
      </div>
    </div>
  );
}
