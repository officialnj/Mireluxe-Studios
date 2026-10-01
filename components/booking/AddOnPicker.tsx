'use client';

import { formatPence } from '@/lib/booking/pricing';
import type { DbServiceAddon } from '@/lib/booking/types';

type Props = {
  addons: DbServiceAddon[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

function formatDelta(pence: number): string {
  if (pence === 0) return '';
  return pence > 0 ? `+${formatPence(pence)}` : `−${formatPence(Math.abs(pence))}`;
}

function formatDurationDelta(mins: number): string {
  if (mins === 0) return '';
  const sign = mins > 0 ? '+' : '−';
  const abs = Math.abs(mins);
  const hrs = abs / 60;
  const label = Number.isInteger(hrs) && abs >= 60 ? `${hrs}hr${hrs === 1 ? '' : 's'}` : `${abs}min`;
  return `${sign}${label}`;
}

export default function AddOnPicker({ addons, selectedIds, onChange }: Props) {
  if (addons.length === 0) {
    return <p className="text-sm text-charcoal/50 dark:text-cream/50">No extras available for this style.</p>;
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {addons.map((addon) => {
        const checked = selectedIds.includes(addon.id);
        const deltaParts = [formatDurationDelta(addon.duration_delta_mins), formatDelta(addon.price_delta_pence)].filter(Boolean);
        return (
          <label
            key={addon.id}
            className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
              checked ? 'border-gold bg-gold/10' : 'border-charcoal/15 hover:border-gold/40 dark:border-cream/15'
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(addon.id)}
                className="h-4 w-4 shrink-0 rounded border-charcoal/30 text-gold focus:ring-gold dark:border-cream/30"
              />
              <span>
                {addon.name}
                {addon.unlocks_premium_slots && (
                  <span className="ml-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-luxe text-gold">
                    Early/late
                  </span>
                )}
              </span>
            </span>
            {deltaParts.length > 0 && <span className="shrink-0 text-xs text-charcoal/50 dark:text-cream/50">{deltaParts.join(' / ')}</span>}
          </label>
        );
      })}
    </div>
  );
}
