'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { createGlAccount, updateGlAccount } from '@/lib/actions/settings';
import { APPROVAL_RULES, roleLabel } from '@/lib/approval-rules';
import type { SettingsData, SettingsGlAccount } from '@/lib/queries/settings';
import { fmt } from '@/lib/format';
import './settings.css';

type ToneMeta = { label: string; bg: string; ink: string };

const GL_TYPE_TONE: Record<string, ToneMeta> = {
  expense: { label: 'Expense', bg: '--draft-bg', ink: '--draft-ink' },
  asset: { label: 'Asset', bg: '--scheduled-bg', ink: '--scheduled-ink' },
  liability: { label: 'Liability', bg: '--review-bg', ink: '--review-ink' },
  income: { label: 'Income', bg: '--paid-bg', ink: '--paid-ink' },
};

const GL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'income', label: 'Income' },
];

const ROLE_TONE: Record<string, ToneMeta> = {
  controller: { label: 'Controller', bg: '--approval-bg', ink: '--approval-ink' },
  approver: { label: 'Approver', bg: '--scheduled-bg', ink: '--scheduled-ink' },
  clerk: { label: 'AP Clerk', bg: '--draft-bg', ink: '--draft-ink' },
};

function TonePill({ tone, label }: { tone: ToneMeta; label: string }) {
  return (
    <span className="pill" style={{ background: `var(${tone.bg})`, color: `var(${tone.ink})` }}>
      {label}
    </span>
  );
}

function GlTypePill({ type }: { type: string }) {
  const tone = GL_TYPE_TONE[type] ?? GL_TYPE_TONE.expense;
  return <TonePill tone={tone} label={tone.label} />;
}

