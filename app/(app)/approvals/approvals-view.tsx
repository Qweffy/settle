'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { approveBill, rejectBill } from '@/lib/actions/bills';
import type { ActionResult } from '@/lib/result';
import { GROUPS, SEV, type ApprovalBill } from '@/lib/data/approvals';
import { Check, type CheckState } from '@/components/check';
import { Toast, type ToastData } from '@/components/toast';
import type { ApprovalsData } from '@/lib/queries/approvals';
import './approvals.css';

function ARow({
  b,
  active,
  selected,
  gone,
  onOpen,
  onToggle,
  onApprove,
  onReject,
}: {
  b: ApprovalBill;
  active: boolean;
  selected: boolean;
  gone: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div
      className={'arow' + (active ? ' active' : '') + (selected ? ' sel' : '') + (gone ? ' gone' : '')}
      onClick={() => onOpen(b.id)}
    >
      <Check state={selected ? 'on' : 'off'} onClick={() => onToggle(b.id)} />
      <span className="arow-av">{b.mono}</span>
      <div className="arow-main">
        <div className="arow-l1">
          <span className="arow-vendor">{b.vendor}</span>
          <span className="arow-gl">· {b.gl}</span>
        </div>
        <div className={'arow-summary ' + (b.flagged ? 'flagged' : 'clean')}>
          <Icon name={b.flagged ? 'flag' : 'check-circle-2'} size={13} />
          <span className="stext">{b.summary}</span>
        </div>
      </div>
      <div className="arow-due">
        <div className="arow-amt">{fmt(b.amount)}</div>
        <div className={'arow-duehint ' + b.urgency}>{b.due} · {b.dueHint}</div>
      </div>
      <div className="arow-acts">
        <button className="act-btn reject" title="Reject" onClick={(e) => { e.stopPropagation(); onReject(b.id); }}>
          <Icon name="x" size={16} />
        </button>
        <button className="act-btn approve" title="Approve" onClick={(e) => { e.stopPropagation(); onApprove(b.id); }}>
          <Icon name="check" size={16} />
        </button>
      </div>
    </div>
  );
}

function StatusPill() {
  return (
    <span className="pill" style={{ background: 'var(--approval-bg)', color: 'var(--approval-ink)' }}>
      <span className="dot" style={{ background: 'var(--approval-solid)' }} />In approval
    </span>
  );
}

