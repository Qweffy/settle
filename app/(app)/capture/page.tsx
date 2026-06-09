'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { runCapture, simulateInboundEmail } from '@/lib/actions/ocr';
import { createBillFromCapture } from '@/lib/actions/bills';
import type { OcrResult, OcrFlag, OcrLine } from '@/lib/ocr';
import {
  FORWARD_EMAIL,
  RECENT,
  RECENT_STATE,
  STEPS,
  DRAFT,
  LINES,
  TOTALS,
  GL_OPTIONS,
  FLAGS,
  SEV,
  type Draft,
  type LineItem,
  type LineFlag,
  type ReviewFlag,
  type FlagSev,
  type Totals,
} from '@/lib/data/capture';
import './capture.css';

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Settle">
      <rect width="100" height="100" rx="23" fill="#5E6AD2" />
      <path
        d="M68 36 C68 27 60 23 50 23 C39 23 31 28 31 37 C31 46 40 49 50 51 C60 53 69 56 69 66 C69 76 60 80 50 80 C40 80 32 76 32 67"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="12.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AiTag() {
  return <span className="ai-tag"><Icon name="sparkles" size={9} />AI</span>;
}

/* ============================== OcrResult → view-model mapping
   The view was built against the mock shapes in lib/data/capture.ts. These pure
   helpers translate a real OcrResult into those same shapes so the existing JSX
   and CSS render unchanged. */

// The view only renders two visual severities; collapse high → red, med/low → amber.
function sevToFlagSev(sev: OcrFlag['severity']): FlagSev {
  return sev === 'high' ? 'red' : 'amber';
}

// Reuse the design's icon language per anomaly type.
const FLAG_ICON: Record<OcrFlag['type'], string> = {
  anomalous_surcharge: 'trending-up',
  amount_deviation: 'trending-up',
  new_fee: 'plus-circle',
  possible_duplicate: 'copy',
  vendor_bank_change: 'shield-alert',
  missing_po: 'file-x',
  other: 'flag',
};

function flagToReview(flag: OcrFlag, i: number): ReviewFlag {
  return {
    id: `f${i + 1}`,
    sev: sevToFlagSev(flag.severity),
    icon: FLAG_ICON[flag.type] ?? 'flag',
    title: flag.title,
    reason: flag.message,
    cite: flag.lineRef ?? 'Header',
    fraud: flag.type === 'vendor_bank_change',
  };
}

function mapDraft(result: OcrResult): Draft {
  const { extraction, flags } = result;
  const hasPriorBills = flags.some((f) => f.type !== 'missing_po');
  return {
    vendor: extraction.vendorGuess,
    vendorMatched: true,
    vendorSub: hasPriorBills ? 'Matched · prior bills on file' : 'Matched',
    inv: extraction.invoiceNumber,
    issued: extraction.issueDate,
    due: extraction.dueDate,
    terms: DRAFT.terms,
    po: null,
    gl: extraction.lineItems[0]?.glGuess ?? DRAFT.gl,
    memo: DRAFT.memo,
    method: DRAFT.method,
    remit: DRAFT.remit,
    confidence: result.usedAI ? 96 : 92,
  };
}

// Decide a per-line risk dot from any flag that cites this line by index or text.
function lineFlagFor(line: OcrLine, index: number, flags: OcrFlag[]): { flag: LineFlag; isNew: boolean } {
  const matches = flags.filter((f) => citesLine(f.lineRef, line, index));
  if (matches.length === 0) return { flag: false, isNew: false };
  const sev: LineFlag = matches.some((f) => f.severity === 'high') ? 'red' : 'amber';
  return { flag: sev, isNew: matches.some((f) => f.type === 'new_fee') };
}

