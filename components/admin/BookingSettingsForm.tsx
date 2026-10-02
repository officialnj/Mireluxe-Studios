'use client';

import { useState } from 'react';

type BookingSettings = {
  buffer_minutes: number;
  advance_booking_days: number;
};

export default function BookingSettingsForm({ initialSettings }: { initialSettings: BookingSettings }) {
  const [bufferMinutes, setBufferMinutes] = useState(initialSettings.buffer_minutes.toString());
  const [advanceDays, setAdvanceDays] = useState(initialSettings.advance_booking_days.toString());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/admin/booking-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buffer_minutes: parseInt(bufferMinutes, 10) || 0,
        advance_booking_days: parseInt(advanceDays, 10) || 1,
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
        <label className="mb-1 block text-xs text-cream/50" htmlFor="buffer-minutes">
          Buffer time after each appointment (minutes)
        </label>
        <input
          id="buffer-minutes"
          type="number"
          min={0}
          max={240}
          value={bufferMinutes}
          onChange={(e) => setBufferMinutes(e.target.value)}
          className="w-28 rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-cream/50" htmlFor="advance-days">
          How far ahead clients can book (days)
        </label>
        <input
          id="advance-days"
          type="number"
          min={1}
          max={365}
          value={advanceDays}
          onChange={(e) => setAdvanceDays(e.target.value)}
          className="w-28 rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </div>
  );
}
