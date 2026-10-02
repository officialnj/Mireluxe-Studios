'use client';

import { useState } from 'react';
import type { DbDiscountCode, DiscountType } from '@/lib/shop/types';

type CodeDraft = {
  code: string;
  discount_type: DiscountType;
  value_input: string; // percent: whole number 1-100. fixed: pounds, e.g. "5.00".
  usage_limit: string; // '' = unlimited
  min_subtotal_pounds: string;
  expires_at: string; // yyyy-mm-dd, '' = never
  active: boolean;
};

const emptyDraft: CodeDraft = {
  code: '',
  discount_type: 'percent',
  value_input: '',
  usage_limit: '',
  min_subtotal_pounds: '',
  expires_at: '',
  active: true,
};

function toDraft(c: DbDiscountCode): CodeDraft {
  return {
    code: c.code,
    discount_type: c.discount_type,
    value_input: c.discount_type === 'fixed' ? (c.value / 100).toString() : c.value.toString(),
    usage_limit: c.usage_limit != null ? c.usage_limit.toString() : '',
    min_subtotal_pounds: c.min_subtotal_pence ? (c.min_subtotal_pence / 100).toString() : '',
    expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
    active: c.active,
  };
}

function draftToPayload(d: CodeDraft) {
  const value =
    d.discount_type === 'fixed'
      ? Math.round(parseFloat(d.value_input || '0') * 100)
      : Math.round(parseFloat(d.value_input || '0'));
  return {
    code: d.code.trim().toUpperCase(),
    discount_type: d.discount_type,
    value,
    usage_limit: d.usage_limit.trim() ? parseInt(d.usage_limit, 10) : null,
    min_subtotal_pence: d.min_subtotal_pounds.trim() ? Math.round(parseFloat(d.min_subtotal_pounds) * 100) : 0,
    expires_at: d.expires_at ? new Date(`${d.expires_at}T23:59:59.000Z`).toISOString() : null,
    active: d.active,
  };
}

export default function DiscountCodesManager({ initialCodes }: { initialCodes: DbDiscountCode[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [edits, setEdits] = useState<Record<string, CodeDraft>>(
    Object.fromEntries(initialCodes.map((c) => [c.id, toDraft(c)]))
  );
  const [newDraft, setNewDraft] = useState<CodeDraft>(emptyDraft);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  function update(id: string, patch: Partial<CodeDraft>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveCode(id: string) {
    const draft = edits[id];
    if (!draft) return;
    setBusy(`save-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/discount-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(draft)),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error === 'code_already_exists' ? 'That code already exists.' : 'Failed to save.');
      return;
    }
    const { discountCode } = await res.json();
    setCodes((prev) => prev.map((c) => (c.id === id ? discountCode : c)));
    setEdits((prev) => ({ ...prev, [id]: toDraft(discountCode) }));
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(`active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/discount-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], active } }));
  }

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newDraft.code.trim() || !newDraft.value_input.trim()) {
      setError('Code and value are required.');
      return;
    }
    setBusy('create');
    setError(null);
    const res = await fetch('/api/admin/discount-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(newDraft)),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error === 'code_already_exists' ? 'That code already exists.' : 'Failed to create code.');
      return;
    }
    const { discountCode } = await res.json();
    setCodes((prev) => [discountCode, ...prev]);
    setEdits((prev) => ({ ...prev, [discountCode.id]: toDraft(discountCode) }));
    setNewDraft(emptyDraft);
    setShowNewForm(false);
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button
        onClick={() => setShowNewForm((v) => !v)}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal"
      >
        {showNewForm ? 'Cancel' : '+ New discount code'}
      </button>

      {showNewForm && (
        <form onSubmit={createCode} className="grid gap-3 rounded-xl border border-cream/10 p-4 md:grid-cols-2">
          <CodeFields draft={newDraft} onChange={(patch) => setNewDraft((prev) => ({ ...prev, ...patch }))} />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy === 'create'}
              className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
            >
              {busy === 'create' ? 'Creating…' : 'Create code'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {codes.length === 0 ? (
          <p className="text-sm text-cream/50">No discount codes yet.</p>
        ) : (
          codes.map((c) => {
            const draft = edits[c.id];
            if (!draft) return null;
            return (
              <div key={c.id} className={`rounded-xl border p-4 ${c.active ? 'border-cream/10' : 'border-red-500/20 opacity-70'}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium tracking-wide">{c.code}</span>
                    <span className="text-xs text-cream/50">
                      Used {c.used_count}
                      {c.usage_limit != null ? ` / ${c.usage_limit}` : ' (unlimited)'}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={c.active}
                      disabled={busy === `active-${c.id}`}
                      onChange={(e) => toggleActive(c.id, e.target.checked)}
                    />
                    {c.active ? 'On' : 'Off'}
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <CodeFields draft={draft} onChange={(patch) => update(c.id, patch)} />
                </div>
                <button
                  onClick={() => saveCode(c.id)}
                  disabled={busy === `save-${c.id}`}
                  className="mt-3 inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                >
                  {busy === `save-${c.id}` ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm';

function CodeFields({ draft, onChange }: { draft: CodeDraft; onChange: (patch: Partial<CodeDraft>) => void }) {
  return (
    <>
      <Field label="Code">
        <input
          value={draft.code}
          onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
          className={`${inputClass} font-mono uppercase`}
        />
      </Field>
      <Field label="Type">
        <select
          value={draft.discount_type}
          onChange={(e) => onChange({ discount_type: e.target.value as DiscountType })}
          className={inputClass}
        >
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off</option>
        </select>
      </Field>
      <Field label={draft.discount_type === 'percent' ? 'Percent off (1-100)' : 'Amount off £'}>
        <input
          type="number"
          step={draft.discount_type === 'percent' ? 1 : 0.01}
          min={draft.discount_type === 'percent' ? 1 : 0.01}
          max={draft.discount_type === 'percent' ? 100 : undefined}
          value={draft.value_input}
          onChange={(e) => onChange({ value_input: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Usage limit (blank = unlimited)">
        <input
          type="number"
          min={1}
          value={draft.usage_limit}
          onChange={(e) => onChange({ usage_limit: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Minimum subtotal £ (optional)">
        <input
          type="number"
          step="0.01"
          min={0}
          value={draft.min_subtotal_pounds}
          onChange={(e) => onChange({ min_subtotal_pounds: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Expires (optional)">
        <input
          type="date"
          value={draft.expires_at}
          onChange={(e) => onChange({ expires_at: e.target.value })}
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-cream/50">{label}</label>
      {children}
    </div>
  );
}
