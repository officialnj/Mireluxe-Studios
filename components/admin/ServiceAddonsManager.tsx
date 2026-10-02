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

            <div className="space-y-2">
              {groupAddons.length === 0 && <p className="text-sm text-cream/50">No add-ons yet.</p>}
              {groupAddons.map((a, index) => {
                const d = drafts[a.id] ?? draftFromAddon(a);
                return (
                  <div key={a.id} className="rounded-lg border border-cream/10 bg-cream/[0.02] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => move(group.categoryId, groupAddons, index, -1)}
                          disabled={index === 0 || busy === 'reorder'}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                          aria-label="Move earlier"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(group.categoryId, groupAddons, index, 1)}
                          disabled={index === groupAddons.length - 1 || busy === 'reorder'}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                          aria-label="Move later"
                        >
                          ↓
                        </button>
                      </div>
                      <input
                        value={d.name}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, name: e.target.value } }))}
                        className="min-w-[160px] flex-1 rounded-lg border border-cream/20 bg-transparent px-2.5 py-1.5 text-sm"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-cream/60">
                        <input
                          type="checkbox"
                          checked={a.active}
                          disabled={busy === `active-${a.id}`}
                          onChange={(e) => toggleActive(a.id, e.target.checked)}
                        />
                        Active
                      </label>
                      <button
                        onClick={() => saveAddon(a.id)}
                        disabled={busy === `save-${a.id}`}
                        className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                      >
                        {busy === `save-${a.id}` ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-16 text-xs">
                      <label className="flex items-center gap-1.5 text-cream/50">
                        Price Δ (£)
                        <input
                          value={d.price_pounds}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, price_pounds: e.target.value } }))}
                          placeholder="0.00"
                          className="w-20 rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-sm text-cream"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-cream/50">
                        Duration Δ (min)
                        <input
                          value={d.duration_mins}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [a.id]: { ...d, duration_mins: e.target.value } }))}
                          placeholder="0"
                          className="w-16 rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-sm text-cream"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-cream/50">
                        <input
                          type="checkbox"
                          checked={d.unlocks_premium_slots}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [a.id]: { ...d, unlocks_premium_slots: e.target.checked } }))
                          }
                        />
                        Premium slots
                      </label>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-lg border border-dashed border-cream/15 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draft.name}
                    onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, name: e.target.value } }))}
                    placeholder="New add-on name"
                    className="min-w-[160px] flex-1 rounded-lg border border-cream/20 bg-transparent px-2.5 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => createAddon(group.categoryId)}
                    disabled={busy === `new-${newKey}`}
                    className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-charcoal disabled:opacity-50"
                  >
                    {busy === `new-${newKey}` ? 'Adding…' : 'Add'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <label className="flex items-center gap-1.5 text-cream/50">
                    Price Δ (£)
                    <input
                      value={draft.price_pounds}
                      onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, price_pounds: e.target.value } }))}
                      placeholder="0.00"
                      className="w-20 rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-sm text-cream"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-cream/50">
                    Duration Δ (min)
                    <input
                      value={draft.duration_mins}
                      onChange={(e) => setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, duration_mins: e.target.value } }))}
                      placeholder="0"
                      className="w-16 rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-sm text-cream"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-cream/50">
                    <input
                      type="checkbox"
                      checked={draft.unlocks_premium_slots}
                      onChange={(e) =>
                        setNewDrafts((prev) => ({ ...prev, [newKey]: { ...draft, unlocks_premium_slots: e.target.checked } }))
                      }
                    />
                    Premium slots
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
