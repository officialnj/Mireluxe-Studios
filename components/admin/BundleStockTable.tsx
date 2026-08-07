'use client';

import { useState } from 'react';
import type { DbBundleVariant } from '@/lib/booking/types';
import { formatPence } from '@/lib/booking/pricing';

export default function BundleStockTable({ initialVariants }: { initialVariants: DbBundleVariant[] }) {
  const [variants, setVariants] = useState(initialVariants);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleStock(id: string, inStock: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/admin/bundle-variants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_stock: inStock }),
    });
    setBusyId(null);
    if (res.ok) {
      setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, in_stock: inStock } : v)));
    }
  }

  const byInches = new Map<number, DbBundleVariant[]>();
  for (const v of variants) {
    byInches.set(v.inches, [...(byInches.get(v.inches) ?? []), v]);
  }

  return (
    <div className="space-y-6">
      {[...byInches.entries()].map(([inches, group]) => (
        <div key={inches} className="rounded-xl border border-cream/10 p-4">
          <h2 className="mb-3 text-sm font-medium">{inches}&quot;</h2>
          <div className="flex flex-wrap gap-3">
            {group.map((v) => (
              <label
                key={v.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  v.in_stock ? 'border-cream/20' : 'border-red-500/30 text-red-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={v.in_stock}
                  disabled={busyId === v.id}
                  onChange={(e) => toggleStock(v.id, e.target.checked)}
                />
                {v.colour} — {formatPence(v.price_pence)}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
