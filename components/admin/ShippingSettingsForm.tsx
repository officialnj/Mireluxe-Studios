'use client';

import { useState } from 'react';
import type { DbShippingSettings } from '@/lib/shop/types';

function penceToPoundsString(pence: number): string {
  return (pence / 100).toFixed(2);
}

function poundsStringToPence(pounds: string): number {
  const parsed = Math.round(parseFloat(pounds || '0') * 100);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function ShippingSettingsForm({ initialSettings }: { initialSettings: DbShippingSettings }) {
  const [flatRate, setFlatRate] = useState(penceToPoundsString(initialSettings.flat_rate_pence));
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(
    initialSettings.free_shipping_threshold_pence != null
  );
  const [threshold, setThreshold] = useState(
    initialSettings.free_shipping_threshold_pence != null
      ? penceToPoundsString(initialSettings.free_shipping_threshold_pence)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/admin/shipping-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flat_rate_pence: poundsStringToPence(flatRate),
        free_shipping_threshold_pence: freeShippingEnabled ? poundsStringToPence(threshold) : null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError('Failed to save.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-sm space-y-4">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-cream/50" htmlFor="flat-rate">
          Flat shipping rate (£)
        </label>
        <input
          id="flat-rate"
          type="number"
          min={0}
          step="0.01"
          value={flatRate}
          onChange={(e) => setFlatRate(e.target.value)}
          className="w-28 rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs text-cream/50">
          <input
            type="checkbox"
            checked={freeShippingEnabled}
            onChange={(e) => setFreeShippingEnabled(e.target.checked)}
          />
          Offer free shipping above a spend threshold
        </label>
        <p className="mt-1 text-[11px] text-cream/30">Leave unchecked for no free-shipping offer.</p>
        {freeShippingEnabled && (
          <div className="mt-2">
            <label className="mb-1 block text-xs text-cream/50" htmlFor="free-shipping-threshold">
              Free shipping threshold (£)
            </label>
            <input
              id="free-shipping-threshold"
              type="number"
              min={0}
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-28 rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save shipping settings'}
      </button>
    </div>
  );
}
