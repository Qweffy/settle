'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { useActiveEntity } from '@/components/entity-context';
import { fmt } from '@/lib/format';
import { bulkAdvance, importBills, type BulkAction, type ImportRow } from '@/lib/actions/bills';
import { createSavedView, deleteSavedView } from '@/lib/actions/views';
import {
  FILTERS,
  STATUS,
  COLS,
  type StatusKey,
  type Sort,
  type SavedView,
  type SavedViewConfig,
  type BillRow,
} from '@/lib/data/bills';
import type { BillsData } from '@/lib/queries/bills';
import { Check, type CheckState } from '@/components/check';
import { Toast, type ToastData } from '@/components/toast';
import './bills.css';

// Chip-filter helpers: map a bill row to its filterable value per category.
const AMOUNT_BUCKET = (n: number): string => (n >= 50000 ? 'Over $50k' : n >= 10000 ? '$10k–$50k' : 'Under $10k');
const DUE_FILTER_LABEL: Record<string, string> = { overdue: 'Overdue', soon: 'Due soon', none: 'No due date' };
const rowFilterVal = (r: BillRow, cat: string): string =>
  cat === 'status' ? r.status
    : cat === 'vendor' ? r.vendor
    : cat === 'gl' ? r.gl
    : cat === 'due' ? r.dueTone
    : cat === 'amount' ? AMOUNT_BUCKET(r.amount)
    : '';

// CSV header → ImportRow field. A few common aliases are accepted per column.
const FIELD_BY_HEADER: Record<string, keyof ImportRow> = {
  vendor: 'vendor', vendor_name: 'vendor', supplier: 'vendor',
  invoice_number: 'invoiceNumber', invoice: 'invoiceNumber', invoice_no: 'invoiceNumber', inv: 'invoiceNumber',
  amount: 'amount', total: 'amount', amount_usd: 'amount',
  due_date: 'dueDate', due: 'dueDate',
  gl_account: 'gl', gl: 'gl', category: 'gl',
  description: 'description', memo: 'description', desc: 'description',
};

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes. Returns the non-empty rows.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') pushField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushField(); pushRow();
    } else field += ch;
  }
  pushField();
  pushRow();
  return rows;
}

const parseAmount = (raw: string): number => Number(raw.replace(/[$,\s]/g, ''));

