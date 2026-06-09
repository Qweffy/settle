'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { STATUS, type HistoryStatus } from '@/lib/data/vendor';
import type { VendorData } from '@/lib/queries/vendor';
import './vendor.css';

function TrendChart({ data, avg }: { data: VendorData['trend']; avg: number }) {
  const W = 600;
  const H = 168;
  const padX = 8;
  const padTop = 18;
  const padBot = 8;
  const vals = data.map((d) => d.v);
  const max = Math.max(...vals, avg) * 1.08 || 1;
  const min = Math.min(...vals, avg) * 0.9;
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (data.length - 1);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (H - padTop - padBot);
  const linePts = data.map((d, i) => `${x(i)},${y(d.v)}`).join(' ');
  const areaPts = `${x(0)},${H - padBot} ${linePts} ${x(data.length - 1)},${H - padBot}`;
  const avgY = y(avg);
  const [hover, setHover] = useState(data.length - 1); // last point flagged by default

  const lastVal = data[data.length - 1]?.v ?? 0;
  const lastMonth = data[data.length - 1]?.m ?? '';
  const pctAbove = avg > 0 ? Math.round(((lastVal - avg) / avg) * 100) : 0;

  return (
    <div className="card">
      <div className="card-h">
        <span className="ct">Monthly spend</span>
        <span className="csub">· last 6 months</span>
        <span className="ch-spacer" />
        <span className="legend">
          <span className="lg"><span className="ln" style={{ background: 'var(--primary)' }} />Spend</span>
          <span className="lg"><span className="ln dash" />6-mo avg</span>
        </span>
      </div>
      <div className="chart-pad">
        <div className="chart-top">
          <div className="chart-cur">{fmt(lastVal).replace('.00', '')}<span className="unit">in {lastMonth}</span></div>
          <span className="chart-flag"><Icon name="trending-up" size={12} />{pctAbove}% above average</span>
        </div>
        <div className="chart-svg-wrap">
          <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* avg dashed line */}
            <line x1={padX} y1={avgY} x2={W - padX} y2={avgY} stroke="var(--fg-3)" strokeWidth="1.25" strokeDasharray="5 5" opacity="0.7" />
            <polygon points={areaPts} fill="url(#vgrad)" />
            <polyline points={linePts} fill="none" stroke="var(--primary)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
              const last = i === data.length - 1;
              return (
                <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: 'pointer' }}>
                  <rect x={x(i) - 24} y="0" width="48" height={H} fill="transparent" />
                  <circle
                    cx={x(i)}
                    cy={y(d.v)}
                    r={last ? 5 : hover === i ? 4.5 : 3.5}
                    fill={last ? 'var(--failed-solid)' : 'var(--surface)'}
                    stroke={last ? 'var(--failed-solid)' : 'var(--primary)'}
                    strokeWidth="2.25"
                  />
                </g>
              );
            })}
          </svg>
          {hover != null && data[hover] && (
            <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].v) / H) * 168 - 8}px` }}>
              {data[hover].m} · {fmt(data[hover].v).replace('.00', '')}
            </div>
          )}
        </div>
        <div className="chart-xlabels">
          {data.map((d) => <span key={d.m}>{d.m}</span>)}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ v }: { v: VendorData['vendor'] }) {
  const rows = [
    { icon: 'mail', l: 'Billing contact', v: v.contact },
    { icon: 'phone', l: 'Phone', v: v.phone },
    { icon: 'map-pin', l: 'Address', v: v.address },
    { icon: 'hash', l: 'Vendor ID', v: v.vendorId, mono: true },
  ];
  return (
    <div className="card">
      <div className="card-h"><span className="ct">Vendor info</span><span className="ch-spacer" /><Link href={`/vendors/${v.vendorId}/edit`} className="haction">Edit</Link></div>
      <div className="info-list">
        {rows.map((r) => (
          <div className="info-row" key={r.l}>
            <span className="ii"><Icon name={r.icon} size={15} /></span>
            <div className="im"><div className="il">{r.l}</div><div className={'iv' + (r.mono ? ' mono' : '')}>{r.v}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: HistoryStatus }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className="pill" style={{ background: `var(${s.bg})`, color: `var(${s.ink})` }}>
      <span className="dot" style={{ background: `var(${s.solid})` }} />{s.label}
    </span>
  );
}

function History({ history }: { history: VendorData['history'] }) {
  const total = history.reduce((s, b) => s + b.amount, 0);
  const exportCsv = () => {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      'Invoice #,Amount,Status,Issued,Paid date',
      ...history.map((b) =>
        [b.inv, b.amount.toFixed(2), b.status, b.issued, b.paid].map((x) => cell(String(x))).join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-bills.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="hist-card">
      <div className="hist-head">
        <span className="ht">Bills history</span>
        <span className="hcount">· {history.length} bills</span>
        <span className="hspacer" />
        <span className="haction" role="button" tabIndex={0} onClick={exportCsv} onKeyDown={(e) => { if (e.key === 'Enter') exportCsv(); }}><Icon name="download" size={13} />Export</span>
      </div>
      <table className="vh-tbl">
        <thead><tr><th>Invoice #</th><th className="r">Amount</th><th>Status</th><th>Issued</th><th>Paid date</th></tr></thead>
        <tbody>
          {history.map((b) => (
            <tr key={b.inv}>
              <td><span className="vt-inv">{b.inv}</span></td>
              <td className="r"><span className="vt-amt">{fmt(b.amount)}</span></td>
              <td><StatusPill status={b.status} /></td>
              <td><span className="vt-date">{b.issued}</span></td>
              <td><span className={'vt-date' + (b.paid === '—' ? ' muted' : '')}>{b.paid}</span></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="vt-foot">
            <td><span className="fl">Total</span></td>
            <td className="r"><span className="fv">{fmt(total)}</span></td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function VendorView({ data }: { data: VendorData }) {
  const { vendor: v, score, trend, trendAvg, history } = data;
  const openBalance = history
    .filter((b) => b.status !== 'paid')
    .reduce((s, b) => s + b.amount, 0);
  const isActive = v.status === 'active';
  return (
    <div className="screen-vendor">
      <div className="wrap">
        <div className="crumbs">
          <Link href="/vendors">Vendors</Link><Icon name="chevron-right" size={13} /><span className="cur">{v.name}</span>
        </div>

        {/* header */}
        <div className="vhead">
          <div className="vh-top">
            <span className="vh-av">{v.mono}</span>
            <div className="vh-id">
              <div className="vh-namerow">
                <span className="vh-name">{v.name}</span>
                <span className="status-chip"><span className="dot" />{isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="vh-cat">{v.category} · {v.since}</div>
            </div>
            <div className="vh-actions">
              <Link href={`/vendors/${v.vendorId}/edit`} className="btn btn-ghost"><Icon name="pencil" size={15} />Edit vendor</Link>
              <Link href="/bills/new" className="btn btn-primary"><Icon name="plus" size={15} />New bill</Link>
            </div>
          </div>
          <div className="vh-attrs">
            <div className="vh-attr"><div className="al">Payment terms</div><div className="av-row"><span className="av">{v.terms}</span></div></div>
            <div className="vh-attr"><div className="al">Default method</div><div className="av-row"><span className="av"><Icon name="building" size={14} />{v.method} {v.account}</span>{v.bankChanged && <span className="bank-alert"><Icon name="shield-alert" size={11} />Bank changed</span>}</div></div>
            <div className="vh-attr"><div className="al">Open balance</div><div className="av-row"><span className="av">{fmt(openBalance)}</span></div></div>
            <div className="vh-attr"><div className="al">Tax ID</div><div className="av-row"><span className="av"><span className="mono">{v.taxMasked}</span></span></div></div>
          </div>
        </div>

        {/* scorecards */}
        <div className="scards">
          {score.map((c) => (
            <div className="scard" key={c.label}>
              <div className="sc-label">{c.label}</div>
              <div className="sc-val">{c.value}</div>
              <div className="sc-sub">{c.sub}</div>
              <div className="sc-foot">
                <span className={'delta ' + c.tone}>
                  <Icon name={c.dir === 'up' ? 'trending-up' : 'trending-down'} size={13} />{c.delta}
                  <span className="delta-cap">YoY</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* chart + info */}
        <div className="cols">
          <TrendChart data={trend} avg={trendAvg} />
          <InfoCard v={v} />
        </div>

        {/* history */}
        <History history={history} />
      </div>
    </div>
  );
}