type Draft = { code: string; name: string; type: string };
const emptyDraft = (): Draft => ({ code: '', name: '', type: 'expense' });

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [pending, startTransition] = useTransition();

  const accounts = data.glAccounts;
  const canAdd = draft.code.trim() !== '' && draft.name.trim() !== '';
  const canSaveEdit = editDraft.code.trim() !== '' && editDraft.name.trim() !== '';

  const rules = useMemo(
    () =>
      APPROVAL_RULES.map((r) => ({
        id: r.id,
        threshold: fmt(r.amountGtCents / 100),
        role: r.requiredRole,
        roleName: roleLabel(r.requiredRole),
      })),
    [],
  );

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
  };
  const cancelAdd = () => {
    setAdding(false);
    setDraft(emptyDraft());
  };
  const submitAdd = () => {
    if (!canAdd || pending) return;
    startTransition(async () => {
      await createGlAccount({ code: draft.code, name: draft.name, type: draft.type });
      setAdding(false);
      setDraft(emptyDraft());
      router.refresh();
    });
  };

  const startEdit = (acc: SettingsGlAccount) => {
    setAdding(false);
    setEditingId(acc.id);
    setEditDraft({ code: acc.code, name: acc.name, type: acc.type });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };
  const submitEdit = (id: string) => {
    if (!canSaveEdit || pending) return;
    startTransition(async () => {
      await updateGlAccount(id, { code: editDraft.code, name: editDraft.name, type: editDraft.type });
      setEditingId(null);
      setEditDraft(emptyDraft());
      router.refresh();
    });
  };

  return (
    <div className="screen-settings">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Settings</h1>
            <div className="ph-sub">Chart of accounts, approval policy and organization · {data.org.name}</div>
          </div>
        </div>

        <div className="set-stack">
          {/* Chart of accounts */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="book-open" size={14} /></span>
              <span className="stage-title">Chart of accounts</span>
              <span className="stage-count">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              <span className="stage-spacer" />
              {!adding && (
                <button type="button" className="btn btn-ghost stage-action" onClick={startAdd}>
                  <Icon name="plus" size={15} />Add GL account
                </button>
              )}
            </div>
            <div className="stage-body">
              <table className="set-gl">
                <thead>
                  <tr>
                    <th className="c-code">Code</th>
                    <th>Name</th>
                    <th className="c-type">Type</th>
                    <th className="c-edit" aria-label="edit" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) =>
                    editingId === acc.id ? (
                      <tr key={acc.id} className="set-editrow">
                        <td className="c-code">
                          <input
                            className="nb-input mono"
                            value={editDraft.code}
                            onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))}
                            placeholder="6000"
                            aria-label="Account code"
                          />
                        </td>
                        <td>
                          <input
                            className="nb-input"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            placeholder="Account name"
                            aria-label="Account name"
                          />
                        </td>
                        <td className="c-type">
                          <div className="nb-selwrap">
                            <select
                              className="nb-input"
                              value={editDraft.type}
                              onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                              aria-label="Account type"
                            >
                              {GL_TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <Icon name="chevron-down" size={14} className="nb-selchev" />
                          </div>
                        </td>
                        <td className="c-edit">
                          <div className="set-rowactions">
                            <button type="button" className="set-iconbtn" onClick={cancelEdit} aria-label="Cancel">
                              <Icon name="x" size={14} />
                            </button>
                            <button
                              type="button"
                              className="set-iconbtn primary"
                              onClick={() => submitEdit(acc.id)}
                              disabled={!canSaveEdit || pending}
                              aria-label="Save account"
                            >
                              <Icon name={pending ? 'loader' : 'check'} size={14} className={pending ? 'spin' : ''} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={acc.id}>
                        <td className="c-code"><span className="set-code">{acc.code}</span></td>
                        <td><span className="set-name">{acc.name}</span></td>
                        <td className="c-type"><GlTypePill type={acc.type} /></td>
                        <td className="c-edit">
                          <button type="button" className="set-iconbtn" onClick={() => startEdit(acc)} aria-label={`Edit ${acc.name}`}>
                            <Icon name="pencil" size={14} />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}

                  {adding && (
                    <tr className="set-editrow">
                      <td className="c-code">
                        <input
                          className="nb-input mono"
                          value={draft.code}
                          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                          placeholder="6000"
                          aria-label="Account code"
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          className="nb-input"
                          value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="e.g. Tipping Fees"
                          aria-label="Account name"
                        />
                      </td>
                      <td className="c-type">
                        <div className="nb-selwrap">
                          <select
                            className="nb-input"
                            value={draft.type}
                            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                            aria-label="Account type"
                          >
                            {GL_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <Icon name="chevron-down" size={14} className="nb-selchev" />
                        </div>
                      </td>
                      <td className="c-edit">
                        <div className="set-rowactions">
                          <button type="button" className="set-iconbtn" onClick={cancelAdd} aria-label="Cancel">
                            <Icon name="x" size={14} />
                          </button>
                          <button
                            type="button"
                            className="set-iconbtn primary"
                            onClick={submitAdd}
                            disabled={!canAdd || pending}
                            aria-label="Save account"
                          >
                            <Icon name={pending ? 'loader' : 'check'} size={14} className={pending ? 'spin' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {accounts.length === 0 && !adding && (
                    <tr className="set-emptyrow">
                      <td colSpan={4}>
                        <div className="set-empty">
                          <Icon name="book-open" size={18} />
                          No GL accounts yet. Add your first account to categorize bills.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approval rules */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="shield-check" size={14} /></span>
              <span className="stage-title">Approval rules</span>
              <span className="stage-spacer" />
              <span className="stage-tag"><Icon name="lock" size={12} />Read-only</span>
            </div>
            <div className="stage-body">
              <ul className="set-rules">
                {rules.map((r) => (
                  <li key={r.id} className="set-rule">
                    <Icon name="corner-down-right" size={15} className="set-rule-ic" />
                    <span className="set-rule-text">
                      Bills over <span className="set-amt">{r.threshold}</span>
                      <Icon name="arrow-right" size={13} className="set-rule-arrow" />
                    </span>
                    <TonePill tone={ROLE_TONE[r.role] ?? ROLE_TONE.clerk} label={r.roleName} />
                  </li>
                ))}
              </ul>
              <div className="set-note">
                <Icon name="info" size={13} />
                These thresholds are enforced automatically when a bill is submitted for approval.
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="stage">
            <div className="stage-head">
              <span className="stage-ic"><Icon name="building-2" size={14} /></span>
              <span className="stage-title">Organization</span>
            </div>
            <div className="stage-body">
              <div className="set-org">
                <span className="set-org-mono">{data.org.mono ?? 'OR'}</span>
                <div className="set-org-meta">
                  <div className="set-org-name">{data.org.name}</div>
                  {data.org.sub && <div className="set-org-sub">{data.org.sub}</div>}
                </div>
              </div>
              <dl className="set-deflist">
                <div className="set-defrow">
                  <dt>Entity</dt>
                  <dd>{data.org.name}{data.org.sub ? ` · ${data.org.sub}` : ''}</dd>
                </div>
                <div className="set-defrow">
                  <dt>Authentication</dt>
                  <dd>
                    <span className="pill" style={{ background: 'var(--review-bg)', color: 'var(--review-ink)' }}>Demo mode</span>
                    <span className="set-defnote">Role switcher in the topbar instead of real auth.</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
