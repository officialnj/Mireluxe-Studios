'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DbBundle, DbBundleVariant } from '@/lib/booking/types';
import type { DbBundleMedia } from '@/lib/shop/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
// The client-side booking line shape — NOT lib/booking/pricing.ts's
// same-named BundleLine ({variant, quantity}), which is a different,
// server/pricing-side type. This one is {variantId, inches, colour,
// quantity} and is what BookingForm.tsx's onChange contract expects.
import { type BundleLine } from '@/components/booking/BundleUpsell';
import BookingBundleCard from '@/components/booking/BookingBundleCard';

type Props = {
  bundles: DbBundle[];
  variants: DbBundleVariant[];
  lines: BundleLine[];
  onChange: (lines: BundleLine[]) => void;
};

export default function BundleCatalog({ bundles, variants, lines, onChange }: Props) {
  // One shared fetch of bundle_media for every variant on this step, rather
  // than each card querying independently — same pattern as ShopGrid.tsx.
  const variantIdsKey = useMemo(() => variants.map((v) => v.id).sort().join(','), [variants]);
  const [mediaByVariant, setMediaByVariant] = useState<Record<string, DbBundleMedia[]>>({});

  useEffect(() => {
    const variantIds = variantIdsKey ? variantIdsKey.split(',') : [];
    if (variantIds.length === 0) {
      setMediaByVariant({});
      return;
    }
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    supabase
      .from('bundle_media')
      .select('*')
      .in('bundle_variant_id', variantIds)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const grouped: Record<string, DbBundleMedia[]> = {};
        for (const row of data as DbBundleMedia[]) {
          (grouped[row.bundle_variant_id] ??= []).push(row);
        }
        setMediaByVariant(grouped);
      });
    return () => {
      cancelled = true;
    };
  }, [variantIdsKey]);

  const groups = useMemo(
    () =>
      bundles
        .filter((b) => b.active)
        .map((bundle) => ({
          bundle,
          variants: variants.filter((v) => v.bundle_id === bundle.id),
        }))
        .filter((g) => g.variants.length > 0),
    [bundles, variants]
  );

  function handleAddVariant(variant: DbBundleVariant) {
    const existing = lines.find((l) => l.variantId === variant.id);
    if (existing) {
      onChange(lines.map((l) => (l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      onChange([...lines, { variantId: variant.id, inches: variant.inches, colour: variant.colour, quantity: 1 }]);
    }
  }

  function handleRemove(variantId: string) {
    onChange(lines.filter((l) => l.variantId !== variantId));
  }

  // For the "already added" list: resolve which bundle product a line
  // belongs to, purely for display disambiguation (two products can share
  // the same inches/colour, which is exactly the scenario this catalog
  // exists to support). Falls back to just inches/colour if the variant
  // can no longer be found at all.
  function lineBundleName(line: BundleLine): string | null {
    const variant = variants.find((v) => v.id === line.variantId);
    if (!variant) return null;
    return bundles.find((b) => b.id === variant.bundle_id)?.name ?? null;
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-charcoal/60 dark:text-cream/60">
        No bundles available right now — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {groups.map((g) => (
          <BookingBundleCard
            key={g.bundle.id}
            bundleName={g.bundle.name}
            variants={g.variants}
            mediaByVariant={mediaByVariant}
            onAdd={handleAddVariant}
          />
        ))}
      </div>

      {lines.length > 0 && (
        <ul className="space-y-2">
          {lines.map((line) => {
            const name = lineBundleName(line);
            return (
              <li
                key={line.variantId}
                className="flex items-center justify-between rounded-lg border border-charcoal/12 px-4 py-2.5 text-sm dark:border-cream/12"
              >
                <span>
                  {line.quantity}× {name ? `${name} — ` : ''}
                  {line.inches}&quot; bundle ({line.colour})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(line.variantId)}
                  className="text-xs text-charcoal/50 hover:text-red-500 dark:text-cream/50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
