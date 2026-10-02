'use client';

import { useState } from 'react';

type StudioHoursRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toEditable(rows: StudioHoursRow[]): StudioHoursRow[] {
  return Array.from({ length: 7 }, (_, day_of_week) => {
    const existing = rows.find((r) => r.day_of_week === day_of_week);
    return (
      existing ?? {
        day_of_week,
        open_time: '09:00',
        close_time: '18:00',
        is_closed: day_of_week === 0,
      }
    );
  }).map((r) => ({
    ...r,
    open_time: r.open_time?.slice(0, 5) ?? '09:00',
    close_time: r.close_time?.slice(0, 5) ?? '18:00',
  }));
}

export default function StudioHoursTable({ initialHours }: { initialHours: StudioHoursRow[] }) {
  const [rows, setRows] = useState<StudioHoursRow[]>(() => toEditable(initialHours));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(day_of_week: number, patch: Partial<StudioHoursRow>) {
    setRows((prev) => prev.map((r) => (r.day_of_week === day_of_week ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/admin/studio-hours', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });

    setSaving(false);
    if (!res.ok) {
      setError('Failed to save working hours.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="max-w-xl space-y-4">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.day_of_week}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-cream/10 bg-cream/[0.02] px-3 py-2"
          >
            <span className="w-24 text-sm">{DAY_LABELS[r.day_of_week]}</span>
            <input
              type="time"
              disabled={r.is_closed}
              value={r.open_time ?? ''}
              onChange={(e) => update(r.day_of_week, { open_time: e.target.value })}
              className="rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-xs disabled:opacity-40"
            />
            <span className="text-xs text-cream/40">to</span>
            <input
              type="time"
              disabled={r.is_closed}
              value={r.close_time ?? ''}
              onChange={(e) => update(r.day_of_week, { close_time: e.target.value })}
              className="rounded-lg border border-cream/20 bg-transparent px-2 py-1 text-xs disabled:opacity-40"
            />
            <label className="flex items-center gap-1.5 text-xs text-cream/60">
              <input
                type="checkbox"
                checked={r.is_closed}
                onChange={(e) => update(r.day_of_week, { is_closed: e.target.checked })}
              />
              Closed
            </label>
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save working hours'}
      </button>
    </div>
  );
}
