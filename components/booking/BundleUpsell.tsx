'use client';

import { useState } from 'react';
import type { DbBundleVariant } from '@/lib/booking/types';
import { formatPence } from '@/lib/booking/pricing';

export type BundleLine = { variantId: string; inches: number; colour: string; quantity: number };

type Props = {
  variants: DbBundleVariant[];
  lines: BundleLine[];
  onChange: (lines: BundleLine[]) => void;
};

const INCH_OPTIONS = [14, 16, 18, 20, 22, 24, 28];
const COLOUR_OPTIONS = ['1B', '2', '4'];

const selectClass =
  'w-full rounded-lg border border-charcoal/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-cream/20 dark:[color-scheme:dark]';
const fieldLabel = 'mb-1 block text-[0.65rem] uppercase tracking-luxe text-charcoal/50 dark:text-cream/50';

export default function BundleUpsell({ variants, lines, onChange }: Props) {
  const [inches, setInches] = useState(18);
  const [colour, setColour] = useState('1B');
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = variants.find((v) => v.inches === inches && v.colour === colour);

  function handleAdd() {
    if (!selectedVariant) return;
    const existing = lines.find((l) => l.variantId === selectedVariant.id);
    if (existing) {
      onChange(lines.map((l) => (l.variantId === selectedVariant.id ? { ...l, quantity: l.quantity + quantity } : l)));
    } else {
      onChange([...lines, { variantId: selectedVariant.id, inches, colour, quantity }]);
    }
    setQuantity(1);
  }

  function handleRemove(variantId: string) {
    onChange(lines.filter((l) => l.variantId !== variantId));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={fieldLabel} htmlFor="bundle-inches">
            Inches
          </label>
          <select
            id="bundle-inches"
            value={inches}
            onChange={(e) => setInches(Number(e.target.value))}
            className={selectClass}
          >
            {INCH_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {i}&quot;
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="bundle-colour">
            Colour
          </label>
          <select id="bundle-colour" value={colour} onChange={(e) => setColour(e.target.value)} className={selectClass}>
            {COLOUR_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="bundle-qty">
            Qty
          </label>
          <input
            id="bundle-qty"
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className={selectClass}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedVariant}
        className="w-full rounded-xl border border-gold/50 px-4 py-2.5 text-sm text-gold transition-colors duration-300 hover:bg-gold/10 disabled:opacity-40"
      >
        {selectedVariant ? `Add — ${formatPence(selectedVariant.price_pence)} each` : 'Unavailable'}
      </button>

      {lines.length > 0 && (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.variantId}
              className="flex items-center justify-between rounded-lg border border-charcoal/12 px-4 py-2.5 text-sm dark:border-cream/12"
            >
              <span>
                {line.quantity}× {line.inches}&quot; bundle ({line.colour})
              </span>
              <button
                type="button"
                onClick={() => handleRemove(line.variantId)}
                className="text-xs text-charcoal/50 hover:text-red-500 dark:text-cream/50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
