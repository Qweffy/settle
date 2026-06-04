'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { approveBill, rejectBill, schedulePayment, resolveFlag, addComment as addCommentAction } from '@/lib/actions/bills';
import type { ActionResult } from '@/lib/result';
import {
  GL_OPTIONS,
  SEV,
  type Bill,
  type Line,
  type Totals,
  type Flag,
  type HistoryItem,
  type BodySegment,
  type TimelineNode,
  type Person,
} from '@/lib/data/cockpit';
import type { CockpitData } from '@/lib/queries/cockpit';
import { roleLabel } from '@/lib/approval-rules';
import './cockpit.css';

type PaymentMethod = 'ach' | 'check' | 'wire' | 'card';

// Reverse of the query's METHOD_LABEL map: display label → action method key.
const METHOD_KEY: Record<string, PaymentMethod> = {
  ACH: 'ach',
  Check: 'check',
  Wire: 'wire',
  Card: 'card',
};

// schedulePayment stores `new Date(payDate)`; an ISO date is the most robust input.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------- primitives ---------- */
function StatusPill({ status, label }: { status: Bill['status']; label: string }) {
  const map: Record<string, [string, string, string]> = {
    approval: ['--approval-bg', '--approval-ink', '--approval-solid'],
    paid: ['--paid-bg', '--paid-ink', '--paid-solid'],
  };
  const [bg, ink, solid] = map[status] || map.approval;
  return (
    <span className="pill" style={{ background: `var(${bg})`, color: `var(${ink})` }}>
      <span className="dot" style={{ background: `var(${solid})` }} />
      {label}
    </span>
  );
}

/* ---------- bill header ---------- */
function BillHeader({
  bill: b,
  flagCount,
  busy,
  approvalGate,
  onApprove,
  onReject,
  onSchedule,
}: {
  bill: Bill;
  flagCount: number;
  busy: boolean;
  approvalGate: CockpitData['approvalGate'];
  onApprove: () => void;
  onReject: () => void;
  onSchedule: () => void;
}) {
  const blockedByGate = approvalGate != null && !approvalGate.canApprove;
  return (
    <div className="billhead">
      <div className="bh-row">
        <Link className="bh-back" href="/bills"><Icon name="arrow-left" size={15} />Bills</Link>
        <div className="bh-id">
          <span className="bh-av">{b.mono}</span>
          <div className="bh-titles">
            <div className="bh-vendor">{b.vendor}</div>
            <div className="bh-meta">
              <span className="inv">{b.inv}</span>
              <span className="sepdot" /><span>{b.gl}</span>
              <span className="sepdot" /><span>Issued {b.issued}</span>
              <span className="sepdot" /><span>{b.terms}</span>
            </div>
          </div>
        </div>
        <div className="bh-spacer" />
        <div className="bh-amt-wrap">
          <div className="bh-amt">{fmt(b.amount)}</div>
          <div className="bh-amt-sub">via {b.method} · {b.account}</div>
        </div>
        <StatusPill status={b.status} label={b.statusLabel} />
        <span className="due-chip"><Icon name="calendar-clock" size={14} />{b.due} · {b.dueHint}</span>
        <div className="bh-actions">
          {approvalGate && (
            <span
              className={'gate-chip' + (approvalGate.canApprove ? ' met' : '')}
              title={approvalGate.label}
            >
              <Icon name={approvalGate.canApprove ? 'shield-check' : 'shield-alert'} size={13} />
              Requires {roleLabel(approvalGate.requiredRole)}
            </span>
          )}
          <button className="btn btn-danger" onClick={onReject} disabled={busy}><Icon name="x" size={15} />Reject</button>
          <Link href={`/bills/${b.id}/edit`} className="btn btn-ghost"><Icon name="pencil" size={15} />Edit</Link>
          <button className="btn btn-ghost" onClick={onSchedule} disabled={busy}><Icon name="calendar-clock" size={15} />Schedule payment</button>
          <button
            className="btn btn-primary"
            onClick={onApprove}
            disabled={busy || blockedByGate}
            title={blockedByGate ? `Switch to a ${roleLabel(approvalGate.requiredRole)} in the top-right to approve` : undefined}
          >
            <Icon name="check" size={15} />Approve
          </button>
        </div>
      </div>
      {b.flagged && (
        <div className="banner">
          <Icon name="alert-triangle" size={18} className="bn-ic" />
          <span className="bn-text"><b>Needs review.</b> Settle AI flagged {flagCount} issue{flagCount === 1 ? '' : 's'} on this bill — review them before approving.</span>
          <span className="bn-spacer" />
          <span className="bn-link">Jump to review<Icon name="arrow-down" size={14} /></span>
        </div>
      )}
    </div>
  );
}

