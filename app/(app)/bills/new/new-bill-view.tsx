'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { fmt } from '@/lib/format';
import { createBill } from '@/lib/actions/bills';
import type { NewBillFormData } from '@/lib/queries/new-bill';
import './new-bill.css';

type Line = { key: string; description: string; qty: string; unit: string; amount: string; glLabel: string };

export function NewBillView({ data }: { data: NewBillFormData }) {
  const router = useRouter();
  const seq = useRef(1);
  const firstGl = data.glAccounts[0]?.name ?? '';
  const makeLine = (): Line => ({ key: `l${seq.current++}`, description: '', qty: '', unit: '', amount: '', glLabel: firstGl });

  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [memo, setMemo] = useState('');
  const [tax, setTax] = useState('');
  const [lines, setLines] = useState<Line[]>(() => [
    { key: 'l0', description: '', qty: '', unit: '', amount: '', glLabel: firstGl },
  ]);
  const [saving, startSave] = useTransition();

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

  const validLines = lines.filter((l) => l.description.trim() !== '' && num(l.amount) > 0);
  const canSave = vendorId !== '' && invoiceNumber.trim() !== '' && validLines.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    startSave(async () => {
      const newId = await createBill({
        vendorId,
        invoiceNumber: invoiceNumber.trim(),
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        memo: memo.trim() || null,
        taxCents: Math.round(taxNum * 100),
        lineItems: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: l.qty.trim() !== '' ? Math.round(num(l.qty)) : null,
          unitPriceCents: l.unit.trim() !== '' ? Math.round(num(l.unit) * 100) : null,
          amountCents: Math.round(num(l.amount) * 100),
          glLabel: l.glLabel,
        })),
      });
      router.push(`/bills/${newId}`);
    });
  };

  return (
    <div className="screen-new-bill">
      <div className="frame">
        <div className="nb-head">
          <Link href="/bills" className="nb-back" aria-label="Back to bills"><Icon name="chevron-left" size={16} /></Link>
          <div className="nb-titles">
            <h1>New bill</h1>
            <div className="nb-sub">Enter a bill and route it for approval · Summit Waste Services</div>
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
                    <select className="nb-input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
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
                  <input className="nb-input mono" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1234" />
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
                  {lines.map((l) => (
                    <tr key={l.key}>
                      <td><input className="nb-cell" value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} placeholder="Description" /></td>
                      <td className="r"><input className="nb-cell r" inputMode="decimal" value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} placeholder="—" /></td>
                      <td className="r"><input className="nb-cell r" inputMode="decimal" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} placeholder="—" /></td>
                      <td className="r"><input className="nb-cell r money" inputMode="decimal" value={l.amount} onChange={(e) => updateLine(l.key, { amount: e.target.value })} placeholder="0.00" /></td>
                      <td>
                        <div className="nb-selwrap">
                          <select className="nb-cell gl" value={l.glLabel} onChange={(e) => updateLine(l.key, { glLabel: e.target.value })}>
                            {data.glAccounts.map((g) => (
                              <option key={g.id} value={g.name}>{g.name}</option>
                            ))}
                          </select>
                          <Icon name="chevron-down" size={12} className="nb-selchev" />
                        </div>
                      </td>
                      <td>
                        <button type="button" className="nb-rm" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label="Remove line">
                          <Icon name="x" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
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

          {/* Actions */}
          <div className="nb-actions">
            <span className="nb-hint">
              {canSave ? (
                <><Icon name="check" size={13} style={{ color: 'var(--paid-ink)' }} />Ready to submit for approval</>
              ) : (
                <><Icon name="info" size={13} />Pick a vendor, add an invoice # and at least one line with an amount</>
              )}
            </span>
            <span className="spacer" />
            <Link href="/bills" className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
              <Icon name={saving ? 'loader' : 'check'} size={15} className={saving ? 'spin' : ''} />
              {saving ? 'Creating…' : 'Create & submit for approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