function Preview({
  bill,
  approverMono,
  onApprove,
  onReject,
}: {
  bill: ApprovalBill | null;
  approverMono: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (!bill) {
    return (
      <div className="pv-empty">
        <span className="ei"><Icon name="mouse-pointer-click" size={22} /></span>
        <span className="et">Select a bill to preview</span>
        <span className="es">Its coding, AI review, and approval chain show here — approve without leaving the queue.</span>
      </div>
    );
  }
  const total = bill.lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="pv">
      <div className="pv-head">
        <div className="pv-top">
          <span className="pv-av">{bill.mono}</span>
          <div className="pv-id">
            <div className="pv-vendor">{bill.vendor}</div>
            <div className="pv-inv">{bill.inv} · {bill.gl}</div>
          </div>
          <Link className="pv-openbtn" href={`/bills/${bill.id}`}><Icon name="maximize-2" size={13} />Open</Link>
        </div>
        <div className="pv-amtrow">
          <div><div className="pv-amt">{fmt(bill.amount)}</div><div className="pv-amtlbl">via {bill.method} · {bill.account}</div></div>
          <StatusPill />
        </div>
        <div className="pv-due"><Icon name="calendar-clock" size={14} />Due {bill.due}<span className="dh">· {bill.dueHint}</span></div>
      </div>

      <div className="pv-section">
        <div className="pv-sh"><Icon name="user-round" size={13} />Submitted</div>
        <div className="pv-meta">
          <span className="av">{bill.submittedMono}</span>
          <span className="mt"><b>{bill.submittedBy}</b> submitted this on {bill.submittedTime}</span>
        </div>
      </div>

      <div className="pv-section">
        <div className="pv-sh"><Icon name="rows-3" size={13} />Line items<span className="sh-r">{bill.lines.length} lines</span></div>
        {bill.lines.map((l, i) => (
          <div className="pv-line" key={i}>
            <span className="pl-desc">{l.desc}</span>
            <span className="pl-gl">{l.gl}</span>
            <span className="pl-amt">{fmt(l.amount)}</span>
          </div>
        ))}
        <div className="pv-total"><span className="tl">Total</span><span className="tv">{fmt(total)}</span></div>
      </div>

      <div className="pv-section">
        <div className="pv-sh"><Icon name="sparkles" size={13} />AI Bill Review{bill.flags.length > 0 && <span className="sh-r">{bill.flags.length} {bill.flags.length === 1 ? 'flag' : 'flags'}</span>}</div>
        {bill.flags.length === 0 ? (
          <div className="pv-clean"><span className="ci"><Icon name="check" size={15} /></span>No issues found — matches this vendor’s history.</div>
        ) : (
          bill.flags.map((f, i) => {
            const sev = SEV[f.sev];
            return (
              <div className="pv-flag" key={i}>
                <span className="pf-dot" style={{ background: `var(${sev.solid})` }} />
                <div className="pf-main">
                  <div className="pf-top"><span className="pf-title">{f.title}</span><span className="sev-badge" style={{ background: `var(${sev.bg})`, color: `var(${sev.ink})` }}>{sev.label}</span></div>
                  <div className="pf-reason">{f.reason}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pv-section">
        <div className="pv-sh"><Icon name="git-merge" size={13} />Approval chain</div>
        <div className="chain">
          <span className="step you"><span className="av">{approverMono}</span>You</span>
          {bill.requiresSecond && bill.secondApprover ? (
            <>
              <span className="carrow"><Icon name="arrow-right" size={14} /></span>
              <span className="step pending"><span className="av">{bill.secondApprover.split(' ').map((w) => w[0]).join('')}</span>{bill.secondApprover}</span>
            </>
          ) : (
            <span className="step pending" style={{ border: 'none', background: 'transparent', color: 'var(--fg-3)', fontWeight: 500 }}>Final approver</span>
          )}
        </div>
      </div>

      <div className="pv-actions">
        <button className="btn pv-reject" onClick={() => onReject(bill.id)}><Icon name="x" size={15} />Reject</button>
        <button className="btn btn-primary" onClick={() => onApprove(bill.id)}><Icon name="check" size={15} />Approve bill</button>
      </div>
    </div>
  );
}

export function ApprovalsView({ data }: { data: ApprovalsData }) {
  const [bills, setBills] = useState<ApprovalBill[]>(data.bills);
  const [active, setActive] = useState<string | null>(data.bills[0]?.id ?? null);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [removing, setRemoving] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastData | null>(null);
  const [scope, setScope] = useState('mine');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const showToast = (m: string, tone?: ToastData['tone']) => {
    setToast({ title: m, tone });
    setTimeout(() => setToast(null), 2400);
  };
  const liveBills = bills.filter((b) => !removing.has(b.id));
  const activeBill = liveBills.find((b) => b.id === active) || null;

  const visIds = liveBills.map((b) => b.id);
  const allOn = visIds.length > 0 && visIds.every((id) => sel.has(id));
  const headState: CheckState = allOn ? 'on' : sel.size > 0 ? 'partial' : 'off';

  const toggleRow = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSel(() => (allOn ? new Set() : new Set(visIds)));

  const removeBills = (ids: string[]) => {
    setRemoving((r) => {
      const n = new Set(r);
      ids.forEach((id) => n.add(id));
      return n;
    });
    setSel((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    setTimeout(() => {
      setBills((bs) => {
        const next = bs.filter((b) => !ids.includes(b.id));
        // advance preview to next remaining bill
        setActive((cur) => (cur && ids.includes(cur) ? (next[0] ? next[0].id : null) : cur));
        return next;
      });
      setRemoving((r) => {
        const n = new Set(r);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    }, 220);
  };

  // Re-insert bills that were optimistically removed but whose action failed.
  const restoreBills = (restore: ApprovalBill[]) => {
    if (restore.length === 0) return;
    const ids = restore.map((b) => b.id);
    setRemoving((r) => {
      const n = new Set(r);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    setBills((bs) => {
      const present = new Set(bs.map((b) => b.id));
      const missing = restore.filter((b) => !present.has(b.id));
      if (missing.length === 0) return bs;
      // keep them in their original queue order
      return [...bs, ...missing].sort(
        (a, c) => data.bills.findIndex((b) => b.id === a.id) - data.bills.findIndex((b) => b.id === c.id),
      );
    });
  };

  // Optimistically fade the rows out, then run the server action(s). The action
  // is the source of truth: on success we refresh from the server; on failure we
  // restore the rows and surface the error.
  const runWorkflow = (
    ids: string[],
    action: (id: string) => Promise<void | ActionResult<unknown>>,
    okToast: string,
    failVerb: string,
  ) => {
    if (pending) return; // ignore re-entry while a workflow is already running
    const affected = bills.filter((b) => ids.includes(b.id));
    if (affected.length === 0) return;
    showToast(okToast);
    removeBills(ids);
    startTransition(async () => {
      try {
        const results = await Promise.all(ids.map((id) => action(id)));
        // If any bill returned a business error (e.g. the approval gate), undo
        // the optimistic removal and surface that real message.
        const failed = results.find((r) => r && r.ok === false);
        if (failed && failed.ok === false) {
          restoreBills(affected);
          showToast(failed.error, 'red');
          return;
        }
        router.refresh();
      } catch {
        restoreBills(affected);
        showToast(`Couldn’t ${failVerb} — please try again`, 'red');
      }
    });
  };

  const approveOne = (id: string) => {
    const b = bills.find((x) => x.id === id);
    runWorkflow([id], approveBill, b ? `Approved ${b.vendor} · ${fmt(b.amount)}` : 'Approved', 'approve');
  };
  const rejectOne = (id: string) => {
    const b = bills.find((x) => x.id === id);
    runWorkflow([id], (billId) => rejectBill(billId), b ? `Rejected ${b.vendor}` : 'Rejected', 'reject');
  };
  const approveSelected = () => {
    const ids = [...sel];
    const sum = bills.filter((b) => ids.includes(b.id)).reduce((s, b) => s + b.amount, 0);
    runWorkflow(ids, approveBill, `Approved ${ids.length} bills · ${fmt(sum)}`, 'approve the selected bills');
  };
  const rejectSelected = () => {
    const ids = [...sel];
    runWorkflow(ids, (billId) => rejectBill(billId), `Rejected ${ids.length} bills`, 'reject the selected bills');
  };

  const selBills = bills.filter((b) => sel.has(b.id) && !removing.has(b.id));
  const selSum = selBills.reduce((s, b) => s + b.amount, 0);
  const totalSum = liveBills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="screen-approvals">
      <div className="page-head">
        <div>
          <h1>Approvals<span className="ph-pill">{liveBills.length} awaiting you</span></h1>
          <div className="ph-sub">Bills routed to {data.approverName} · {fmt(totalSum)} total · grouped by urgency</div>
        </div>
        <div className="ph-actions">
          <div className="seg">
            <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>Awaiting me</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => { setScope('all'); showToast('Showing all open approvals'); }}>All open</button>
          </div>
        </div>
      </div>

      <div className="queue">
        <div className="list-col">
          <div className="list-tools">
            <label className="selall"><Check state={headState} onClick={toggleAll} />Select all</label>
            <span className="lt-spacer" />
            <span className="lt-meta">{liveBills.length} bills · {fmt(totalSum)}</span>
          </div>

          {GROUPS.map((g) => {
            const rows = liveBills.filter((b) => b.urgency === g.id);
            const allRows = bills.filter((b) => b.urgency === g.id); // include removing for fade
            if (allRows.length === 0) return null;
            const sum = rows.reduce((s, b) => s + b.amount, 0);
            return (
              <div className="group" key={g.id}>
                <div className="group-head">
                  <span className="group-dot" style={{ background: `var(${g.tone})` }} />
                  <span className="group-label">{g.label}</span>
                  <span className="group-note">· {g.note}</span>
                  <span className="gh-spacer" />
                  <span className="group-sum">{fmt(sum)}</span>
                  <span className="group-count">· {rows.length}</span>
                </div>
                {allRows.map((b) => (
                  <ARow
                    key={b.id}
                    b={b}
                    active={active === b.id}
                    selected={sel.has(b.id)}
                    gone={removing.has(b.id)}
                    onOpen={setActive}
                    onToggle={toggleRow}
                    onApprove={approveOne}
                    onReject={rejectOne}
                  />
                ))}
              </div>
            );
          })}

          {liveBills.length === 0 && (
            <div className="pv-empty" style={{ height: 'auto', paddingTop: 80 }}>
              <span className="ei"><Icon name="check-check" size={22} /></span>
              <span className="et">You’re all caught up</span>
              <span className="es">No bills awaiting your approval. New bills appear here as soon as they’re submitted.</span>
            </div>
          )}
        </div>

        <div className="preview-col">
          <Preview bill={activeBill} approverMono={data.approverMono} onApprove={approveOne} onReject={rejectOne} />
        </div>
      </div>

      {selBills.length > 0 && (
        <div className="bulkbar-wrap">
          <div className="bulkbar">
            <span className="bb-count"><span className="bb-badge">{selBills.length}</span>selected</span>
            <span className="bb-sum">· {fmt(selSum)}</span>
            <span className="bb-div" />
            <button className="bb-act primary" onClick={approveSelected}><Icon name="check" size={14} />Approve selected</button>
            <button className="bb-act reject" onClick={rejectSelected}><Icon name="x" size={14} />Reject</button>
            <span className="bb-div" />
            <button className="bb-close" onClick={() => setSel(new Set())} title="Clear"><Icon name="x" size={16} /></button>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