function citesLine(lineRef: string | undefined, line: OcrLine, index: number): boolean {
  if (!lineRef) return false;
  const ref = lineRef.toLowerCase();
  if (ref.includes(`line ${index + 1}`)) return true;
  const desc = line.description.toLowerCase();
  // Match on a meaningful chunk of the description (first few words).
  const stem = desc.split(/[—·]/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
  return stem.length > 0 && ref.includes(stem);
}

function mapLines(result: OcrResult): LineItem[] {
  return result.extraction.lineItems.map((l, i) => {
    const { flag, isNew } = lineFlagFor(l, i, result.flags);
    return {
      id: `l${i + 1}`,
      desc: l.description,
      qty: l.quantity != null ? `${l.quantity.toLocaleString('en-US')}` : '—',
      unit: l.unitPrice,
      amount: l.amount,
      gl: l.glGuess,
      flag,
      isNew: isNew || undefined,
    };
  });
}

function mapTotals(result: OcrResult): Totals {
  const { subtotal, tax, total } = result.extraction;
  return { subtotal, tax, total };
}

/* ============================== STAGE 1: UPLOAD */
function StageUpload({ onProcess, pending, onSimulate, simulating }: { onProcess: () => void; pending: boolean; onSimulate: () => void; simulating: boolean }) {
  return (
    <div className="stage">
      <div className="stage-head">
        <span className="stage-num">1</span><span className="stage-title">Upload</span>
        <span className="stage-cap"><span className="dot" style={{ background: 'var(--fg-3)' }} />Ready</span>
      </div>
      <div className="up-body">
        <div className="dropzone" role="button" tabIndex={0} onClick={pending ? undefined : onProcess} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !pending) { e.preventDefault(); onProcess(); } }}>
          <span className="dz-ic"><Icon name="upload-cloud" size={22} /></span>
          <span className="dz-title">Drop a PDF or image here</span>
          <span className="dz-sub">Drop a file, forward to <b>{FORWARD_EMAIL}</b>, or upload from your computer. Settle reads it automatically.</span>
          <button className="dz-btn" type="button" disabled={pending} onClick={(e) => { e.stopPropagation(); onProcess(); }}>
            <Icon name={pending ? 'loader' : 'sparkles'} size={14} className={pending ? 'spin' : ''} />{pending ? 'Reading…' : 'Process sample invoice'}
          </button>
        </div>

        <div className="forward">
          <span className="fw-ic"><Icon name="at-sign" size={16} /></span>
          <div className="fw-main">
            <div className="fw-l">Forwarding address</div>
            <div className="fw-mail">{FORWARD_EMAIL}</div>
          </div>
          <button className="fw-copy" onClick={onSimulate} disabled={simulating}>
            <Icon name={simulating ? 'loader' : 'inbox'} size={13} className={simulating ? 'spin' : ''} />
            {simulating ? 'Receiving…' : 'Simulate inbound'}
          </button>
        </div>

        <div>
          <div className="recent-label">Recent uploads</div>
          <div className="recent-list">
            {RECENT.map((r) => {
              const st = RECENT_STATE[r.state];
              return (
                <div className="recent-item" key={r.file}>
                  <div className="r-thumb"><div className="tl" /><div className="tl" /><div className="tl s" /><div className="tl" /></div>
                  <div className="r-main">
                    <div className="r-file">{r.file}</div>
                    <div className="r-meta">{r.vendor} · {r.size} · {r.time}</div>
                  </div>
                  <span className="r-state" style={{ background: `var(--${st.tone}-bg)`, color: `var(--${st.tone}-ink)` }}>
                    <Icon name={st.icon} size={12} className={r.state === 'reading' ? 'spin' : ''} />{st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== STAGE 2: PROCESSING */
function StageProcessing({ pending, done }: { pending: boolean; done: boolean }) {
  return (
    <div className="stage">
      <div className="stage-head">
        <span className="stage-num">2</span><span className="stage-title">Processing</span>
        <span className="stage-cap"><span className="dot" style={{ background: done ? 'var(--paid-solid)' : 'var(--review-solid)' }} />{done ? 'Read' : pending ? 'Reading…' : 'Idle'}</span>
      </div>
      <div className="proc-body">
        <div className="scan-wrap">
          <div className="scan-doc">
            <div className="sd-h" /><div className="sd-sub" />
            <div className="sd-row a" /><div className="sd-row b" /><div className="sd-row c" /><div className="sd-row d" /><div className="sd-row b" />
            <div className="sd-tot" />
            <div className="scan-line" />
          </div>
          <div className="scan-badge"><Icon name="scan-line" size={14} />Scanning page 1</div>
        </div>
        <div className="proc-main">
          <div className="proc-claude">
            <span className="pc-ic"><Icon name="sparkles" size={18} /></span>
            <div>
              <div className="pc-t">Settle is reading this invoice<span className="dots"><span /><span /><span /></span></div>
              <div className="pc-s">Regional_Landfill_INV-1046.pdf · 2 pages</div>
            </div>
          </div>
          <div className="proc-steps">
            {STEPS.map((s, i) => {
              const state = done || s.done ? 'done' : s.active ? 'active' : 'pending';
              return (
                <div className={'pstep ' + state} key={i}>
                  <span className="ps-ic"><Icon name={state === 'done' ? 'check' : state === 'active' ? 'loader' : 'circle'} size={12} className={state === 'active' ? 'spin' : ''} /></span>
                  <div className="ps-main">
                    <div className="ps-l">{s.label}</div>
                    <div className="ps-d">{s.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="proc-foot"><Icon name="lock" size={13} />Processed in your workspace · usually under 10 seconds</div>
        </div>
      </div>
    </div>
  );
}

/* ============================== STAGE 3: EXTRACTED DRAFT */
function GLDrop({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dli-gl-wrap">
      <button className="dli-gl" onClick={() => setOpen(!open)}>{value}<Icon name="chevron-down" size={11} /></button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setOpen(false)} />
          <div className="menu" style={{ top: 'calc(100% + 4px)', right: 0 }}>
            <div className="menu-label">GL account</div>
            {GL_OPTIONS.map((g) => (
              <div className="menu-item" key={g} onClick={() => { onChange(g); setOpen(false); }}>{g}{g === value && <Icon name="check" size={15} className="check" />}</div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
  ai,
  lead,
  empty,
  matched,
  sub,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ai?: boolean;
  lead?: string;
  empty?: boolean;
  matched?: boolean;
  sub?: string;
}) {
  return (
    <div className="df-field">
      <div className="df-l">{label}{ai && <AiTag />}{matched && <span className="matched"><Icon name="check" size={10} />Matched</span>}</div>
      <div className={'df-input' + (ai ? ' ai' : '')}>
        {lead && <Icon name={lead} size={15} className="lead" />}
        <span className={'v' + (mono ? ' mono' : '') + (empty ? ' empty' : '')}>{value}</span>
        <Icon name="chevron-down" size={14} className="chev" />
      </div>
      {sub && <div className="vendor-sub">{sub}</div>}
    </div>
  );
}

type Resolution = 'accept' | 'verify' | 'dismiss';

function StageDraft({
  draft,
  lineItems,
  totals,
  flags,
  usedAI,
  onSave,
  onDiscard,
  saving,
  canSave,
}: {
  draft: Draft;
  lineItems: LineItem[];
  totals: Totals;
  flags: ReviewFlag[];
  usedAI: boolean;
  onSave: (resolutions: Record<string, Resolution>) => void;
  onDiscard: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  const b = draft;
  const [lines, setLines] = useState<LineItem[]>(lineItems);
  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const setGL = (id: string, gl: string) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, gl } : l)));
  const resolve = (id: string, how: Resolution) => setResolved((r) => ({ ...r, [id]: how }));
  const openCount = flags.filter((f) => !resolved[f.id]).length;
  const highRisk = flags.filter((f) => f.sev === 'red' && !resolved[f.id]).length;

  return (
    <div className="stage">
      <div className="stage-head">
        <span className="stage-num">3</span><span className="stage-title">Extracted draft</span>
        <span className="stage-cap"><span className="dot" style={{ background: 'var(--approval-solid)' }} />Draft · not yet submitted</span>
      </div>
      <div className="draft-body">
        {/* form */}
        <div className="draft-form">
          <div className="df-banner">
            <Icon name="sparkles" size={16} />
            <span className="dfb-t"><b>Settle filled this in from the PDF.</b> Review the highlighted fields before saving.</span>
            <span className="dfb-spacer" />
            <span className="dfb-conf">{b.confidence}% confidence</span>
          </div>

          <div className="df-section">
            <div className="df-sh"><Icon name="building-2" size={15} /><span className="t">Vendor &amp; bill</span></div>
            <div className="df-grid">
              <div className="df-field full">
                <div className="df-l">Vendor<AiTag />{b.vendorMatched && <span className="matched"><Icon name="check" size={10} />Matched</span>}</div>
                <div className="df-input ai"><Icon name="building-2" size={15} className="lead" /><span className="v">{b.vendor}</span><Icon name="chevron-down" size={14} className="chev" /></div>
                <div className="vendor-sub">{b.vendorSub}</div>
              </div>
              <Field label="Invoice #" value={b.inv} mono ai />
              <Field label="PO #" value={b.po ?? 'Not found'} empty={!b.po} />
              <Field label="Issue date" value={b.issued} ai lead="calendar" />
              <Field label="Due date" value={`${b.due} · ${b.terms}`} ai lead="calendar-clock" />
              <div className="df-field full">
                <div className="df-l">Memo<AiTag /></div>
                <div className="df-input ai"><span className="v">{b.memo}</span><Icon name="pencil" size={14} className="chev" /></div>
              </div>
            </div>
          </div>

          <div className="df-section">
            <div className="df-sh"><Icon name="rows-3" size={15} /><span className="t">Line items</span><AiTag /></div>
            <table className="dli">
              <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit</th><th className="r">Amount</th><th>GL account</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td><div className="dli-desc">{l.flag && <span className="lflag" style={{ background: l.flag === 'red' ? 'var(--failed-solid)' : 'var(--review-solid)' }} />}{l.desc}{l.isNew && <span className="dli-new">New</span>}</div></td>
                    <td className="r"><span className="dli-qty">{l.qty}</span></td>
                    <td className="r"><span className="dli-unit">{l.unit != null ? fmt(l.unit) : '—'}</span></td>
                    <td className="r"><span className="dli-amt">{fmt(l.amount)}</span></td>
                    <td><GLDrop value={l.gl} onChange={(g) => setGL(l.id, g)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dli-tot">
              <div className="tr"><span>Subtotal</span><span className="tv">{fmt(totals.subtotal)}</span></div>
              <div className="tr"><span>Tax</span><span className="tv">{fmt(totals.tax)}</span></div>
              <div className="tr grand"><span>Total</span><span className="tv">{fmt(totals.total)}</span></div>
            </div>
          </div>

          <div className="df-actions">
            {!canSave
              ? <span className="df-hint"><Icon name="upload-cloud" size={13} />Process or upload an invoice to save</span>
              : highRisk > 0
              ? <span className="df-hint"><Icon name="shield-alert" size={13} style={{ color: 'var(--failed-ink)' }} />Resolve {highRisk} high-risk flag{highRisk === 1 ? '' : 's'} before approval</span>
              : <span className="df-hint"><Icon name="check" size={13} style={{ color: 'var(--paid-ink)' }} />No high-risk flags open</span>}
            <span className="spacer" />
            <button className="btn btn-ghost" onClick={onDiscard} disabled={!canSave || saving}><Icon name="trash-2" size={15} />Discard</button>
            <button className="btn btn-primary" onClick={() => onSave(resolved)} disabled={!canSave || saving} title={canSave ? undefined : 'Process or upload an invoice first'}>
              <Icon name={saving ? 'loader' : 'check'} size={15} className={saving ? 'spin' : ''} />
              {saving ? 'Saving…' : 'Save as draft for approval'}
            </button>
          </div>
        </div>

        {/* AI review */}
        <div className="draft-ai">
          <div className="dai-head">
            <Icon name="sparkles" size={16} /><span className="t">AI Bill Review</span>
            <span className="vendor-sub" style={{ margin: 0 }}>{usedAI ? 'Read by Claude' : 'Demo parse (no API key)'}</span>
            <span className="ct">{openCount} open</span>
          </div>
          <div className="dai-list">
            {flags.length === 0 && (
              <div className="dflag"><div className="dflag-top"><span className="dflag-ic" style={{ background: 'var(--paid-bg)', color: 'var(--paid-ink)' }}><Icon name="check" size={15} /></span><div className="dflag-main"><div className="dflag-title">No anomalies found</div></div></div><div className="dflag-body"><div className="dflag-reason">This invoice matches the vendor&apos;s history. Nothing flagged for review.</div></div></div>
            )}
            {flags.map((f) => {
              const sev = SEV[f.sev];
              const done = resolved[f.id];
              return (
                <div className={'dflag ' + f.sev + (f.fraud ? ' fraud' : '') + (done ? ' done' : '')} key={f.id}>
                  <div className="dflag-top">
                    <span className="dflag-ic" style={{ background: `var(${sev.bg})`, color: `var(${sev.ink})` }}><Icon name={f.icon} size={15} /></span>
                    <div className="dflag-main">
                      <div className="dflag-badges">
                        <span className="sev-badge" style={{ background: `var(${sev.bg})`, color: `var(${sev.ink})` }}>{sev.label}</span>
                        {f.fraud && <span className="fraud-badge"><Icon name="shield-alert" size={11} />Possible fraud</span>}
                      </div>
                      <div className="dflag-title">{f.title}</div>
                    </div>
                  </div>
                  <div className="dflag-body">
                    <div className="dflag-reason">{f.reason}</div>
                    <div className="dflag-cite"><Icon name="corner-down-right" size={11} />{f.cite}</div>
                    {done ? (
                      <div className="dflag-resolved"><Icon name={done === 'dismiss' ? 'circle-slash' : 'check-circle-2'} size={13} />{done === 'accept' ? 'Accepted' : done === 'verify' ? 'Verification requested' : 'Dismissed'} · just now</div>
                    ) : (
                      <div className="dflag-actions">
                        {f.fraud
                          ? <button className="fbtn verify" onClick={() => resolve(f.id, 'verify')}><Icon name="phone" size={12} />Verify vendor</button>
                          : <button className="fbtn accept" onClick={() => resolve(f.id, 'accept')}><Icon name="check" size={12} />Accept</button>}
                        <button className="fbtn dismiss" onClick={() => resolve(f.id, 'dismiss')}><Icon name="x" size={12} />Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CapturePage() {
  const router = useRouter();
  const [result, setResult] = useState<OcrResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isSimulating, startSimulate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleProcess = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await runCapture();
        setResult(res);
      } catch (e) {
        console.error('[capture] OCR failed:', e);
        setError("Couldn't read this invoice — please try again.");
      }
    });
  };

  const handleSave = (resolutions: Record<string, Resolution> = {}) => {
    if (!result) return;
    setError(null);
    startSave(async () => {
      try {
        const newId = await createBillFromCapture(result.extraction, result.flags, 'v-landfill', resolutions);
        router.push(`/bills/${newId}`);
      } catch (e) {
        console.error('[capture] save failed:', e);
        setError("Couldn't create the draft bill — please try again.");
      }
    });
  };

  // Demo the forwarding inbox: pretend an invoice just arrived by email and let
  // Settle OCR + draft it, landing on the new bill.
  const simulateInbound = () => {
    setError(null);
    startSimulate(async () => {
      try {
        const id = await simulateInboundEmail('v-landfill');
        router.push(`/bills/${id}`);
      } catch (e) {
        console.error('[capture] inbound simulation failed:', e);
        setError("Couldn't process the inbound invoice — please try again.");
      }
    });
  };

  // Before the first run, fall back to the design's mock so the page renders
  // identically; after a run, drive everything from the real OcrResult.
  const draft = result ? mapDraft(result) : DRAFT;
  const lineItems = result ? mapLines(result) : LINES;
  const totals = result ? mapTotals(result) : TOTALS;
  const reviewFlags = result ? result.flags.map(flagToReview) : FLAGS;
  const usedAI = result ? result.usedAI : false;

  return (
    <div className="screen-capture">
      <div className="frame">
        <div className="frame-head">
          <span className="fh-logo"><Logo /></span>
          <div className="fh-titles">
            <h1>Capture a bill</h1>
            <div className="fh-sub">Upload → AI review → Draft · Summit Waste Services</div>
          </div>
          <span className="fh-spacer" />
          <div className="stepper">
            <span className="step done"><span className="sn"><Icon name="check" size={12} /></span>Upload</span>
            <span className="step-line" />
            <span className={'step' + (isPending || result ? ' done' : '')}><span className="sn">{isPending || result ? <Icon name="check" size={12} /> : '2'}</span>Processing</span>
            <span className="step-line" />
            <span className={'step' + (result ? ' done' : '')}><span className="sn">3</span>Review</span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', marginBottom: 14,
              borderRadius: 10, background: 'var(--failed-bg)',
              border: '1px solid color-mix(in srgb, var(--failed-solid) 30%, transparent)',
              color: 'var(--failed-ink)', font: '600 12.5px var(--font-ui)',
            }}
          >
            <Icon name="alert-triangle" size={16} />
            {error}
          </div>
        )}

        <div className="top-row">
          <StageUpload onProcess={handleProcess} pending={isPending} onSimulate={simulateInbound} simulating={isSimulating} />
          <StageProcessing pending={isPending} done={!!result} />
        </div>
        {/* key remounts the draft so its local state (GL edits, resolved flags)
            resets to the freshly mapped data when a new result arrives. */}
        <StageDraft key={result ? draft.inv : 'mock'} draft={draft} lineItems={lineItems} totals={totals} flags={reviewFlags} usedAI={usedAI} onSave={handleSave} onDiscard={() => { setResult(null); setError(null); }} saving={isSaving} canSave={!!result} />
      </div>
    </div>
  );
}
