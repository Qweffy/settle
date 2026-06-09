'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { useActiveEntity } from '@/components/entity-context';
import { createVendor, updateVendor } from '@/lib/actions/vendors';
import type { VendorFormInitial } from '@/lib/queries/vendors-list';
import './vendor-form.css';

const TERMS_OPTIONS: { value: string; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
];
const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'ach', label: 'ACH' },
  { value: 'check', label: 'Check' },
  { value: 'wire', label: 'Wire' },
  { value: 'card', label: 'Card' },
];

export function VendorForm({ initial, editId }: { initial?: VendorFormInitial; editId?: string }) {
  const entity = useActiveEntity();
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [taxId, setTaxId] = useState(initial?.taxId ?? '');
  const [terms, setTerms] = useState(initial?.terms ?? 'net_30');
  const [defaultMethod, setDefaultMethod] = useState(initial?.defaultMethod ?? 'ach');
  const [bankLast4, setBankLast4] = useState(initial?.bankLast4 ?? '');
  const [defaultGl, setDefaultGl] = useState(initial?.defaultGl ?? '');
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = editId != null;
  const canSave = name.trim() !== '';
  const backHref = isEdit ? `/vendors/${editId}` : '/vendors';

  const handleSave = () => {
    if (!canSave) return;
    setError(null);
    startSave(async () => {
      try {
        const payload = { name, email, phone, address, taxId, terms, defaultMethod, bankLast4, defaultGl };
        const id = isEdit ? await updateVendor(editId, payload) : await createVendor(payload);
        router.push(`/vendors/${id}`);
      } catch (e) {
        // Keep the failure at this form — surface it inline instead of bubbling
        // to the route error boundary, so the entered details aren't lost.
        console.error('[vendor-form] save failed:', e);
        setError("Couldn't save this vendor — please try again.");
      }
    });
  };

  return (
    <div className="screen-vendor-form">
      <div className="frame">
        <div className="nb-head">
          <Link href={backHref} className="nb-back" aria-label="Back"><Icon name="chevron-left" size={16} /></Link>
          <div className="nb-titles">
            <h1>{isEdit ? 'Edit vendor' : 'New vendor'}</h1>
            <div className="nb-sub">{isEdit ? `Update this vendor · ${entity.name}` : `Add a vendor to pay bills against · ${entity.name}`}</div>
          </div>
        </div>

        <div className="nb-stack">
          {/* Identity */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="building-2" size={14} /></span>
              <span className="stage-title">Vendor details</span>
            </div>
            <div className="nb-section">
              <div className="nb-grid">
                <label className="nb-field full">
                  <span className="nb-l">Name</span>
                  <input className="nb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Disposal Inc." />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Billing email</span>
                  <input className="nb-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@vendor.com" />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Phone</span>
                  <input className="nb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                </label>
                <label className="nb-field full">
                  <span className="nb-l">Address</span>
                  <input className="nb-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Tax ID</span>
                  <input className="nb-input mono" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="00-0000000" />
                </label>
                <label className="nb-field">
                  <span className="nb-l">Default GL account</span>
                  <input className="nb-input" value={defaultGl} onChange={(e) => setDefaultGl(e.target.value)} placeholder="e.g. Tipping Fees" />
                </label>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="credit-card" size={14} /></span>
              <span className="stage-title">Payment defaults</span>
            </div>
            <div className="nb-section">
              <div className="nb-grid">
                <label className="nb-field">
                  <span className="nb-l">Payment terms</span>
                  <div className="nb-selwrap">
                    <select className="nb-input" value={terms} onChange={(e) => setTerms(e.target.value)}>
                      {TERMS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <Icon name="chevron-down" size={14} className="nb-selchev" />
                  </div>
                </label>
                <label className="nb-field">
                  <span className="nb-l">Default method</span>
                  <div className="nb-selwrap">
                    <select className="nb-input" value={defaultMethod} onChange={(e) => setDefaultMethod(e.target.value)}>
                      {METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <Icon name="chevron-down" size={14} className="nb-selchev" />
                  </div>
                </label>
                <label className="nb-field">
                  <span className="nb-l">Bank account (last 4)</span>
                  <input className="nb-input mono" value={bankLast4} onChange={(e) => setBankLast4(e.target.value)} placeholder="0000" maxLength={4} inputMode="numeric" />
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="nb-actions">
            <span className="nb-hint">
              {error ? (
                <><Icon name="alert-triangle" size={13} style={{ color: 'var(--failed-ink)' }} /><span style={{ color: 'var(--failed-ink)' }}>{error}</span></>
              ) : canSave ? (
                <><Icon name="check" size={13} style={{ color: 'var(--paid-ink)' }} />{isEdit ? 'Ready to save changes' : 'Ready to add this vendor'}</>
              ) : (
                <><Icon name="info" size={13} />Enter a vendor name to continue</>
              )}
            </span>
            <span className="spacer" />
            <Link href={backHref} className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-primary" onClick={handleSave} disabled={!canSave || saving}>
              <Icon name={saving ? 'loader' : 'check'} size={15} className={saving ? 'spin' : ''} />
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
