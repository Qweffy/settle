'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { schedulePayment, markPaid } from '@/lib/actions/bills';
import {
  METHODS,
  STATUS,
  type PaymentMethodKey,
  type PaymentModal,
  type PaymentRow,
  type PaymentStatusKey,
} from '@/lib/data/payments';
import type { PaymentsData } from '@/lib/queries/payments';
import { Toast, type ToastData } from '@/components/toast';
import './payments.css';

type Tab = 'scheduled' | 'paid';

function StatusPill({ status }: { status: PaymentStatusKey }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className="pill" style={{ background: `var(${s.bg})`, color: `var(${s.ink})` }}>
      <span className="dot" style={{ background: `var(${s.solid})` }} />{s.label}
    </span>
  );
}

function MethodCell({ method }: { method: PaymentMethodKey }) {
  const m = METHODS[method];
  return (
    <div className="method">
      <span className="mi"><Icon name={m.icon} size={14} /></span>
      <div><div className="ml">{m.label}</div><div className="ms">{m.sub}</div></div>
    </div>
  );
}

function PayTable({
  rows,
  tab,
  onRow,
  onMarkPaid,
}: {
  rows: PaymentRow[];
  tab: Tab;
  onRow: (r: PaymentRow) => void;
  onMarkPaid: (r: PaymentRow) => void;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="tbl-card">
      <table className="pay">
        <thead>
          <tr>
            <th>Vendor</th>
            <th className="r">Amount</th>
            <th className="method-col">Method</th>
            <th>{tab === 'scheduled' ? 'Pay date' : 'Paid date'}</th>
            <th>Status</th>
            <th className="pay-ref-col">Reference</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onRow(r)}>
              <td>
                <div className="pv-cell">
                  <span className="pv-av">{r.mono}</span>
                  <div><div className="pv-n">{r.vendor}</div>{r.bills > 1 && <div className="pv-bills">{r.bills} bills consolidated</div>}</div>
                </div>
              </td>
              <td className="r"><span className="pay-amt">{fmt(r.amount)}</span></td>
              <td className="method-col"><MethodCell method={r.method} /></td>
              <td><span className="pay-date">{r.date}</span></td>
              <td><StatusPill status={r.status} /></td>
              <td className="pay-ref-col"><span className="pay-ref">{r.ref}</span></td>
              <td className="r">
                {tab === 'scheduled' && (
                  <span className="row-act" title="Mark paid" onClick={(e) => { e.stopPropagation(); onMarkPaid(r); }}><Icon name="check-circle-2" size={16} /></span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="pay-foot">
            <td><span className="fl">{tab === 'scheduled' ? 'Scheduled total' : 'Paid total'}</span></td>
            <td className="r"><span className="fv">{fmt(total)}</span></td>
            <td colSpan={5}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ScheduleModal({
  modal,
  busy,
  onClose,
  onSchedule,
}: {
  modal: PaymentModal;
  busy: boolean;
  onClose: () => void;
  onSchedule: (billIds: string[], method: PaymentMethodKey, date: string, summary: string) => void;
}) {
  const m = modal;
  const [checked, setChecked] = useState<Set<string>>(() => new Set(m.openBills.filter((b) => b.checked).map((b) => b.id)));
  const [method, setMethod] = useState<PaymentMethodKey>('ach');
  const [date, setDate] = useState('Jun 12, 2026');
  const [ref, setRef] = useState('');

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selBills = m.openBills.filter((b) => checked.has(b.id));
  const total = selBills.reduce((s, b) => s + b.amount, 0);
  const methodLabel = m.methods.find((x) => x.id === method)?.label ?? '';

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mh-ic"><Icon name="calendar-plus" size={18} /></span>
          <div>
            <div className="mh-t">Schedule payment</div>
            <div className="mh-s">Pay one or more approved bills in a single transfer</div>
          </div>
          <button className="mh-x" onClick={onClose}><Icon name="x" size={17} /></button>
        </div>

        <div className="modal-body">
          {/* vendor */}
          <div className="mfield">
            <div className="mlabel">Vendor</div>
            <div className="vendor-pick">
              <span className="vp-av">{m.mono}</span>
              <div><div className="vp-n">{m.vendor}</div><div className="vp-s">{m.terms} · ACH ••1234</div></div>
            </div>
          </div>

          {/* bills with consolidation hint */}
          <div className="mfield">
            <div className="mlabel">Bills to pay<span className="ml-r">{selBills.length} of {m.openBills.length} selected</span></div>
            <div className="consolidate">
              <Icon name="layers" size={15} className="ci" />
              <div className="ct"><b>{m.vendor}</b> has {m.openBills.length} approved bills. Pay them together to send <b>one</b> ACH instead of {m.openBills.length} — fewer fees and one reference for reconciliation.</div>
            </div>
            {m.openBills.map((b) => {
              const on = checked.has(b.id);
              return (
                <div className={'bill-opt' + (on ? ' on' : '')} key={b.id} onClick={() => toggle(b.id)}>
                  <span className={'cbox' + (on ? ' on' : '')}><Icon name="check" size={12} /></span>
                  <div className="bo-main">
                    <div className="bo-inv">{b.inv}</div>
                    <div className="bo-sub">Due {b.due} · {b.gl}</div>
                  </div>
                  <span className="bo-amt">{fmt(b.amount)}</span>
                </div>
              );
            })}
          </div>

          {/* method */}
          <div className="mfield">
            <div className="mlabel">Payment method</div>
            <div className="method-grid">
              {m.methods.map((mo) => {
                const on = method === mo.id;
                return (
                  <div className={'method-opt' + (on ? ' on' : '')} key={mo.id} onClick={() => setMethod(mo.id)}>
                    <span className="mo-ic"><Icon name={mo.icon} size={16} /></span>
                    <div className="mo-main"><div className="mo-l">{mo.label}</div><div className="mo-s">{mo.sub}</div></div>
                    <span className="radio" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* pay date + reference */}
          <div className="mfield">
            <div className="mrow">
              <div>
                <div className="mlabel">Pay date</div>
                <div className="minput"><Icon name="calendar" size={15} /><input value={date} onChange={(e) => setDate(e.target.value)} /></div>
              </div>
              <div>
                <div className="mlabel">Reference <span className="ml-r">optional</span></div>
                <div className="minput mono"><Icon name="hash" size={15} /><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="auto: PMT-20619" /></div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <div className="mf-total">
            <div className="mf-tl">Total payment</div>
            <div className="mf-tv">{fmt(total)}</div>
            <div className="mf-sub">{selBills.length} bill{selBills.length !== 1 ? 's' : ''} · {methodLabel} · {date}</div>
          </div>
          <div className="mf-spacer" />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={selBills.length === 0 || busy}
            onClick={() => {
              onSchedule(
                selBills.map((b) => b.id),
                method,
                date,
                `Scheduled ${fmt(total)} to ${m.vendor} for ${date}`,
              );
              onClose();
            }}
          >
            <Icon name="check" size={15} />Schedule {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentsView({ data }: { data: PaymentsData }) {
  const [tab, setTab] = useState<Tab>('scheduled');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const showToast = (m: string, tone?: ToastData['tone']) => {
    setToast({ title: m, tone });
    setTimeout(() => setToast(null), 2600);
  };

  // Run a payment action with optimistic feedback. The server action is the
  // source of truth: refresh on success, surface the error on failure.
  const run = (label: string, action: () => Promise<void>) => {
    if (busy) return; // guard against double-submit while a transition is in flight
    showToast(label);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch {
        showToast('Something went wrong — please try again', 'red');
      }
    });
  };

  const handleSchedule = (billIds: string[], method: PaymentMethodKey, date: string, summary: string) =>
    run(summary, () => Promise.all(billIds.map((id) => schedulePayment(id, method, date))).then(() => undefined));

  const handleMarkPaid = (r: PaymentRow) => run(`Marked ${r.vendor} · ${fmt(r.amount)} paid`, () => markPaid(r.billId));

  const rows = tab === 'scheduled' ? data.scheduled : data.paid;

  return (
    <div className="screen-payments">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Payments</h1>
            <div className="ph-sub">Money out · Summit Waste Services · Operating ••4821</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="calendar-plus" size={15} />Schedule payment</button>
          </div>
        </div>

        <div className="psum">
          <div className="ptile"><div className="pl">Scheduled (next 14 days)</div><div className="pv">{fmt(data.schedTotal)}</div><div className="pm"><span className="pdot" style={{ background: 'var(--scheduled-solid)' }} />{data.scheduled.length} payments queued</div></div>
          <div className="ptile"><div className="pl">Paid this month</div><div className="pv">{fmt(data.paidTotal)}</div><div className="pm"><span className="pdot" style={{ background: 'var(--paid-solid)' }} />{data.paidCount} payments cleared</div></div>
          <div className="ptile"><div className="pl">Needs attention</div><div className="pv">{fmt(data.failedTotal)}</div><div className="pm"><span className="pdot" style={{ background: 'var(--failed-solid)' }} />{data.failedCount} payment{data.failedCount !== 1 ? 's' : ''} failed</div></div>
        </div>

        <div className="tabs-row">
          <div className="tabs">
            <button className={'tab' + (tab === 'scheduled' ? ' on' : '')} onClick={() => setTab('scheduled')}>Scheduled<span className="tc">{data.scheduled.length}</span></button>
            <button className={'tab' + (tab === 'paid' ? ' on' : '')} onClick={() => setTab('paid')}>Paid<span className="tc">{data.paid.length}</span></button>
          </div>
          <div className="tr-spacer" />
          <div className="tr-search"><Icon name="search" size={14} /><input placeholder="Search vendor or reference…" /></div>
        </div>

        <PayTable rows={rows} tab={tab} onRow={(r) => showToast(`Opening ${r.ref}`)} onMarkPaid={handleMarkPaid} />
      </div>

      {modal && data.modal && <ScheduleModal modal={data.modal} busy={busy} onClose={() => setModal(false)} onSchedule={handleSchedule} />}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
