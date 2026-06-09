'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { useActiveEntity } from '@/components/entity-context';
import { fmt } from '@/lib/format';
import type { VendorListItem } from '@/lib/queries/vendors-list';
import './vendors-list.css';

type StatusMeta = { label: string; bg: string; ink: string; solid: string };
const STATUS_PILL: Record<string, StatusMeta> = {
  active: { label: 'Active', bg: '--paid-bg', ink: '--paid-ink', solid: '--paid-solid' },
  inactive: { label: 'Inactive', bg: '--draft-bg', ink: '--draft-ink', solid: '--draft-solid' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL.inactive;
  return (
    <span className="pill" style={{ background: `var(${s.bg})`, color: `var(${s.ink})` }}>
      <span className="dot" style={{ background: `var(${s.solid})` }} />
      {s.label}
    </span>
  );
}

export function VendorsListView({ data }: { data: VendorListItem[] }) {
  const entity = useActiveEntity();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (v) => v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="screen-vendors">
      <div className="page-head">
        <div>
          <h1>Vendors</h1>
          <div className="ph-sub">{data.length} vendor{data.length !== 1 ? 's' : ''} · {entity.name}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={() => router.push('/vendors/new')}>
            <Icon name="plus" size={15} />Add vendor
          </button>
        </div>
      </div>

      <div className="controls">
        <div className="fsearch">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor, category…"
          />
        </div>
      </div>

      <div className="table-scroll">
        <table className="vendors">
          <thead>
            <tr>
              <th>Vendor</th>
              <th className="c-terms">Terms</th>
              <th className="c-method">Method</th>
              <th className="c-open">Open bills</th>
              <th className="num c-outstanding">Outstanding</th>
              <th className="num c-ytd">Spent YTD</th>
              <th className="c-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} onClick={() => router.push(`/vendors/${v.id}`)}>
                <td>
                  <div className="v-cell">
                    <span className="v-av">{v.mono}</span>
                    <div className="v-meta">
                      <div className="v-namerow">
                        <span className="v-name">{v.name}</span>
                        {v.bankChanged && (
                          <span className="bankchip" title="Vendor bank details changed">
                            <Icon name="shield-alert" size={11} />bank changed
                          </span>
                        )}
                      </div>
                      <span className="v-cat">{v.category}</span>
                    </div>
                  </div>
                </td>
                <td className="c-terms"><span className="v-terms">{v.termsLabel}</span></td>
                <td className="c-method"><span className="v-method">{v.methodLabel}</span></td>
                <td className="c-open">
                  {v.openCount > 0 ? (
                    <span className="v-open">{v.openCount} open</span>
                  ) : (
                    <span className="v-open muted">None</span>
                  )}
                </td>
                <td className="num c-outstanding"><span className="amt">{fmt(v.outstanding)}</span></td>
                <td className="num c-ytd"><span className="amt muted">{fmt(v.ytdSpend)}</span></td>
                <td className="c-status"><StatusPill status={v.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>
                  <div className="empty">
                    <Icon name="search" size={18} />
                    No vendors match “{query}”.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="tfoot">
        <span className="tf-label">Vendors</span>
        <span className="tf-count">· {rows.length} shown</span>
        <span className="tf-spacer" />
        <span className="tf-sumlabel">Total outstanding</span>
        <span className="tf-sum">{fmt(rows.reduce((s, v) => s + v.outstanding, 0))}</span>
      </div>
    </div>
  );
}
