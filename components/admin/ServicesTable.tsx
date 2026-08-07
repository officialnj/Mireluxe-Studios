'use client';

import { useState } from 'react';
import type { DbService } from '@/lib/booking/types';

type ServiceRow = DbService & { service_categories: { name: string } | null };

type EditableState = {
  base_price_pounds: string;
  hair_incl_price_pounds: string;
  service_time_mins: string;
  deposit_pounds: string;
  active: boolean;
};

function toEditable(s: ServiceRow): EditableState {
  return {
    base_price_pounds: (s.base_price_pence / 100).toString(),
    hair_incl_price_pounds: s.hair_incl_price_pence != null ? (s.hair_incl_price_pence / 100).toString() : '',
    service_time_mins: s.service_time_mins != null ? s.service_time_mins.toString() : '',
    deposit_pounds: (s.deposit_pence / 100).toString(),
    active: s.active,
  };
}

export default function ServicesTable({ initialServices }: { initialServices: ServiceRow[] }) {
  const [edits, setEdits] = useState<Record<string, EditableState>>(
    Object.fromEntries(initialServices.map((s) => [s.id, toEditable(s)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<EditableState>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(id: string) {
    const state = edits[id];
    if (!state) return;
    setSavingId(id);
    setError(null);

    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_price_pence: Math.round(parseFloat(state.base_price_pounds || '0') * 100),
        hair_incl_price_pence: state.hair_incl_price_pounds ? Math.round(parseFloat(state.hair_incl_price_pounds) * 100) : null,
        service_time_mins: state.service_time_mins ? parseInt(state.service_time_mins, 10) : null,
        deposit_pence: Math.round(parseFloat(state.deposit_pounds || '0') * 100),
        active: state.active,
      }),
    });

    setSavingId(null);
    if (!res.ok) {
      setError('Failed to save.');
      return;
    }
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1500);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-cream/10">
      {error && <p className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-cream/10 text-xs uppercase tracking-wide text-cream/50">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Base £</th>
            <th className="px-4 py-3">Hair-incl £</th>
            <th className="px-4 py-3">Time (mins)</th>
            <th className="px-4 py-3">Deposit £</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {initialServices.map((s) => {
            const state = edits[s.id];
            if (!state) return null;
            return (
              <tr key={s.id} className="border-b border-cream/5 last:border-0">
                <td className="px-4 py-2">
                  <div>{s.name}</div>
                  <div className="text-xs text-cream/50">{s.service_categories?.name ?? '—'}</div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={state.base_price_pounds}
                    onChange={(e) => update(s.id, { base_price_pounds: e.target.value })}
                    className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="—"
                    value={state.hair_incl_price_pounds}
                    onChange={(e) => update(s.id, { hair_incl_price_pounds: e.target.value })}
                    className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    placeholder="—"
                    value={state.service_time_mins}
                    onChange={(e) => update(s.id, { service_time_mins: e.target.value })}
                    className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={state.deposit_pounds}
                    onChange={(e) => update(s.id, { deposit_pounds: e.target.value })}
                    className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={state.active}
                    onChange={(e) => update(s.id, { active: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleSave(s.id)}
                    disabled={savingId === s.id}
                    className="text-xs text-gold hover:underline"
                  >
                    {savingId === s.id ? 'Saving…' : savedId === s.id ? 'Saved ✓' : 'Save'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
