'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DbBundleVariant } from '@/lib/booking/types';
import type { DbBundleMedia } from '@/lib/shop/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { formatPence, isPurchasable } from '@/lib/booking/pricing';
import { useCart } from '@/components/CartProvider';
import { Tag } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const BUCKET = 'product-media';

type Props = {
  bundleName: string;
  variants: DbBundleVariant[];
  /** bundle_variant_id -> its media rows, sorted by sort_order. Fetched once
   *  for the whole grid by ShopGrid (bundle_media's RLS allows public reads)
   *  rather than each card querying independently. Optional so this
   *  component still works if ever rendered without it (falls straight back
   *  to variant.image_url). */
  mediaByVariant?: Record<string, DbBundleMedia[]>;
};

const selectClass =
  'w-full rounded-lg border border-charcoal/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-gold dark:border-cream/20 dark:[color-scheme:dark]';
const fieldLabel = 'mb-1 block text-[0.65rem] uppercase tracking-luxe text-charcoal/50 dark:text-cream/50';

export default function BundleCard({ bundleName, variants, mediaByVariant }: Props) {
  const cart = useCart();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const inchOptions = useMemo(
    () => Array.from(new Set(variants.map((v) => v.inches))).sort((a, b) => a - b),
    [variants]
  );
  const [inches, setInches] = useState(inchOptions[0]);

  const colourOptions = useMemo(
    () => Array.from(new Set(variants.filter((v) => v.inches === inches).map((v) => v.colour))),
    [variants, inches]
  );
  const [colour, setColour] = useState(colourOptions[0]);
  // If the previously-picked colour doesn't exist at the newly-selected
  // length, fall back to the first colour available at that length instead
  // of silently matching nothing.
  const effectiveColour = colourOptions.includes(colour) ? colour : colourOptions[0];

  const selectedVariant = variants.find((v) => v.inches === inches && v.colour === effectiveColour);
  const purchasable = selectedVariant ? isPurchasable(selectedVariant) : false;

  // Media gallery: prefer the selected variant's own bundle_media (so
  // switching colour/length can show that variant's own clip/photo, just
  // like price and stock already do), falling back to any variant's media,
  // then to the legacy single image_url field, then to nothing — the
  // pre-existing "no image block at all" behaviour is preserved so this
  // never breaks a bundle that hasn't been given new media yet.
  const fallbackVariantWithMedia = useMemo(
    () => variants.find((v) => (mediaByVariant?.[v.id]?.length ?? 0) > 0),
    [variants, mediaByVariant]
  );
  const activeMediaVariantId = selectedVariant && (mediaByVariant?.[selectedVariant.id]?.length ?? 0) > 0
    ? selectedVariant.id
    : fallbackVariantWithMedia?.id;
  const media = activeMediaVariantId ? mediaByVariant?.[activeMediaVariantId] ?? [] : [];
  const coverMedia: DbBundleMedia | null = media[0] ?? null;
  const legacyImage = variants.find((v) => v.image_url)?.image_url ?? null;

  function publicUrl(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const isVideoCover = coverMedia?.media_type === 'video';
  const videoUrl = isVideoCover ? publicUrl(coverMedia!.storage_path) : null;
  const coverImageUrl = coverMedia
    ? publicUrl(isVideoCover ? coverMedia.poster_storage_path ?? coverMedia.storage_path : coverMedia.storage_path)
    : legacyImage;
  const usesStorageImage = Boolean(coverMedia); // plain <img> for Storage-hosted media — see note below

  // Desktop hover-to-play vs mobile tap-to-play. Deliberately checks real
  // hover+fine-pointer capability rather than viewport width, since some
  // laptops/tablets have touchscreens too.
  const [hoverCapable, setHoverCapable] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    setHoverCapable(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);

  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset the play state whenever the cover media changes (e.g. the shopper
  // switches colour) so a hidden video never keeps running in the background.
  useEffect(() => {
    setPlaying(false);
  }, [coverMedia?.id]);

  useEffect(() => {
    if (!playing || !videoRef.current) return;
    const el = videoRef.current;
    el.currentTime = 0;
    el.play().catch(() => {
      // Autoplay can still be blocked in some browsers even when muted —
      // fail silently and leave the poster showing.
      setPlaying(false);
    });
  }, [playing]);

  function handleMediaMouseEnter() {
    if (!hoverCapable || !isVideoCover) return;
    setPlaying(true);
  }
  function handleMediaMouseLeave() {
    if (!hoverCapable || !isVideoCover) return;
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }
  function handleMediaTap(e: React.MouseEvent) {
    if (hoverCapable || !isVideoCover) return; // hover devices use mouseenter/leave instead
    e.preventDefault();
    e.stopPropagation();
    setPlaying((p) => !p);
  }

  const description =
    selectedVariant?.description ?? variants.find((v) => v.description)?.description ?? null;

  function handleAdd() {
    if (!selectedVariant || !purchasable) return;
    cart.addProductLine({
      slug: selectedVariant.id,
      name: `${bundleName} — ${selectedVariant.inches}" ${selectedVariant.colour}`,
      pricePence: selectedVariant.price_pence,
      spec: `${selectedVariant.inches}" · ${selectedVariant.colour}`,
      category: bundleName,
    });
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-cream-soft/60 transition-all duration-500 ease-luxe hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_24px_60px_-30px_rgba(26,26,26,0.5)] dark:border-cream/10 dark:bg-charcoal-soft/60">
      {coverImageUrl && (
        <div
          className="relative aspect-square w-full overflow-hidden"
          onMouseEnter={handleMediaMouseEnter}
          onMouseLeave={handleMediaMouseLeave}
          onClick={handleMediaTap}
        >
          {isVideoCover && playing && videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : usesStorageImage ? (
            // Plain <img>, not next/image — this is a Supabase Storage URL
            // and next.config.mjs has no remotePatterns entry for that host
            // (that file is outside this change's scope).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt={bundleName}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-luxe group-hover:scale-105"
            />
          ) : (
            <Image
              src={coverImageUrl}
              alt={bundleName}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
              className="object-cover transition-transform duration-[900ms] ease-luxe group-hover:scale-105"
            />
          )}
          {isVideoCover && !hoverCapable && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-charcoal/70 px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.15em] text-cream backdrop-blur-sm">
              {playing ? 'Tap to pause' : 'Tap to play'}
            </span>
          )}
          {!purchasable && (
            <span className="absolute left-3 top-3 rounded-full bg-charcoal/70 px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.15em] text-cream backdrop-blur-sm">
              Unavailable
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <Tag>Braiding Hair</Tag>
        <h3 className="mt-3 font-serif text-lg font-light tracking-tight">{bundleName}</h3>
        {description && <p className="mt-1 text-xs text-charcoal/55 dark:text-cream/55">{description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel} htmlFor={`inches-${bundleName}`}>
              Inches
            </label>
            <select
              id={`inches-${bundleName}`}
              value={inches}
              onChange={(e) => setInches(Number(e.target.value))}
              className={selectClass}
            >
              {inchOptions.map((i) => (
                <option key={i} value={i}>
                  {i}&quot;
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor={`colour-${bundleName}`}>
              Colour
            </label>
            <select
              id={`colour-${bundleName}`}
              value={effectiveColour}
              onChange={(e) => setColour(e.target.value)}
              className={selectClass}
            >
              {colourOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 font-serif text-2xl font-light text-gold">
          {purchasable && selectedVariant ? formatPence(selectedVariant.price_pence) : 'Currently unavailable'}
        </p>
        <p className="mt-2 text-[0.68rem] uppercase tracking-[0.15em] text-charcoal/45 dark:text-cream/45">
          Ships in 3–5 working days
        </p>

        <Button size="sm" className="mt-5 w-full" disabled={!purchasable} onClick={handleAdd}>
          {purchasable ? 'Add to Cart' : 'Unavailable'}
        </Button>
      </div>
    </div>
  );
}
