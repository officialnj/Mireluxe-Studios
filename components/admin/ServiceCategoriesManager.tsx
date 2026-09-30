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
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal disabled:opacity-50"
        >
          Add category
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-cream/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream/10 text-xs uppercase tracking-wide text-cream/50">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm text-cream/50">
                  No service categories yet.
                </td>
              </tr>
            ) : (
              categories.map((c, index) => (
                <tr key={c.id} className="border-b border-cream/5 last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || busy === 'reorder'}
                        className="text-cream/50 hover:text-gold disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === categories.length - 1 || busy === 'reorder'}
                        className="text-cream/50 hover:text-gold disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={nameEdits[c.id] ?? ''}
                      onChange={(e) => setNameEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-full rounded border border-cream/20 bg-transparent px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-cream/50">{c.slug}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={c.active}
                      disabled={busy === `active-${c.id}`}
                      onChange={(e) => toggleActive(c.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => saveName(c.id)}
                      disabled={busy === `name-${c.id}`}
                      className="text-xs text-gold hover:underline"
                    >
                      {busy === `name-${c.id}` ? 'Saving…' : 'Save name'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
