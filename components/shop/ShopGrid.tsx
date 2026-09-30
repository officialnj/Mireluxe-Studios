'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DbBundle, DbBundleVariant } from '@/lib/booking/types';
import type { DbBundleMedia } from '@/lib/shop/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import Reveal from '@/components/Reveal';
import BundleCard from '@/components/shop/BundleCard';

const SORTS = ['Featured', 'Price: Low to High', 'Price: High to Low', 'Name'] as const;

type Props = {
  bundles: DbBundle[];
  variants: DbBundleVariant[];
};

/** Representative price for sorting — the cheapest purchasable variant if
 *  any exist, otherwise just the cheapest variant overall (out-of-stock
 *  bundles still need to sort somewhere sensible). */
function representativePrice(variants: DbBundleVariant[]): number {
  const purchasable = variants.filter((v) => v.in_stock && v.stock_quantity > 0);
  const pool = purchasable.length > 0 ? purchasable : variants;
  return Math.min(...pool.map((v) => v.price_pence));
}

export default function ShopGrid({ bundles, variants }: Props) {
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Featured');

  // One shared fetch of bundle_media for every variant on the page, rather
  // than each BundleCard querying independently — bundle_media's RLS allows
  // public (anon) reads, so this can go straight to Supabase from the
  // browser instead of round-tripping through a Route Handler.
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

  const sorted = useMemo(() => {
    const list = [...groups];
    if (sort === 'Price: Low to High') {
      list.sort((a, b) => representativePrice(a.variants) - representativePrice(b.variants));
    } else if (sort === 'Price: High to Low') {
      list.sort((a, b) => representativePrice(b.variants) - representativePrice(a.variants));
    } else if (sort === 'Name') {
      list.sort((a, b) => a.bundle.name.localeCompare(b.bundle.name));
    }
    return list;
  }, [groups, sort]);

  if (sorted.length === 0) {
    return (
      <section className="container-luxe pb-24 text-center text-sm text-charcoal/60 dark:text-cream/60 lg:pb-32">
        No products available right now — check back soon.
      </section>
    );
  }

  return (
    <section className="container-luxe pb-24 lg:pb-32">
      <div className="flex flex-col gap-6 border-y border-charcoal/10 py-6 dark:border-cream/10 md:flex-row md:items-center md:justify-end">
        <div className="flex items-center gap-3">
          <label className="text-[0.7rem] uppercase tracking-luxe text-charcoal/50 dark:text-cream/50">
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
            className="rounded-full border border-charcoal/20 bg-transparent px-4 py-2 text-sm outline-none transition-colors focus:border-gold dark:border-cream/20 dark:bg-charcoal"
          >
            {SORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((group, i) => (
          <Reveal key={group.bundle.id} delay={(i % 4) * 0.08}>
            <BundleCard bundleName={group.bundle.name} variants={group.variants} mediaByVariant={mediaByVariant} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
