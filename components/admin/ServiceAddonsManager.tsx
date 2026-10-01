'use client';

import { useState } from 'react';
import type { DbServiceAddon, DbServiceCategory } from '@/lib/booking/types';

/**
 * Full CRUD over service_addons, grouped by category (plus a trailing
 * virtual "Hair Included Styles" bucket for category_id = null rows — see
 * supabase/migrations/0019_booking_v2_categories_addons.sql). Price/duration
 * deltas can be negative (e.g. "Short Bob" shortens both). Same
 * edit-in-place + busy-key + reorder pattern as ServiceCategoriesManager /
 * ServicesTable. Deletion lock — no hard delete, only active=false.
 */

const HAIR_INCLUDED_LABEL = 'Hair Included Styles';
const HAIR_INCLUDED_KEY = 'hair-included';

type AddonDraft = {
  name: string;
  price_pounds: string;
  duration_mins: string;
  unlocks_premium_slots: boolean;
};

function draftFromAddon(a: DbServiceAddon): AddonDraft {
  return {
    name: a.name,
    price_pounds: (a.price_delta_pence / 100).toString(),
    duration_mins: a.duration_delta_mins.toString(),
    unlocks_premium_slots: a.unlocks_premium_slots,
  };
}

const EMPTY_DRAFT: AddonDraft = { name: '', price_pounds: '', duration_mins: '', unlocks_premium_slots: false };

function parsePounds(v: string): number {
  const n = Math.round(parseFloat(v || '0') * 100);
  return Number.isFinite(n) ? n : 0;
}

function parseMins(v: string): number {
  const n = parseInt(v || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export default function ServiceAddonsManager({
  initialCategories,
  initialAddons,
}: {
  initialCategories: DbServiceCategory[];
  initialAddons: DbServiceAddon[];
}) {
  const [addons, setAddons] = useState(initialAddons);
  const [drafts, setDrafts] = useState<Record<string, AddonDraft>>(
    Object.fromEntries(initialAddons.map((a) => [a.id, draftFromAddon(a)]))
  );
  const [newDrafts, setNewDrafts] = useState<Record<string, AddonDraft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups: { key: string; categoryId: string | null; label: string }[] = [
    ...initialCategories.map((c) => ({ key: c.id, categoryId: c.id, label: c.name })),
    { key: HAIR_INCLUDED_KEY, categoryId: null, label: HAIR_INCLUDED_LABEL },
  ];

  function addonsForGroup(categoryId: string | null): DbServiceAddon[] {
    return addons.filter((a) => a.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
  }

  async function createAddon(categoryId: string | null) {
    const key = categoryId ?? HAIR_INCLUDED_KEY;
    const draft = newDrafts[key] ?? EMPTY_DRAFT;
    if (!draft.name.trim()) return;
    setBusy(`new-${key}`);
    setError(null);
    const res = await fetch('/api/admin/addons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: categoryId,
        name: draft.name.trim(),
        price_delta_pence: parsePounds(draft.price_pounds),
        duration_delta_mins: parseMins(draft.duration_mins),
        unlocks_premium_slots: draft.unlocks_premium_slots,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to create add-on.');
      return;
    }
    const { addon } = await res.json();
    setAddons((prev) => [...prev, addon]);
    setDrafts((prev) => ({ ...prev, [addon.id]: draftFromAddon(addon) }));
    setNewDrafts((prev) => ({ ...prev, [key]: EMPTY_DRAFT }));
  }

  async function saveAddon(id: string) {
    const draft = drafts[id];
    if (!draft || !draft.name.trim()) return;
    setBusy(`save-${id}`);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      price_delta_pence: parsePounds(draft.price_pounds),
      duration_delta_mins: parseMins(draft.duration_mins),
      unlocks_premium_slots: draft.unlocks_premium_slots,
    };
    const res = await fetch(`/api/admin/addons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save.');
      return;
    }
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...payload } : a)));
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(`active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/addons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)));
  }

  async function persistOrder(categoryId: string | null, ordered: DbServiceAddon[]) {
    setBusy('reorder');
    setError(null);
    const res = await fetch('/api/admin/addons/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, orderedIds: ordered.map((a) => a.id) }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to reorder.');
      return;
    }
    const reorderedIds = new Set(ordered.map((a) => a.id));
    setAddons((prev) => [...prev.filter((a) => !reorderedIds.has(a.id)), ...ordered.map((a, i) => ({ ...a, sort_order: i }))]);
  }

  function move(categoryId: string | null, groupAddons: DbServiceAddon[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= groupAddons.length) return;
    const reordered = [...groupAddons];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(categoryId, reordered);
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {groups.map((group) => {
        const groupAddons = addonsForGroup(group.categoryId);
        const newKey = group.categoryId ?? HAIR_INCLUDED_KEY;
        const draft = newDrafts[newKey] ?? EMPTY_DRAFT;

        return (
          <div key={group.key} className="rounded-xl border border-cream/10 p-4">
            <h2 className="mb-3 font-serif text-lg font-light">{group.label}</h2>

            <div className="overflow-x-auto rounded-lg border border-cream/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream/10 text-xs uppercase tracking-wide text-cream/50">
                  <tr>
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Price Δ (£)</th>
                    <th className="px-3 py-2">Duration Δ (min)</th>
                    <th className="px-3 py-2">Premium</th>
                    <th className="px-3 py-2">Active</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupAddons.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-sm text-cream/50">
                        No add-ons yet.
                      </td>
                    </tr>
                  )}
                  {groupAddons.map((a, index) => {
                    const d = drafts[a.id] ?? draftFromAddon(a);
                    return (
                      <tr key={a.id} className="border-b border-cream/5 last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => move(group.categoryId, groupAddons, index, -1)}
                              disabled={index === 0 || busy === 'reorder'}
                              className="text-cream/50 hover:text-gold disabled:opacity-30"
                              aria-label="Move earlier"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => move(group.categoryId, groupAddons, index, 1)}
                              disabled={index === groupAddons.length - 1 || busy === 'reorder'}
                              className="text-cream/50 hover:text-gold disabled:opacity-30"
                              aria-label="Move later"
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.name}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, name: e.target.value } }))}
                            className="w-full min-w-[220px] rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.price_pounds}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, price_pounds: e.target.value } }))}
                            placeholder="0.00"
                            className="w-24 rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.duration_mins}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, duration_mins: e.target.value } }))}
                            placeholder="0"
                            className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={d.unlocks_premium_slots}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [a.id]: { ...d, unlocks_premium_slots: e.target.checked } }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={a.active}
                            disabled={busy === `active-${a.id}`}
                            onChange={(e) => toggleActive(a.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => saveAddon(a.id)}
                            disabled={busy === `save-${a.id}`}
                            className="text-xs text-gold hover:underline"
                          >
                            {busy === `save-${a.id}` ? 'Saving…' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">
                      <input
                        value={draft.name}
                        onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, name: e.target.value } }))}
                        placeholder="New add-on name"
                        className="w-full min-w-[220px] rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={draft.price_pounds}
                        onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, price_pounds: e.target.value } }))}
                        placeholder="0.00"
                        className="w-24 rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={draft.duration_mins}
                        onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, duration_mins: e.target.value } }))}
                        placeholder="0"
                        className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={draft.unlocks_premium_slots}
                        onChange={(e) =>
                          setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, unlocks_premium_slots: e.target.checked } }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => createAddon(group.categoryId)}
                        disabled={busy === `new-${newKey}`}
                        className="rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-charcoal disabled:opacity-50"
                      >
                        {busy === `new-${newKey}` ? 'Adding…' : 'Add'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
