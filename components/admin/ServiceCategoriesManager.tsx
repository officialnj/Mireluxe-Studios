'use client';

import { useState } from 'react';
import type { DbServiceCategory } from '@/lib/booking/types';

/**
 * Full CRUD over service_categories: create, rename, reorder (up/down arrows
 * persisted immediately, same pattern as TrendingDealsManager's reorder) and
 * toggle active. Deletion lock — no hard delete, only active=false.
 */
export default function ServiceCategoriesManager({ initialCategories }: { initialCategories: DbServiceCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>(
    Object.fromEntries(initialCategories.map((c) => [c.id, c.name]))
  );
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy('new');
    setError(null);
    const res = await fetch('/api/admin/service-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to create category.');
      return;
    }
    const { category } = await res.json();
    setCategories((prev) => [...prev, category]);
    setNameEdits((prev) => ({ ...prev, [category.id]: category.name }));
    setNewName('');
  }

  async function saveName(id: string) {
    const name = nameEdits[id]?.trim();
    if (!name) return;
    setBusy(`name-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/service-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save name.');
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(`active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/service-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  }

  async function persistOrder(ordered: DbServiceCategory[]) {
    setBusy('reorder');
    setError(null);
    const res = await fetch('/api/admin/service-categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: ordered.map((c) => c.id) }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to reorder.');
      return;
    }
    setCategories(ordered.map((c, i) => ({ ...c, sort_order: i })));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(reordered);
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={createCategory} className="flex items-end gap-3 rounded-xl border border-cream/10 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-cream/50" htmlFor="new-category-name">
            New category name
          </label>
          <input
            id="new-category-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Cornrows"
            className="w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === 'new'}
          className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-cream/50">No service categories yet.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c, index) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-cream/10 bg-cream/[0.02] px-4 py-3"
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy === 'reorder'}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === categories.length - 1 || busy === 'reorder'}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <input
                value={nameEdits[c.id] ?? ''}
                onChange={(e) => setNameEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                className="min-w-[10rem] flex-1 rounded-lg border border-cream/20 bg-transparent px-2.5 py-1.5 text-sm"
              />
              <span className="text-xs text-cream/50">{c.slug}</span>
              <label className="flex items-center gap-1.5 text-xs text-cream/60">
                <input
                  type="checkbox"
                  checked={c.active}
                  disabled={busy === `active-${c.id}`}
                  onChange={(e) => toggleActive(c.id, e.target.checked)}
                />
                Active
              </label>
              <button
                onClick={() => saveName(c.id)}
                disabled={busy === `name-${c.id}`}
                className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
              >
                {busy === `name-${c.id}` ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