/* ---------- LEFT: PDF viewer ---------- */
function InvoiceDoc({ bill: b, lines, totals }: { bill: Bill; lines: Line[]; totals: Totals }) {
  return (
    <div className="doc">
      <div className="doc-top">
        <div className="doc-brand">
          <span className="doc-logo">{b.mono}</span>
          <div><div className="db-n">{b.vendor}</div><div className="db-s">Fleet Fuel Statement</div></div>
        </div>
        <div className="doc-inv-label"><div className="dl-t">STATEMENT</div><div className="dl-s">{b.inv}</div></div>
      </div>
      <div className="doc-rule" />
      <div className="doc-grid">
        <div className="doc-field"><div className="df-l">Billed to</div><div className="df-v">Summit Waste Services<br />1400 Transfer Station Rd<br />Tacoma, WA 98421</div></div>
        <div className="doc-field"><div className="df-l">Account</div><div className="df-v">WEX ••4471-02<br />{b.terms} terms</div></div>
        <div className="doc-field"><div className="df-l">Statement date</div><div className="df-v">{b.issued}</div></div>
        <div className="doc-field"><div className="df-l">Payment due</div><div className="df-v">{b.due}</div></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.desc}</td>
              <td className="r">{l.qty}</td>
              <td className="r">{fmt(l.unit)}</td>
              <td className="r">{fmt(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="doc-tot">
        <div className="tr"><span>Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
        <div className="tr"><span>Tax</span><span>{fmt(totals.tax)}</span></div>
        <div className="tr grand"><span>Total due</span><span>{fmt(totals.total)}</span></div>
      </div>
      <div className="doc-note">Remit by ACH to WEX Bank, routing ••0142, account ••8830. Surcharge indexed to the regional diesel spot price published weekly by the EIA. Questions: fleet-billing@wexinc.example · (800) 555-0142.</div>
    </div>
  );
}

function LeftPanel({ bill, lines, totals }: { bill: Bill; lines: Line[]; totals: Totals }) {
  const [zoom, setZoom] = useState(100);
  const [rot, setRot] = useState(0);
  return (
    <section className="panel left">
      <div className="panel-bar">
        <span className="pb-title"><Icon name="file-text" size={15} />{bill.inv}.pdf</span>
        <span className="pb-spacer" />
        <button className="tool" title="Zoom out" onClick={() => setZoom((z) => Math.max(50, z - 10))}><Icon name="zoom-out" size={15} /></button>
        <span className="zoom-val">{zoom}%</span>
        <button className="tool" title="Zoom in" onClick={() => setZoom((z) => Math.min(180, z + 10))}><Icon name="zoom-in" size={15} /></button>
        <button className="tool" title="Rotate" onClick={() => setRot((r) => r + 90)}><Icon name="rotate-cw" size={15} /></button>
        <button className="tool" title="Fit" onClick={() => { setZoom(100); setRot(0); }}><Icon name="maximize-2" size={15} /></button>
        <span className="pageinfo">1 / 1</span>
        <button className="tool" title="Download"><Icon name="download" size={15} /></button>
      </div>
      <div className="viewer">
        <div className="viewer-inner" style={{ transform: `scale(${zoom / 100}) rotate(${rot}deg)` }}>
          <InvoiceDoc bill={bill} lines={lines} totals={totals} />
        </div>
      </div>
    </section>
  );
}

/* ---------- CENTER: coding ---------- */
function GLDropdown({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button className="gl-select" onClick={() => setOpen(!open)}>{value}<Icon name="chevron-down" size={12} /></button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setOpen(false)} />
          <div className="menu" style={{ top: 'calc(100% + 4px)', right: 0, minWidth: 170 }}>
            <div className="menu-label">GL account</div>
            {GL_OPTIONS.map((g) => (
              <div key={g} className="menu-item gl-opt" onClick={() => { onChange(g); setOpen(false); }}>
                {g}{g === value && <Icon name="check" size={15} className="check" style={{ marginLeft: 'auto' }} />}
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function CenterPanel({
  bill: b,
  lines: initialLines,
  totals,
  flags,
  history,
  onResolveFlag,
}: {
  bill: Bill;
  lines: Line[];
  totals: Totals;
  flags: Flag[];
  history: HistoryItem[];
  onResolveFlag: (flagId: string, how: 'accept' | 'dismiss', revert: () => void) => void;
}) {
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [splits, setSplits] = useState<Set<string>>(() => new Set(initialLines.filter((l) => l.split).map((l) => l.id)));
  const [resolved, setResolved] = useState<Record<string, 'accept' | 'dismiss'>>({});

  const setGL = (id: string, gl: string) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, gl } : l)));
  const toggleSplit = (id: string) =>
    setSplits((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const resolve = (fid: string, how: 'accept' | 'dismiss') => {
    // optimistic: mark resolved locally, the action is the source of truth.
    setResolved((r) => ({ ...r, [fid]: how }));
    onResolveFlag(fid, how, () =>
      setResolved((r) => {
        const n = { ...r };
        delete n[fid];
        return n;
      }),
    );
  };
  const openCount = flags.filter((f) => !resolved[f.id]).length;

  return (
    <section className="panel center">
      <div className="panel-bar">
        <span className="pb-title"><Icon name="list-tree" size={15} />Coding &amp; review</span>
        <span className="pb-spacer" />
        <button className="tool" title="Reconcile to QuickBooks"><Icon name="arrow-left-right" size={15} /></button>
        <button className="tool" title="More"><Icon name="more-horizontal" size={15} /></button>
      </div>
      <div className="center-scroll">
        {/* details */}
        <div className="card">
          <div className="card-h"><Icon name="file-text" size={16} className="ch-ic" /><span className="ch-t">Bill details</span><span className="ch-spacer" /><span className="ch-act"><Icon name="pencil" size={13} />Edit</span></div>
          <div className="fields">
            <div className="field"><div className="fl">Vendor</div><div className="fv">{b.vendor}</div></div>
            <div className="field"><div className="fl">Invoice #</div><div className="fv"><span className="mono">{b.inv}</span></div></div>
            <div className="field"><div className="fl">Issue date</div><div className="fv"><Icon name="calendar" size={14} />{b.issued}</div></div>
            <div className="field"><div className="fl">Due date</div><div className="fv"><Icon name="calendar-clock" size={14} />{b.due}</div></div>
            <div className="field editable full"><div className="fl">Memo</div><div className="fv">{b.memo}<Icon name="pencil" size={13} className="edit-ic" /></div></div>
          </div>
        </div>

        {/* line items */}
        <div className="card">
          <div className="card-h"><Icon name="rows-3" size={16} className="ch-ic" /><span className="ch-t">Line items</span><span className="ch-spacer" /><span className="ch-act"><Icon name="plus" size={13} />Add line</span></div>
          <div className="li-wrap">
            <table className="li">
              <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Amount</th><th>GL account</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const lineSplits = l.splits ?? [];
                  const hasSplits = lineSplits.length > 0;
                  return (
                    <Fragment key={l.id}>
                      <tr>
                        <td><div className="li-desc">{l.flag && <Icon name="flag" size={14} className="lflag" />}{l.desc}</div></td>
                        <td className="r"><span className="li-qty">{l.qty}</span></td>
                        <td className="r"><span className="li-unit">{fmt(l.unit)}</span></td>
                        <td className="r"><span className="li-amt">{fmt(l.amount)}</span></td>
                        <td>{hasSplits ? <span className="li-glsplit"><Icon name="git-fork" size={12} />Split</span> : <GLDropdown value={l.gl} onChange={(g) => setGL(l.id, g)} />}</td>
                        <td><span className={'li-split' + (splits.has(l.id) || hasSplits ? ' on' : '')} title="Split across GL accounts" onClick={() => toggleSplit(l.id)}><Icon name="split" size={14} /></span></td>
                      </tr>
                      {lineSplits.map((s, i) => (
                        <tr className="li-splitrow" key={`${l.id}-s${i}`}>
                          <td colSpan={4}>
                            <div className="li-split-line"><Icon name="corner-down-right" size={13} className="li-split-arrow" /><span className="li-split-gl">{s.gl}</span></div>
                          </td>
                          <td className="r"><span className="li-split-amt">{fmt(s.amount)}</span></td>
                          <td />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="li-tot">
              <div className="tr"><span>Subtotal</span><span className="tv">{fmt(totals.subtotal)}</span></div>
              <div className="tr"><span>Tax</span><span className="tv">{fmt(totals.tax)}</span></div>
              <div className="tr grand"><span>Total</span><span className="tv">{fmt(totals.total)}</span></div>
            </div>
          </div>
        </div>

        {/* AI review */}
        <div className="card ai-card">
          <div className="card-h ai-h"><Icon name="sparkles" size={16} className="ch-ic" /><span className="ch-t">AI Bill Review</span><span className="ch-spacer" /><span className="ai-count">{openCount} open</span></div>
          {flags.map((f) => {
            const sev = SEV[f.sev];
            const done = resolved[f.id];
            return (
              <div className={'flag-item' + (done ? ' done' : '')} key={f.id}>
                <span className="flag-dot" style={{ background: `var(${sev.solid})` }} />
                <div className="flag-main">
                  <div className="flag-top">
                    <span className="flag-title">{f.title}</span>
                    <span className="sev-badge" style={{ background: `var(${sev.bg})`, color: `var(${sev.ink})` }}>{sev.label}</span>
                  </div>
                  <div className="flag-reason">{f.reason}</div>
                  <div className="flag-cite"><Icon name="corner-down-right" size={12} />{f.cite}</div>
                  {done ? (
                    <div className="flag-resolved"><Icon name={done === 'accept' ? 'check-circle-2' : 'circle-slash'} size={14} />{done === 'accept' ? 'Accepted' : 'Dismissed'} · just now</div>
                  ) : (
                    <div className="flag-actions">
                      <button className="flag-btn accept" onClick={() => resolve(f.id, 'accept')}><Icon name="check" size={12} />Accept</button>
                      <button className="flag-btn dismiss" onClick={() => resolve(f.id, 'dismiss')}><Icon name="x" size={12} />Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* history strip */}
        <div className="card">
          <div className="card-h"><Icon name="history" size={16} className="ch-ic" /><span className="ch-t">This vendor’s last {history.length === 1 ? 'invoice' : `${history.length} invoices`}</span><span className="ch-spacer" /><span className="ch-act">All from {b.vendor}<Icon name="arrow-right" size={13} /></span></div>
          <div className="hist-strip">
            {history.map((h) => (
              <div className="hist-card" key={h.inv} title={h.inv}>
                <div className="hist-thumb"><div className="tl l" /><div className="tl m" /><div className="tl s" /><div className="tl amt" /></div>
                <div className="hist-meta"><div className="hist-inv">{h.inv}</div><div className="hist-amt">{fmt(h.amount)}</div><div className="hist-date">Paid {h.date}</div></div>
              </div>
            ))}
            <div className="hist-current">
              <Icon name="receipt" size={18} className="ic" />
              <span className="ht">This bill</span>
              <span className="ha">{fmt(b.amount)}</span>
              <span className="trend-up"><Icon name="trending-up" size={11} />+6.7%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- RIGHT: timeline + composer ---------- */
function CommentBody({ body }: { body: BodySegment[] }) {
  return (
    <span>
      {body.map((s, i) =>
        s.t === 'mention' ? <span className="mention" key={i}>{s.v}</span> : <span key={i}>{s.v}</span>,
      )}
    </span>
  );
}

function RightPanel({ timeline, people, onSend }: { timeline: TimelineNode[]; people: Person[]; onSend: (raw: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'comments' | 'events'>('all');
  const [text, setText] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = timeline.filter((t) =>
    filter === 'all' ? true : filter === 'comments' ? t.kind === 'comment' : t.kind === 'event',
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline.length]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    const m = v.slice(0, e.target.selectionStart).match(/@(\w*)$/);
    setMentionOpen(!!m);
  };
  const pickMention = (p: Person) => {
    setText((t) => t.replace(/@(\w*)$/, `@${p.name} `));
    setMentionOpen(false);
    if (taRef.current) taRef.current.focus();
  };
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    setMentionOpen(false);
  };

  return (
    <section className="panel right">
      <div className="panel-bar">
        <span className="pb-title"><Icon name="messages-square" size={15} />Activity &amp; comments</span>
        <span className="pb-spacer" />
        <div className="tl-filter">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'comments' ? 'on' : ''} onClick={() => setFilter('comments')}>Comments</button>
          <button className={filter === 'events' ? 'on' : ''} onClick={() => setFilter('events')}>Activity</button>
        </div>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-list">
          {items.map((t) => (
            <div className="tl-node" key={t.id}>
              {t.kind === 'comment' ? (
                <>
                  <span className={'tl-bullet av ' + t.mono.toLowerCase()} style={{ color: 'var(--fg-on-accent)', background: 'var(--primary)' }}>{t.mono}</span>
                  <div className="tl-comment">
                    <div className="tl-cm-top"><span className="tl-cm-name">{t.who}</span><span className="tl-cm-time">{t.time}</span></div>
                    <div className="tl-cm-body"><CommentBody body={t.body} /></div>
                  </div>
                </>
              ) : (
                <>
                  <span className={'tl-bullet' + (t.accent ? ' ' + t.accent : '') + (t.pending ? ' pending' : '')}><Icon name={t.icon} size={11} /></span>
                  <div className={t.pending ? 'tl-comment pending-card' : ''} style={t.pending ? {} : { paddingTop: 0 }}>
                    <div className="tl-event"><b>{t.who}</b> {t.text}{t.sub && <div className="tl-sub">{t.sub}</div>}</div>
                    <div className="tl-time">{t.time}</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="composer" style={{ position: 'relative' }}>
        {mentionOpen && (
          <div className="mention-pop">
            <div className="mh">Mention someone</div>
            {people.map((p) => (
              <div className="mention-row" key={p.id} onClick={() => pickMention(p)}>
                <span className="mr-av">{p.mono}</span><span className="mr-n">{p.name}</span><span className="mr-r">{p.role}</span>
              </div>
            ))}
          </div>
        )}
        <div className="composer-box">
          <textarea
            ref={taRef}
            value={text}
            onChange={onChange}
            rows={1}
            placeholder="Add a comment…  @mention to loop someone in"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }}
          />
          <div className="composer-foot">
            <button
              className="cf-tool"
              title="Mention"
              onClick={() => {
                setText((t) => t + '@');
                setMentionOpen(true);
                if (taRef.current) taRef.current.focus();
              }}
            >
              <Icon name="at-sign" size={15} />
            </button>
            <button className="cf-tool" title="Attach"><Icon name="paperclip" size={15} /></button>
            <button className="cf-tool" title="Emoji"><Icon name="smile" size={15} /></button>
            <span className="cf-spacer" />
            <button className="send" disabled={!text.trim()} onClick={send}><Icon name="send-horizontal" size={13} />Comment</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- page ---------- */
export function CockpitView({ data }: { data: CockpitData }) {
  const { bill, lines, totals, flags, history, roles } = data;
  const [timeline, setTimeline] = useState<TimelineNode[]>(data.timeline);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // The current user (approver) authors new comments. @mentions resolve
  // against the org's people.
  const me = roles.find((r) => r.name === bill.approver) ?? roles[0];
  const mentionNames = roles.map((r) => r.name);
  const escapeName = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Run a bill action with optimistic feedback. The server action is the source
  // of truth: refresh on success, surface the error (and run `revert`) on failure.
  const run = (
    label: string,
    action: () => Promise<void | ActionResult<unknown>>,
    revert?: () => void,
  ) => {
    showToast(label);
    startTransition(async () => {
      try {
        const res = await action();
        // Business errors (the approval gate) come back as data, not a throw.
        if (res && res.ok === false) {
          revert?.();
          showToast(res.error);
          return;
        }
        router.refresh();
      } catch {
        revert?.();
        showToast('Something went wrong — please try again');
      }
    });
  };

  const handleApprove = () => run('Bill approved', () => approveBill(bill.id));
  const handleReject = () => run('Bill rejected', () => rejectBill(bill.id));
  const handleSchedule = () =>
    run('Payment scheduled', () =>
      schedulePayment(bill.id, METHOD_KEY[bill.method] ?? 'ach', isoDaysFromNow(5)),
    );

  const handleResolveFlag = (flagId: string, how: 'accept' | 'dismiss', revert: () => void) => {
    const status = how === 'accept' ? 'accepted' : 'dismissed';
    run(how === 'accept' ? 'Flag accepted' : 'Flag dismissed', () => resolveFlag(flagId, status), revert);
  };

  const addComment = (raw: string) => {
    // split @Name tokens into mention segments + collect the mentioned user ids.
    const body: BodySegment[] = [];
    const mentionIds: string[] = [];
    if (mentionNames.length > 0) {
      const re = new RegExp(`(@(?:${mentionNames.map(escapeName).join('|')}))`, 'g');
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw))) {
        if (m.index > last) body.push({ t: 'text', v: raw.slice(last, m.index) });
        body.push({ t: 'mention', v: m[1] });
        const person = roles.find((r) => `@${r.name}` === m![1]);
        if (person && !mentionIds.includes(person.id)) mentionIds.push(person.id);
        last = m.index + m[1].length;
      }
      if (last < raw.length) body.push({ t: 'text', v: raw.slice(last) });
    } else {
      body.push({ t: 'text', v: raw });
    }
    const node: TimelineNode = { id: 'c' + Date.now(), kind: 'comment', who: me?.name ?? 'You', mono: me?.mono ?? 'Y', time: 'Just now', body };
    // insert before the trailing pending event (optimistic)
    setTimeline((tl) => {
      const pendIdx = tl.findIndex((x) => x.kind === 'event' && x.pending);
      if (pendIdx === -1) return [...tl, node];
      return [...tl.slice(0, pendIdx), node, ...tl.slice(pendIdx)];
    });
    run('Comment added', () => addCommentAction(bill.id, raw, mentionIds), () =>
      setTimeline((tl) => tl.filter((x) => x.id !== node.id)),
    );
  };

  return (
    <>
      <div className="screen-cockpit">
        <BillHeader
          bill={bill}
          flagCount={flags.length}
          busy={busy}
          approvalGate={data.approvalGate}
          onApprove={handleApprove}
          onReject={handleReject}
          onSchedule={handleSchedule}
        />
        <div className="cockpit">
          <LeftPanel bill={bill} lines={lines} totals={totals} />
          <CenterPanel bill={bill} lines={lines} totals={totals} flags={flags} history={history} onResolveFlag={handleResolveFlag} />
          <RightPanel timeline={timeline} people={roles} onSend={addComment} />
        </div>
      </div>
      {toast && (
        <div className="screen-cockpit-toast">
          <Icon name="check-circle-2" size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
