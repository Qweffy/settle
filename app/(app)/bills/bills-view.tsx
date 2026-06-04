'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import {
  FILTERS,
  STATUS,
  COLS,
  type StatusKey,
} from '@/lib/data/bills';
import type { BillsData } from '@/lib/queries/bills';
import './bills.css';

type CheckState = 'on' | 'off' | 'partial';

function StatusPill({ status }: { status: StatusKey }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className="pill" style={{ background: `var(${s.bg})`, color: `var(${s.ink})` }}>
      <span className="dot" style={{ background: `var(${s.solid})` }} />
      {s.label}
    </span>
  );
}

function Check({ state, onClick }: { state: CheckState; onClick: () => void }) {
  return (
    <span
      className={'cbox' + (state === 'on' ? ' on' : state === 'partial' ? ' partial' : '')}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name={state === 'partial' ? 'minus' : 'check'} size={12} />
    </span>
  );
}

type SortKey = 'vendor' | 'amount' | 'due';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

export function BillsView({ data }: { data: BillsData }) {
  const router = useRouter();
  const { tabs: TABS, rows: ROWS } = data;
  const openCount = ROWS.filter((r) => !['paid', 'failed'].includes(r.status)).length;

  const [tab, setTab] = useState('all');
  const [density, setDensity] = useState(48);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'due', dir: 'asc' });
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [visCols, setVisCols] = useState<Set<string>>(() => new Set(COLS.map((c) => c.id)));
  const [toast, setToast] = useState<string | null>(null);

  // filter rows by tab + query
  const rows = useMemo(() => {
    let r = ROWS.filter((row) => row.tabs.includes(tab));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter(
        (row) =>
          row.vendor.toLowerCase().includes(q) ||
          row.inv.toLowerCase().includes(q) ||
          row.gl.toLowerCase().includes(q),
      );
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sort.key === 'amount') return (a.amount - b.amount) * dir;
      if (sort.key === 'vendor') return a.vendor.localeCompare(b.vendor) * dir;
      if (sort.key === 'due') {
        // keep '—' last
        if (a.due === '—') return 1;
        if (b.due === '—') return -1;
        return (new Date('2026 ' + a.due).getTime() - new Date('2026 ' + b.due).getTime()) * dir;
      }
      return 0;
    });
    return r;
  }, [ROWS, tab, query, sort]);

  // selection only counts visible rows
  const visIds = rows.map((r) => r.id);
  const selVisible = visIds.filter((id) => sel.has(id));
  const allOn = selVisible.length > 0 && selVisible.length === visIds.length;
  const headState: CheckState = allOn ? 'on' : selVisible.length > 0 ? 'partial' : 'off';

  const toggleRow = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel((s) => {
      const n = new Set(s);
      if (allOn) visIds.forEach((id) => n.delete(id));
      else visIds.forEach((id) => n.add(id));
      return n;
    });
  const clearSel = () => setSel(new Set());

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const selRows = ROWS.filter((r) => sel.has(r.id));
  const selSum = selRows.reduce((s, r) => s + r.amount, 0);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortArrow = (key: SortKey) =>
    sort.key === key ? (
      <span className="tharr">
        <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} />
      </span>
    ) : null;

  const toggleFilter = (id: string) =>
    setActiveFilters((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleCol = (id: string) =>
    setVisCols((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const doBulk = (label: string) => {
    setToast(`${label} · ${selRows.length} bill${selRows.length > 1 ? 's' : ''}`);
    clearSel();
    setTimeout(() => setToast(null), 2600);
  };

  const show = (id: string) => visCols.has(id);

  return (
    <div className="screen-bills">
      <div className="page-head">
        <div>
          <h1>Bills</h1>
          <div className="ph-sub">{openCount} open bills · Summit Waste Services · synced 2 min ago</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost"><Icon name="upload" size={15} />Import</button>
          <button className="btn btn-primary" onClick={() => router.push('/bills/new')}><Icon name="plus" size={15} />New bill</button>
        </div>
      </div>

      {/* lifecycle tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' on' : '') + (t.id === 'review' ? ' review' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tc">{t.count}</span>
          </button>
        ))}
      </div>

      {/* controls */}
      <div className="controls">
        <div className="fsearch">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor, invoice #, GL…"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'chip' + (activeFilters.has(f.id) ? ' active' : '')}
            onClick={() => toggleFilter(f.id)}
          >
            {f.label}
            <Icon name="chevron-down" size={13} />
          </button>
        ))}

        <div className="ctrl-spacer" />

        <button className="ctrlbtn">
          <Icon name="bookmark" size={14} />Saved views
          <Icon name="chevron-down" size={13} />
        </button>

        <div style={{ position: 'relative' }}>
          <button className="ctrlbtn" onClick={() => setMenu(menu === 'cols' ? null : 'cols')}>
            <Icon name="columns-3" size={14} />Columns
          </button>
          {menu === 'cols' && (
            <div className="menu" style={{ top: 'calc(100% + 6px)', right: 0, minWidth: 200 }}>
              <div className="menu-label">Visible columns</div>
              {COLS.map((c) => (
                <div key={c.id} className="menu-item" onClick={() => toggleCol(c.id)}>
                  <span className={'mch' + (visCols.has(c.id) ? ' on' : '')}>
                    {visCols.has(c.id) && <Icon name="check" size={11} />}
                  </span>
                  <span className="mlabel">{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="ctrlbtn"
          onClick={() => {
            setToast(`Exporting ${rows.length} bills to CSV…`);
            setTimeout(() => setToast(null), 2600);
          }}
        >
          <Icon name="download" size={14} />Export
        </button>

        <div className="density">
          {[40, 48, 56].map((d) => (
            <button key={d} className={density === d ? 'on' : ''} title={d + 'px rows'} onClick={() => setDensity(d)}>
              <Icon name={d === 40 ? 'align-justify' : d === 48 ? 'menu' : 'rows-3'} size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className={'table-scroll dense-' + density}>
        <table className="bills">
          <thead>
            <tr>
              <th className="col-check"><Check state={headState} onClick={toggleAll} /></th>
              <th className="sortable" onClick={() => onSort('vendor')}>Vendor{sortArrow('vendor')}</th>
              {show('inv') && <th className="c-inv">Invoice #</th>}
              {show('amount') && (
                <th className="num sortable c-amount" onClick={() => onSort('amount')}>Amount{sortArrow('amount')}</th>
              )}
              {show('due') && (
                <th className="sortable c-due" onClick={() => onSort('due')}>Due date{sortArrow('due')}</th>
              )}
              {show('status') && <th className="c-status">Status</th>}
              {show('gl') && <th className="c-gl">GL account</th>}
              {show('flag') && <th className="col-flag c-flag">Flag</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = sel.has(r.id);
              return (
                <tr key={r.id} className={on ? 'sel' : ''} onClick={() => router.push(`/bills/${r.id}`)}>
                  <td className="col-check"><Check state={on ? 'on' : 'off'} onClick={() => toggleRow(r.id)} /></td>
                  <td>
                    <div className="v-cell">
                      <span className="v-av">{r.mono}</span>
                      <span className="v-name">{r.vendor}</span>
                    </div>
                  </td>
                  {show('inv') && (
                    <td className="c-inv"><span className="inv">{r.inv}</span></td>
                  )}
                  {show('amount') && (
                    <td className="num c-amount"><span className="amt">{fmt(r.amount)}</span></td>
                  )}
                  {show('due') && (
                    <td className="c-due">
                      <div className="due-main">{r.due}</div>
                      <div className={'due-hint ' + r.dueTone}>{r.dueHint}</div>
                    </td>
                  )}
                  {show('status') && (
                    <td className="c-status"><StatusPill status={r.status} /></td>
                  )}
                  {show('gl') && (
                    <td className="c-gl"><span className="gl-chip">{r.gl}</span></td>
                  )}
                  {show('flag') && (
                    <td className="col-flag c-flag">
                      {r.flag && (
                        <span className="flag" title={r.flag}>
                          <Icon name="flag" size={15} />
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* totals footer */}
      <div className="tfoot">
        <span className="tf-label">Total payable</span>
        <span className="tf-count">
          · {rows.length} bill{rows.length !== 1 ? 's' : ''}{tab !== 'all' ? ' in view' : ''}
        </span>
        <span className="tf-spacer" />
        <span className="tf-sumlabel">Sum</span>
        <span className="tf-sum">{fmt(total)}</span>
      </div>

      {/* bulk action bar */}
      {selRows.length > 0 && (
        <div className="bulkbar-wrap">
          <div className="bulkbar">
            <span className="bb-count">
              <span className="bb-badge">{selRows.length}</span>selected
            </span>
            <span className="bb-sum">· {fmt(selSum)}</span>
            <span className="bb-div" />
            <button className="bb-act primary" onClick={() => doBulk('Approved')}>
              <Icon name="check-circle-2" size={14} />Approve
            </button>
            <button className="bb-act" onClick={() => doBulk('Scheduled')}>
              <Icon name="calendar-clock" size={14} />Schedule
            </button>
            <button className="bb-act" onClick={() => doBulk('Coding updated for')}>
              <Icon name="tag" size={14} />Edit coding
            </button>
            <button className="bb-act" onClick={() => doBulk('Reminder sent for')}>
              <Icon name="bell" size={14} />Remind
            </button>
            <button className="bb-act" onClick={() => doBulk('Exported')}>
              <Icon name="download" size={14} />Export
            </button>
            <span className="bb-div" />
            <button className="bb-close" onClick={clearSel} title="Clear selection">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="toast">
          <Icon name="check-circle-2" size={16} />
          {toast}
        </div>
      )}

      {/* click-away for the columns menu */}
      {menu && <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setMenu(null)} />}
    </div>
  );
}
