'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { fmt, fmtK } from '@/lib/format';
import { BUCKETS } from '@/lib/data/aging';
import type { AgingData } from '@/lib/queries/aging';
import './aging.css';

// aging cells render an em dash for zero amounts
const fmtCell = (n: number) => (n === 0 ? '—' : fmt(n));

function Summary({ data }: { data: AgingData }) {
  const { rows, colTotals, grand } = data;
  const overdue = colTotals.slice(2).reduce((s, v) => s + v, 0); // 31d+
  const pctOverdue = grand > 0 ? Math.round((overdue / grand) * 100) : 0;
  const oldest = colTotals[4];
  return (
    <div className="summary">
      <div className="sum-top">
        <div className="sum-total">
          <div className="stl">Total outstanding</div>
          <div className="stv">{fmt(grand)}</div>
          <div className="sts">{rows.length} vendors · as of Jun 3, 2026</div>
        </div>
        <div className="sum-meta">
          <div className="sum-kpi"><div className="kl">Current</div><div className="kv">{fmtK(colTotals[0])}</div></div>
          <div className="sum-kpi"><div className="kl">Past due (31d+)</div><div className="kv warn">{fmtK(overdue)}</div></div>
          <div className="sum-kpi"><div className="kl">% past due</div><div className="kv warn">{pctOverdue}%</div></div>
          <div className="sum-kpi"><div className="kl">90+ days</div><div className="kv bad">{fmtK(oldest)}</div></div>
        </div>
      </div>

      {/* stacked bar */}
      <div className="stack">
        {BUCKETS.map((b, i) => {
          const v = colTotals[i];
          if (v === 0) return null;
          const pct = grand > 0 ? (v / grand) * 100 : 0;
          return <div key={b.id} className="stack-seg" style={{ width: pct + '%', background: `var(${b.color})` }} title={`${b.label}: ${fmt(v)}`} />;
        })}
      </div>
      <div className="stack-legend">
        {BUCKETS.map((b, i) => {
          const v = colTotals[i];
          const pct = grand > 0 ? Math.round((v / grand) * 100) : 0;
          return (
            <span className="leg" key={b.id}>
              <span className="ldot" style={{ background: `var(${b.color})` }} />
              <span className="lt">{b.label}</span>
              <span className="lv">{fmt(v)}</span>
              <span className="lp">· {pct}%</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function tintClass(bucketIdx: number, value: number) {
  if (value === 0) return '';
  if (bucketIdx === 2) return 'tint-review';
  if (bucketIdx === 3) return 'tint-overdue';
  if (bucketIdx === 4) return 'tint-failed';
  return '';
}

function Matrix({ data }: { data: AgingData }) {
  const { rows, colTotals, grand } = data;
  return (
    <div className="tbl-card">
      <div className="tbl-head">
        <span className="tt">Aging by vendor</span>
        <span className="tsub">· {rows.length} vendors</span>
        <span className="tspacer" />
        <button className="btn btn-ghost"><Icon name="download" size={15} />Export</button>
      </div>
      <div className="tbl-scroll">
        <table className="aging">
          <thead>
            <tr>
              <th className="vendor-col">Vendor</th>
              {BUCKETS.map((b) => (
                <th key={b.id}><span className="bucket-dot" style={{ background: `var(${b.color})` }} />{b.label}</th>
              ))}
              <th className="total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowTotal = r.cells.reduce((s, v) => s + v, 0);
              return (
                <tr key={r.vendor}>
                  <td className="vendor-col">
                    <div className="v-cell">
                      <span className="v-av">{r.mono}</span>
                      <div><div className="v-name">{r.vendor}</div><div className="v-gl">{r.gl}</div></div>
                    </div>
                  </td>
                  {r.cells.map((v, i) => (
                    <td key={i} className={(i === 0 ? 'cell-current ' : '') + tintClass(i, v)}>
                      <span className={'amt' + (v === 0 ? ' zero' : '')}>{fmtCell(v)}</span>
                    </td>
                  ))}
                  <td className="total-col"><span className="amt">{fmtCell(rowTotal)}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="fl">Total · {rows.length} vendors</td>
              {colTotals.map((v, i) => {
                const pct = grand > 0 ? Math.round((v / grand) * 100) : 0;
                return <td key={i}><div className="fv">{fmtCell(v)}</div><div className="fpct">{pct}%</div></td>;
              })}
              <td className="total-col"><div className="fv">{fmtCell(grand)}</div><div className="fpct">100%</div></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="tbl-note"><Icon name="info" size={13} />Cells aged 31+ days are tinted by severity. Click a vendor to open its detail.</div>
    </div>
  );
}

export function AgingView({ data }: { data: AgingData }) {
  const [asOf, setAsOf] = useState('Today');
  return (
    <div className="screen-aging">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>AP Aging</h1>
            <div className="ph-sub">Outstanding payables by age · Summit Waste Services</div>
          </div>
          <div className="ph-actions">
            <div className="seg">
              {['Today', 'Month end', 'Custom'].map((r) => (
                <button key={r} className={asOf === r ? 'on' : ''} onClick={() => setAsOf(r)}>{r}</button>
              ))}
            </div>
            <button className="btn btn-ghost"><Icon name="download" size={15} />Export</button>
          </div>
        </div>

        <Summary data={data} />
        <Matrix data={data} />
      </div>
    </div>
  );
}
