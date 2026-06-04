'use client';

import React, { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { createBill, updateBill, checkDuplicate } from '@/lib/actions/bills';
import { createAllocationTemplate } from '@/lib/actions/allocation-templates';
import type { NewBillFormData, BillFormInitial } from '@/lib/queries/new-bill';
import './bill-form.css';

type Split = { key: string; glLabel: string; amount: string };
type Line = { key: string; description: string; qty: string; unit: string; amount: string; glLabel: string; kind: 'expense' | 'item'; splits: Split[] };

export function BillForm({
  data,
  initial,
  editId,
}: {
  data: NewBillFormData;
  initial?: BillFormInitial;
  editId?: string;
}) {
  const router = useRouter();
  const firstGl = data.glAccounts[0]?.name ?? '';
  const seq = useRef(initial?.lines.length ?? 1);
  const splitSeq = useRef(0);
  const makeLine = (): Line => ({ key: `l${seq.current++}`, description: '', qty: '', unit: '', amount: '', glLabel: firstGl, kind: 'expense', splits: [] });
  const makeSplit = (): Split => ({ key: `s${splitSeq.current++}`, glLabel: firstGl, amount: '' });

  const [vendorId, setVendorId] = useState(initial?.vendorId ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [tax, setTax] = useState(initial?.tax ?? '');
  const [dupe, setDupe] = useState<{ invoiceNumber: string; amount: number; statusLabel: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>(() =>
    initial && initial.lines.length > 0
      ? initial.lines.map((l, i) => ({
          key: `l${i}`,
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          amount: l.amount,
          glLabel: l.glLabel,
          kind: l.kind,
          splits: l.splits.map((s, j) => ({ key: `l${i}s${j}`, glLabel: s.glLabel, amount: s.amount })),
        }))
      : [{ key: 'l0', description: '', qty: '', unit: '', amount: '', glLabel: firstGl, kind: 'expense' as const, splits: [] }],
  );
  const [saving, startSave] = useTransition();
  const [savingTemplate, startTemplate] = useTransition();

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };
  const subtotal = lines.reduce((s, l) => s + num(l.amount), 0);
  const taxNum = num(tax);
  const total = subtotal + taxNum;

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, makeLine()]);
  const removeLine = (key: string) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const mapSplits = (key: string, fn: (splits: Split[]) => Split[]) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, splits: fn(l.splits) } : l)));
  // Toggle the split editor: opening seeds one row, closing clears them so the
  // line falls back to carrying its own single GL.
  const toggleSplit = (key: string) =>
    mapSplits(key, (splits) => (splits.length > 0 ? [] : [makeSplit()]));
  const addSplit = (key: string) => mapSplits(key, (splits) => [...splits, makeSplit()]);
  const removeSplit = (lineKey: string, splitKey: string) =>
    mapSplits(lineKey, (splits) => splits.filter((s) => s.key !== splitKey));
  const updateSplit = (lineKey: string, splitKey: string, patch: Partial<Split>) =>
    mapSplits(lineKey, (splits) => splits.map((s) => (s.key === splitKey ? { ...s, ...patch } : s)));

  // Allocation templates — apply a saved split pattern to a line (distribute its
  // amount by the template's percentages; the last split absorbs the rounding
  // remainder), and save the current split as a reusable template.
  const relevantTemplates = data.allocationTemplates.filter((t) => t.vendorId === null || t.vendorId === vendorId);
  const applyTemplate = (lineKey: string, tmplId: string) => {
    const tmpl = data.allocationTemplates.find((t) => t.id === tmplId);
    const line = lines.find((l) => l.key === lineKey);
    if (!tmpl || !line) return;
    const totalCents = Math.round(num(line.amount) * 100);
    let allocated = 0;
    const next: Split[] = tmpl.lines.map((t, i) => {
      const cents = i === tmpl.lines.length - 1 ? totalCents - allocated : Math.round((totalCents * t.percentBps) / 10000);
      allocated += cents;
      return { ...makeSplit(), glLabel: t.glLabel, amount: (cents / 100).toString() };
    });
    mapSplits(lineKey, () => next);
  };
  const saveAsTemplate = (line: Line) => {
    const totalCents = Math.round(num(line.amount) * 100);
    const valid = line.splits.filter((s) => num(s.amount) > 0);
    if (totalCents <= 0 || valid.length === 0) return;
    const name = window.prompt('Name this allocation template');
    if (!name?.trim()) return;
    const tmplLines = valid.map((s) => ({ glLabel: s.glLabel, percentBps: Math.round(((num(s.amount) * 100) / totalCents) * 10000) }));
    startTemplate(async () => {
      const res = await createAllocationTemplate(name.trim(), tmplLines, vendorId || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const validLines = lines.filter((l) => l.description.trim() !== '' && num(l.amount) > 0);
  const canSave = vendorId !== '' && invoiceNumber.trim() !== '' && validLines.length > 0;

  // Non-blocking duplicate check: when we have both a vendor and an invoice #,
  // ask the server whether this vendor already has that invoice on file.
  const runDupeCheck = async () => {
    const inv = invoiceNumber.trim();
    if (vendorId === '' || inv === '') {
      setDupe(null);
      return;
    }
    const found = await checkDuplicate(vendorId, inv, editId);
    setDupe(found ? { invoiceNumber: found.invoiceNumber, amount: found.amount, statusLabel: found.statusLabel } : null);
  };

  const handleSave = () => {
    if (!canSave) return;
    setError(null);
    startSave(async () => {
      const payload = {
        vendorId,
        invoiceNumber: invoiceNumber.trim(),
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        memo: memo.trim() || null,
        taxCents: Math.round(taxNum * 100),
        lineItems: validLines.map((l) => {
          const splits = l.splits
            .filter((s) => num(s.amount) > 0)
            .map((s) => ({ glLabel: s.glLabel, amountCents: Math.round(num(s.amount) * 100) }));
          return {
            description: l.description.trim(),
            quantity: l.qty.trim() !== '' ? Math.round(num(l.qty)) : null,
            unitPriceCents: l.unit.trim() !== '' ? Math.round(num(l.unit) * 100) : null,
            amountCents: Math.round(num(l.amount) * 100),
            glLabel: l.glLabel,
            kind: l.kind,
            ...(splits.length > 0 ? { splits } : {}),
          };
        }),
      };
      const res = editId ? await updateBill(editId, payload) : await createBill(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/bills/${res.data}`);
    });
  };

  const isEdit = editId != null;
  const backHref = isEdit ? `/bills/${editId}` : '/bills';

  return (
    <div className="screen-bill-form">
      <div className="frame">
        <div className="nb-head">
          <Link href={backHref} className="nb-back" aria-label="Back"><Icon name="chevron-left" size={16} /></Link>
          <div className="nb-titles">
            <h1>{isEdit ? 'Edit bill' : 'New bill'}</h1>
            <div className="nb-sub">{isEdit ? 'Update this bill · Summit Waste Services' : 'Enter a bill and route it for approval · Summit Waste Services'}</div>
          </div>
        </div>

        <div className="nb-stack">
          {/* Vendor & bill */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="building-2" size={14} /></span>
              <span className="stage-title">Vendor &amp; bill</span>
            </div>
            <div className="nb-section">
              <div className="nb-grid">
                <label className="nb-field full">
                  <span className="nb-l">Vendor</span>
                  <div className="nb-selwrap">
                    <select className="nb-input" value={vendorId} onChange={(e) => { setVendorId(e.target.value); setDupe(null); }}>
                      <option value="" disabled>Select a vendor…</option>
                      {data.vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <Icon name="chevron-down" size={14} className="nb-selchev" />
                  </div>
                </label>
                <label className="nb-field">
                  <span className="nb-l">Invoice #</span>
                  <input className="nb-input mono" value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); setDupe(null); }} onBlur={() => void runDupeCheck()} placeholder="INV-1234" />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Memo</span>
                  <input className="nb-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional note" />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Issue date</span>
                  <input className="nb-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Due date</span>
                  <input className="nb-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="rows-3" size={14} /></span>
              <span className="stage-title">Line items</span>
            </div>
            <div className="nb-section">
              <table className="nb-lines">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="r nb-narrow">Qty</th>
                    <th className="r nb-narrow">Unit price</th>
                    <th className="r nb-narrow">Amount</th>
                    <th className="nb-glcol">GL account</th>
                    <th className="nb-rmcol" aria-label="remove" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const hasSplits = l.splits.length > 0;
                    const lineAmt = num(l.amount);
                    const splitSum = l.splits.reduce((s, sp) => s + num(sp.amount), 0);
                    const balanced = Math.abs(splitSum - lineAmt) < 0.005;
                    return (
                      <React.Fragment key={l.key}>
                        <tr>
                          <td>
                            <div className="nb-desc-cell">
                              <input className="nb-cell" value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} placeholder="Description" />
                              <button
                                type="button"
                                className={'nb-kind' + (l.kind === 'item' ? ' item' : '')}
                                onClick={() => updateLine(l.key, { kind: l.kind === 'expense' ? 'item' : 'expense' })}
                                title="Toggle line type — expense vs. item"
                              >
                                {l.kind === 'item' ? 'Item' : 'Expense'}
                              </button>
                            </div>
                          </td>
                          <td className="r"><input className="nb-cell r" inputMode="decimal" value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} placeholder="—" /></td>
                          <td className="r"><input className="nb-cell r" inputMode="decimal" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} placeholder="—" /></td>
                          <td className="r"><input className="nb-cell r money" inputMode="decimal" value={l.amount} onChange={(e) => updateLine(l.key, { amount: e.target.value })} placeholder="0.00" /></td>
                          <td>
                            {hasSplits ? (
                              <span className="nb-glsplit"><Icon name="git-fork" size={12} />Split across {l.splits.length} {l.splits.length === 1 ? 'account' : 'accounts'}</span>
                            ) : (
                              <div className="nb-selwrap">
                                <select className="nb-cell gl" value={l.glLabel} onChange={(e) => updateLine(l.key, { glLabel: e.target.value })}>
                                  {data.glAccounts.map((g) => (
                                    <option key={g.id} value={g.name}>{g.name}</option>
                                  ))}
                                </select>
                                <Icon name="chevron-down" size={12} className="nb-selchev" />
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="nb-rowtools">
                              <button type="button" className={'nb-split' + (hasSplits ? ' on' : '')} onClick={() => toggleSplit(l.key)} aria-pressed={hasSplits} aria-label={hasSplits ? 'Remove splits' : 'Split across GL accounts'} title="Split across GL accounts">
                                <Icon name="split" size={14} />
                              </button>
                              <button type="button" className="nb-rm" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label="Remove line">
                                <Icon name="x" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {hasSplits &&
                          l.splits.map((sp) => (
                            <tr className="nb-splitrow" key={sp.key}>
                              <td className="nb-split-lead"><Icon name="corner-down-right" size={13} /></td>
                              <td colSpan={2}>
                                <div className="nb-selwrap">
                                  <select className="nb-cell gl" value={sp.glLabel} onChange={(e) => updateSplit(l.key, sp.key, { glLabel: e.target.value })}>
                                    {data.glAccounts.map((g) => (
                                      <option key={g.id} value={g.name}>{g.name}</option>
                                    ))}
                                  </select>
                                  <Icon name="chevron-down" size={12} className="nb-selchev" />
                                </div>
                              </td>
                              <td className="r"><input className="nb-cell r money" inputMode="decimal" value={sp.amount} onChange={(e) => updateSplit(l.key, sp.key, { amount: e.target.value })} placeholder="0.00" /></td>
                              <td />
                              <td>
                                <button type="button" className="nb-rm" onClick={() => removeSplit(l.key, sp.key)} aria-label="Remove split">
                                  <Icon name="x" size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {hasSplits && (
                          <tr className="nb-splitfoot">
                            <td />
                            <td colSpan={5}>
                              <div className="nb-splitfoot-row">
                                <button type="button" className="nb-addsplit" onClick={() => addSplit(l.key)}><Icon name="plus" size={12} />Add split</button>
                                {relevantTemplates.length > 0 && (
                                  <div className="nb-selwrap nb-tmpl-pick">
                                    <select
                                      className="nb-tmpl-select"
                                      value=""
                                      onChange={(e) => { const v = e.target.value; if (v) applyTemplate(l.key, v); }}
                                    >
                                      <option value="">Apply template…</option>
                                      {relevantTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}{t.vendorId ? '' : ' · org'}</option>
                                      ))}
                                    </select>
                                    <Icon name="chevron-down" size={12} className="nb-selchev" />
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="nb-tmpl-save"
                                  disabled={!balanced || splitSum <= 0 || savingTemplate}
                                  onClick={() => saveAsTemplate(l)}
                                  title="Save this split as a reusable allocation template"
                                >
                                  <Icon name="bookmark" size={12} />Save template
                                </button>
                                <span className={'nb-splithint' + (balanced ? ' ok' : '')}>splits {fmt(splitSum)} / {fmt(lineAmt)}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="nb-addline" onClick={addLine}><Icon name="plus" size={14} />Add line</button>

              <div className="nb-tot">
                <div className="tr"><span>Subtotal</span><span className="tv">{fmt(subtotal)}</span></div>
                <div className="tr">
                  <span>Tax</span>
                  <span className="tv"><input className="nb-cell r money nb-taxinput" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" /></span>
                </div>
                <div className="tr grand"><span>Total</span><span className="tv">{fmt(total)}</span></div>
              </div>
            </div>
          </div>

          {/* Duplicate warning (non-blocking) */}
          {dupe && (
            <div className="nb-dupe" role="status">
              <Icon name="shield-alert" size={16} className="nb-dupe-ic" />
              <span className="nb-dupe-text">
                <b>Heads up</b> — {dupe.invoiceNumber} from this vendor already exists ({fmt(dupe.amount)} · {dupe.statusLabel}).
              </span>
            </div>
          )}

          {/* Server error (e.g. the not-editable guard or a validation failure) */}
          {error && (
            <div className="nb-error" role="alert">
              <Icon name="alert-triangle" size={16} className="nb-error-ic" />
              <span className="nb-error-text">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="nb-actions">
            <span className="nb-hint">
              {canSave ? (
                <><Icon name="check" size={13} style={{ color: 'var(--paid-ink)' }} />{isEdit ? 'Ready to save changes' : 'Ready to submit for approval'}</>
              ) : (
                <><Icon name="info" size={13} />Pick a vendor, add an invoice # and at least one line with an amount</>
              )}
            </span>
            <span className="spacer" />
            <Link href={backHref} className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
              <Icon name={saving ? 'loader' : 'check'} size={15} className={saving ? 'spin' : ''} />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create & submit for approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