// Map a parsed CSV grid (with a header row) into ImportRow records.
function rowsToImport(grid: string[][]): ImportRow[] {
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => FIELD_BY_HEADER[h.trim().toLowerCase().replace(/[\s#]+/g, '_')]);
  return grid.slice(1).map((cells) => {
    const rec: ImportRow = { vendor: '', invoiceNumber: '', amount: NaN, dueDate: null, gl: '', description: '' };
    headers.forEach((field, i) => {
      const value = (cells[i] ?? '').trim();
      if (field === 'amount') rec.amount = parseAmount(value);
      else if (field === 'dueDate') rec.dueDate = value || null;
      else if (field === 'vendor' || field === 'invoiceNumber' || field === 'gl' || field === 'description') {
        rec[field] = value;
      }
    });
    return rec;
  });
}

type PreviewState = { fileName: string; rows: ImportRow[] };

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

type SortKey = Sort['key'];

export function BillsView({ data }: { data: BillsData }) {
  const entity = useActiveEntity();
  const router = useRouter();
  const { tabs: TABS, rows: ROWS, vendorNames, views } = data;
  const openCount = ROWS.filter((r) => !['paid', 'failed'].includes(r.status)).length;

  const [tab, setTab] = useState('all');
  const [density, setDensity] = useState(48);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'due', dir: 'asc' });
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [filterValues, setFilterValues] = useState<Record<string, Set<string>>>(() => ({}));
  const [menu, setMenu] = useState<string | null>(null);
  const [visCols, setVisCols] = useState<Set<string>>(() => new Set(COLS.map((c) => c.id)));
  const [toast, setToast] = useState<ToastData | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [viewName, setViewName] = useState('');
  const [importBusy, startImport] = useTransition();
  const [viewsBusy, startViews] = useTransition();

  const vendorNameSet = useMemo(
    () => new Set(vendorNames.map((n) => n.trim().toLowerCase())),
    [vendorNames],
  );
  const flash = (msg: string, ms = 2800, tone?: ToastData['tone']) => {
    setToast({ title: msg, tone });
    setTimeout(() => setToast(null), ms);
  };

  // distinct filter options per category, drawn from all rows
  const filterOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of FILTERS) {
      const seen = new Set<string>();
      for (const row of ROWS) seen.add(rowFilterVal(row, f.id));
      out[f.id] = [...seen].filter(Boolean);
    }
    return out;
  }, [ROWS]);
  const filterOptLabel = (cat: string, v: string): string =>
    cat === 'status' ? STATUS[v as StatusKey]?.label ?? v : cat === 'due' ? DUE_FILTER_LABEL[v] ?? v : v;

  // filter rows by tab + active chip filters + query
  const rows = useMemo(() => {
    let r = ROWS.filter((row) => row.tabs.includes(tab));
    for (const cat of Object.keys(filterValues)) {
      const set = filterValues[cat];
      if (set && set.size) r = r.filter((row) => set.has(rowFilterVal(row, cat)));
    }
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
  }, [ROWS, tab, query, sort, filterValues]);

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

  const toggleFilterValue = (cat: string, value: string) =>
    setFilterValues((fv) => {
      const set = new Set(fv[cat] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      const next = { ...fv };
      if (set.size) next[cat] = set;
      else delete next[cat];
      return next;
    });
  const clearFilter = (cat: string) =>
    setFilterValues((fv) => {
      const next = { ...fv };
      delete next[cat];
      return next;
    });
  const toggleCol = (id: string) =>
    setVisCols((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const [bulkBusy, startBulk] = useTransition();
  const bulkAct = (action: BulkAction, verb: string) => {
    const ids = [...sel];
    startBulk(async () => {
      try {
        const res = await bulkAdvance(ids, action);
        setToast({
          title:
            res.done > 0
              ? `${verb} ${res.done} bill${res.done > 1 ? 's' : ''}${res.skipped > 0 ? ` · ${res.skipped} not eligible` : ''}`
              : `Nothing eligible in selection · ${res.skipped} skipped`,
          tone: res.done > 0 ? 'neutral' : 'amber',
        });
      } catch {
        setToast({ title: 'Something went wrong — please try again', tone: 'red' });
      } finally {
        clearSel();
        router.refresh();
        setTimeout(() => setToast(null), 3200);
      }
    });
  };
  const exportCsv = () => {
    // Export the current selection, or the whole visible list when nothing is selected.
    const target = selRows.length > 0 ? selRows : rows;
    const headers = ['Vendor', 'Invoice', 'Amount', 'Due', 'Status', 'GL'];
    const cell = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = [
      headers.join(','),
      ...target.map((r) =>
        [r.vendor, r.inv, r.amount.toFixed(2), r.due, STATUS[r.status]?.label ?? r.status, r.gl]
          .map((v) => cell(String(v)))
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bills.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setToast({ title: `Exported ${target.length} bill${target.length !== 1 ? 's' : ''} to CSV` });
    clearSel();
    setTimeout(() => setToast(null), 2600);
  };

  const importInputRef = useRef<HTMLInputElement>(null);
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = rowsToImport(parseCsv(text));
      if (parsed.length === 0) {
        flash(`No rows found in ${file.name}`);
        return;
      }
      setPreview({ fileName: file.name, rows: parsed });
    };
    reader.readAsText(file);
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
  };

  // A row imports cleanly when its vendor resolves, it has an invoice #, and a
  // positive amount. The preview marks the rest; the server skips them too.
  const rowValid = (r: ImportRow): boolean =>
    vendorNameSet.has(r.vendor.trim().toLowerCase()) &&
    r.invoiceNumber.trim() !== '' &&
    Number.isFinite(r.amount) &&
    r.amount > 0;
  const rowIssue = (r: ImportRow): string =>
    !vendorNameSet.has(r.vendor.trim().toLowerCase()) ? 'Unknown vendor'
      : r.invoiceNumber.trim() === '' ? 'Missing invoice #'
      : !(Number.isFinite(r.amount) && r.amount > 0) ? 'Invalid amount'
      : '';

  const confirmImport = () => {
    if (!preview) return;
    const rows = preview.rows;
    startImport(async () => {
      const res = await importBills(rows);
      setPreview(null);
      router.refresh();
      flash(
        res.created > 0
          ? `Imported ${res.created} bill${res.created !== 1 ? 's' : ''} as draft${res.skipped > 0 ? ` · ${res.skipped} skipped` : ''}`
          : `Nothing imported · ${res.skipped} row${res.skipped !== 1 ? 's' : ''} had issues`,
        3400,
      );
    });
  };

  const downloadTemplate = () => {
    const sample = [
      'vendor,invoice_number,amount,due_date,gl_account,description',
      'WEX Fleet Fuel,STMT-0601,12500.00,2026-07-05,Fuel,June fuel statement',
      'Penske Truck Leasing,PEN-90001,8200.00,2026-07-10,Equipment,Monthly truck lease',
      'Cintas,CIN-4500,1180.00,2026-07-12,Office,Uniform & mat service',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bills-import-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const currentConfig = (): SavedViewConfig => ({
    tab, query, sort,
    filters: Object.entries(filterValues).flatMap(([cat, set]) => [...set].map((v) => `${cat}:${v}`)),
    cols: [...visCols], density,
  });
  const applyView = (v: SavedView) => {
    setTab(v.config.tab);
    setQuery(v.config.query);
    setSort(v.config.sort);
    const fv: Record<string, Set<string>> = {};
    for (const entry of v.config.filters) {
      const i = entry.indexOf(':');
      if (i < 0) continue;
      const cat = entry.slice(0, i);
      (fv[cat] ??= new Set<string>()).add(entry.slice(i + 1));
    }
    setFilterValues(fv);
    setVisCols(new Set(v.config.cols));
    setDensity(v.config.density);
    setMenu(null);
    flash(`Applied “${v.name}”`, 1800);
  };
  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    startViews(async () => {
      const res = await createSavedView(name, currentConfig());
      if (!res.ok) {
        flash(res.error, 3600, 'red');
        return;
      }
      setViewName('');
      setMenu(null);
      router.refresh();
      flash(`Saved view “${name}”`);
    });
  };
  const removeView = (id: string, name: string) => {
    startViews(async () => {
      await deleteSavedView(id);
      router.refresh();
      flash(`Deleted “${name}”`, 1800);
    });
  };

  const show = (id: string) => visCols.has(id);

  return (
    <div className="screen-bills">
      <div className="page-head">
        <div>
          <h1>Bills</h1>
          <div className="ph-sub">{openCount} open bills · {entity.name} · synced 2 min ago</div>
        </div>
        <div className="ph-actions">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            hidden
            onChange={onImportFile}
          />
          <button className="btn btn-ghost" onClick={downloadTemplate} title="Download a sample import CSV"><Icon name="file-down" size={15} />Template</button>
          <button className="btn btn-ghost" onClick={() => importInputRef.current?.click()}><Icon name="upload" size={15} />Import</button>
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
        {FILTERS.map((f) => {
          const sel = filterValues[f.id];
          const opts = filterOptions[f.id] ?? [];
          return (
            <div style={{ position: 'relative' }} key={f.id}>
              <button
                className={'chip' + (sel?.size ? ' active' : '')}
                onClick={() => setMenu(menu === `filter:${f.id}` ? null : `filter:${f.id}`)}
              >
                {f.label}
                {sel?.size ? <span className="ctrl-badge">{sel.size}</span> : null}
                <Icon name="chevron-down" size={13} />
              </button>
              {menu === `filter:${f.id}` && (
                <div className="menu" style={{ top: 'calc(100% + 6px)', left: 0, minWidth: 200 }}>
                  <div className="menu-label">Filter by {f.label.toLowerCase()}</div>
                  {opts.length === 0 && <div className="menu-empty">No values</div>}
                  {opts.map((v) => (
                    <div key={v} className="menu-item" onClick={() => toggleFilterValue(f.id, v)}>
                      <Icon name={sel?.has(v) ? 'check-square' : 'square'} size={14} />
                      <span>{filterOptLabel(f.id, v)}</span>
                    </div>
                  ))}
                  {sel?.size ? (
                    <>
                      <div className="menu-sep" />
                      <div className="menu-item" onClick={() => clearFilter(f.id)}>
                        <Icon name="x" size={14} />
                        <span>Clear</span>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        <div className="ctrl-spacer" />

        <div style={{ position: 'relative' }}>
          <button className="ctrlbtn" onClick={() => setMenu(menu === 'views' ? null : 'views')}>
            <Icon name="bookmark" size={14} />Saved views
            {views.length > 0 && <span className="ctrl-badge">{views.length}</span>}
            <Icon name="chevron-down" size={13} />
          </button>
          {menu === 'views' && (
            <div className="menu views-menu" style={{ top: 'calc(100% + 6px)', right: 0, minWidth: 252 }}>
              <div className="menu-label">Saved views</div>
              {views.length === 0 && <div className="menu-empty">No saved views yet</div>}
              {views.map((v) => (
                <div key={v.id} className="menu-item view-item">
                  <span className="vi-main" onClick={() => applyView(v)}>
                    <Icon name="bookmark" size={14} />
                    <span className="vi-name">{v.name}</span>
                  </span>
                  <button className="vi-del" title="Delete view" disabled={viewsBusy} onClick={() => removeView(v.id, v.name)}>
                    <Icon name="trash-2" size={13} />
                  </button>
                </div>
              ))}
              <div className="menu-sep" />
              <div className="view-save">
                <input
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Name this view…"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentView(); }}
                />
                <button className="vs-btn" disabled={!viewName.trim() || viewsBusy} onClick={saveCurrentView}>Save</button>
              </div>
            </div>
          )}
        </div>

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

        <button className="ctrlbtn" onClick={exportCsv}>
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
            <button className="bb-act" onClick={() => bulkAct('submit', 'Submitted')} disabled={bulkBusy}>
              <Icon name="send" size={14} />Submit
            </button>
            <button className="bb-act primary" onClick={() => bulkAct('approve', 'Approved')} disabled={bulkBusy}>
              <Icon name="check-circle-2" size={14} />Approve
            </button>
            <button className="bb-act" onClick={() => bulkAct('schedule', 'Scheduled')} disabled={bulkBusy}>
              <Icon name="calendar-clock" size={14} />Schedule
            </button>
            <button className="bb-act" onClick={() => bulkAct('pay', 'Paid')} disabled={bulkBusy}>
              <Icon name="banknote" size={14} />Mark paid
            </button>
            <button className="bb-act" onClick={exportCsv} disabled={bulkBusy}>
              <Icon name="download" size={14} />Export
            </button>
            <span className="bb-div" />
            <button className="bb-close" onClick={clearSel} title="Clear selection">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* CSV import preview */}
      {preview && (() => {
        const validCount = preview.rows.filter(rowValid).length;
        const skipCount = preview.rows.length - validCount;
        return (
          <div className="modal-scrim" onClick={() => setPreview(null)}>
            <div className="import-modal" onClick={(e) => e.stopPropagation()}>
              <div className="im-head">
                <div>
                  <div className="im-title">Import bills</div>
                  <div className="im-sub">{preview.fileName} · {preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''}</div>
                </div>
                <button className="im-x" onClick={() => setPreview(null)} aria-label="Close"><Icon name="x" size={18} /></button>
              </div>
              <div className="im-body">
                <table className="im-table">
                  <thead>
                    <tr>
                      <th className="im-sth" />
                      <th>Vendor</th>
                      <th>Invoice #</th>
                      <th className="num">Amount</th>
                      <th>Due</th>
                      <th>GL account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => {
                      const ok = rowValid(r);
                      const issue = ok ? '' : rowIssue(r);
                      return (
                        <tr key={i} className={ok ? '' : 'im-bad'}>
                          <td className="im-st"><Icon name={ok ? 'check-circle-2' : 'alert-triangle'} size={15} /></td>
                          <td>
                            <span className="im-vendor">{r.vendor || <span className="im-muted">—</span>}</span>
                            {issue && <span className="im-reason">{issue}</span>}
                          </td>
                          <td>{r.invoiceNumber || <span className="im-muted">—</span>}</td>
                          <td className="num">{Number.isFinite(r.amount) ? fmt(r.amount) : <span className="im-muted">—</span>}</td>
                          <td>{r.dueDate || <span className="im-muted">—</span>}</td>
                          <td>{r.gl || <span className="im-muted">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="im-foot">
                <button className="im-tmpl" onClick={downloadTemplate}><Icon name="download" size={14} />Download template</button>
                <span className="im-spacer" />
                <span className="im-count">{validCount} ready{skipCount > 0 ? ` · ${skipCount} skipped` : ''}</span>
                <button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={validCount === 0 || importBusy} onClick={confirmImport}>
                  <Icon name="upload" size={15} />Import {validCount} bill{validCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* click-away for the columns menu */}
      {menu && <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setMenu(null)} />}
    </div>
  );
}
