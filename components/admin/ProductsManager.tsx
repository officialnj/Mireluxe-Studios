'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DbBundle, DbBundleVariant } from '@/lib/booking/types';
import type { DbBundleMedia } from '@/lib/shop/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

const BUCKET = 'product-media';

const STAGE_LABEL: Record<string, string> = {
  capturing: 'Generating preview…',
  'uploading-video': 'Uploading video…',
  'uploading-image': 'Uploading image…',
  'uploading-poster': 'Uploading preview…',
  saving: 'Saving…',
};

function extFor(file: File): string {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  const MIME_EXT: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return MIME_EXT[file.type] ?? 'bin';
}

/**
 * Captures the first frame of a locally-selected video file as a JPEG blob,
 * entirely client-side (no upload/transcode round-trip) — used to give
 * video products a YouTube-style static cover image. Seeks to 0.1s rather
 * than 0 because some browsers render a blank frame at exactly the start.
 */
async function captureVideoPoster(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);

  try {
    return await new Promise<Blob>((resolve, reject) => {
      function cleanupListeners() {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      }
      function onLoadedData() {
        video.currentTime = 0.1;
      }
      function onSeeked() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanupListeners();
          reject(new Error('canvas_context_unavailable'));
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanupListeners();
            if (blob) resolve(blob);
            else reject(new Error('poster_export_failed'));
          },
          'image/jpeg',
          0.85
        );
      }
      function onError() {
        cleanupListeners();
        reject(new Error('video_load_failed'));
      }
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.src = objectUrl;
    });
  } finally {
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

type VariantDraft = {
  inches: string;
  colour: string;
  price_pounds: string;
  stock_quantity: string;
  image_url: string;
  description: string;
};

const emptyDraft: VariantDraft = { inches: '', colour: '', price_pounds: '', stock_quantity: '0', image_url: '', description: '' };

function toDraft(v: DbBundleVariant): VariantDraft {
  return {
    inches: v.inches.toString(),
    colour: v.colour,
    price_pounds: (v.price_pence / 100).toString(),
    stock_quantity: v.stock_quantity.toString(),
    image_url: v.image_url ?? '',
    description: v.description ?? '',
  };
}

/**
 * Full CRUD over the shared bundle/bundle_variants inventory (booking
 * add-ons today, retail /shop storefront once Agent E's storefront lands —
 * both read this same table). Sits alongside the pre-existing
 * BundleStockTable, which only does the quick in_stock toggle — that
 * component and its behaviour are left untouched (deletion lock).
 */
export default function ProductsManager({
  initialBundles,
  initialVariants,
}: {
  initialBundles: DbBundle[];
  initialVariants: DbBundleVariant[];
}) {
  const [bundles, setBundles] = useState(initialBundles);
  const [variants, setVariants] = useState(initialVariants);
  const [newBundleName, setNewBundleName] = useState('');
  const [bundleNameEdits, setBundleNameEdits] = useState<Record<string, string>>(
    Object.fromEntries(initialBundles.map((b) => [b.id, b.name]))
  );
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantDraft>>(
    Object.fromEntries(initialVariants.map((v) => [v.id, toDraft(v)]))
  );
  const [newVariantDrafts, setNewVariantDrafts] = useState<Record<string, VariantDraft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-variant photo/video gallery (bundle_media). Uploaded straight from
  // the browser to Supabase Storage using the admin's own logged-in session
  // (storage.objects RLS requires an authenticated admin — a Route Handler
  // proxy would also risk exceeding serverless body-size limits for a 100MB
  // video). Only the resulting storage paths are persisted server-side, via
  // app/api/admin/bundle-media.
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mediaByVariant, setMediaByVariant] = useState<Record<string, DbBundleMedia[]>>({});
  const [mediaBusy, setMediaBusy] = useState<Record<string, string | null>>({});
  const [mediaError, setMediaError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/bundle-media')
      .then((res) => (res.ok ? res.json() : { media: [] }))
      .then(({ media }: { media: DbBundleMedia[] }) => {
        if (cancelled) return;
        const grouped: Record<string, DbBundleMedia[]> = {};
        for (const m of media ?? []) {
          (grouped[m.bundle_variant_id] ??= []).push(m);
        }
        for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.sort_order - b.sort_order);
        setMediaByVariant(grouped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function publicMediaUrl(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function uploadMedia(variantId: string, file: File) {
    setMediaError((prev) => ({ ...prev, [variantId]: null }));
    const isVideo = file.type.startsWith('video/');
    const ext = extFor(file);
    const base = `bundle-variants/${variantId}/${Date.now()}`;
    const mainPath = `${base}-${isVideo ? 'video' : 'image'}.${ext}`;

    let posterBlob: Blob | null = null;
    if (isVideo) {
      setMediaBusy((prev) => ({ ...prev, [variantId]: 'capturing' }));
      try {
        posterBlob = await captureVideoPoster(file);
      } catch {
        setMediaError((prev) => ({ ...prev, [variantId]: 'Could not read a preview frame from that video — try a different file.' }));
        setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
        return;
      }
    }

    setMediaBusy((prev) => ({ ...prev, [variantId]: isVideo ? 'uploading-video' : 'uploading-image' }));
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(mainPath, file, {
      contentType: file.type || undefined,
    });
    if (uploadError) {
      setMediaError((prev) => ({ ...prev, [variantId]: 'Upload failed — check your connection and try again.' }));
      setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
      return;
    }

    let posterPath: string | null = null;
    if (isVideo && posterBlob) {
      posterPath = `${base}-poster.jpg`;
      setMediaBusy((prev) => ({ ...prev, [variantId]: 'uploading-poster' }));
      const { error: posterError } = await supabase.storage.from(BUCKET).upload(posterPath, posterBlob, {
        contentType: 'image/jpeg',
      });
      if (posterError) {
        await supabase.storage.from(BUCKET).remove([mainPath]); // best-effort — don't orphan the video
        setMediaError((prev) => ({ ...prev, [variantId]: 'Preview image upload failed — try again.' }));
        setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
        return;
      }
    }

    setMediaBusy((prev) => ({ ...prev, [variantId]: 'saving' }));
    const sortOrder = (mediaByVariant[variantId] ?? []).length;
    const res = await fetch('/api/admin/bundle-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle_variant_id: variantId,
        media_type: isVideo ? 'video' : 'image',
        storage_path: mainPath,
        poster_storage_path: posterPath,
        sort_order: sortOrder,
      }),
    });
    setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
    if (!res.ok) {
      // Best-effort cleanup so a failed DB write doesn't leave an orphaned
      // upload sitting in Storage with nothing pointing at it.
      await supabase.storage.from(BUCKET).remove(posterPath ? [mainPath, posterPath] : [mainPath]);
      setMediaError((prev) => ({ ...prev, [variantId]: 'Failed to save media record.' }));
      return;
    }
    const { media } = await res.json();
    setMediaByVariant((prev) => ({ ...prev, [variantId]: [...(prev[variantId] ?? []), media as DbBundleMedia] }));
  }

  async function deleteMedia(variantId: string, mediaId: string) {
    setMediaBusy((prev) => ({ ...prev, [variantId]: `deleting-${mediaId}` }));
    setMediaError((prev) => ({ ...prev, [variantId]: null }));
    const res = await fetch(`/api/admin/bundle-media/${mediaId}`, { method: 'DELETE' });
    setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
    if (!res.ok) {
      setMediaError((prev) => ({ ...prev, [variantId]: 'Failed to delete — try again.' }));
      return;
    }
    setMediaByVariant((prev) => ({ ...prev, [variantId]: (prev[variantId] ?? []).filter((m) => m.id !== mediaId) }));
  }

  async function moveMedia(variantId: string, index: number, direction: -1 | 1) {
    const list = mediaByVariant[variantId] ?? [];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setMediaBusy((prev) => ({ ...prev, [variantId]: 'reorder' }));
    const res = await fetch('/api/admin/bundle-media/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle_variant_id: variantId, orderedIds: reordered.map((m) => m.id) }),
    });
    setMediaBusy((prev) => ({ ...prev, [variantId]: null }));
    if (!res.ok) {
      setMediaError((prev) => ({ ...prev, [variantId]: 'Failed to reorder.' }));
      return;
    }
    setMediaByVariant((prev) => ({ ...prev, [variantId]: reordered.map((m, i) => ({ ...m, sort_order: i })) }));
  }

  async function createBundle(e: React.FormEvent) {
    e.preventDefault();
    if (!newBundleName.trim()) return;
    setBusy('new-bundle');
    setError(null);
    const res = await fetch('/api/admin/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBundleName.trim() }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to create product.');
      return;
    }
    const { bundle } = await res.json();
    setBundles((prev) => [...prev, bundle]);
    setBundleNameEdits((prev) => ({ ...prev, [bundle.id]: bundle.name }));
    setNewBundleName('');
  }

  async function saveBundleName(id: string) {
    const name = bundleNameEdits[id]?.trim();
    if (!name) return;
    setBusy(`bundle-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/bundles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save name.');
      return;
    }
    setBundles((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  }

  async function toggleBundleActive(id: string, active: boolean) {
    setBusy(`bundle-active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/bundles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setBundles((prev) => prev.map((b) => (b.id === id ? { ...b, active } : b)));
  }

  function updateVariantDraft(id: string, patch: Partial<VariantDraft>) {
    setVariantEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveVariant(id: string) {
    const draft = variantEdits[id];
    if (!draft) return;
    setBusy(`variant-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/bundle-variants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inches: parseInt(draft.inches, 10),
        colour: draft.colour,
        price_pence: Math.round(parseFloat(draft.price_pounds || '0') * 100),
        stock_quantity: parseInt(draft.stock_quantity || '0', 10),
        image_url: draft.image_url.trim() || null,
        description: draft.description.trim() || null,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'duplicate_variant' ? 'Another variant already has that length/colour.' : 'Failed to save.');
      return;
    }
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              inches: parseInt(draft.inches, 10),
              colour: draft.colour,
              price_pence: Math.round(parseFloat(draft.price_pounds || '0') * 100),
              stock_quantity: parseInt(draft.stock_quantity || '0', 10),
              image_url: draft.image_url.trim() || null,
              description: draft.description.trim() || null,
            }
          : v
      )
    );
  }

  async function toggleVariantStock(id: string, in_stock: boolean) {
    setBusy(`variant-stock-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/bundle-variants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_stock }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, in_stock } : v)));
  }

  async function createVariant(bundleId: string) {
    const draft = newVariantDrafts[bundleId] ?? emptyDraft;
    if (!draft.inches || !draft.colour || !draft.price_pounds) {
      setError('Length, colour and price are required for a new variant.');
      return;
    }
    setBusy(`new-variant-${bundleId}`);
    setError(null);
    const res = await fetch('/api/admin/bundle-variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle_id: bundleId,
        inches: parseInt(draft.inches, 10),
        colour: draft.colour,
        price_pence: Math.round(parseFloat(draft.price_pounds || '0') * 100),
        stock_quantity: parseInt(draft.stock_quantity || '0', 10),
        image_url: draft.image_url.trim() || null,
        description: draft.description.trim() || null,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'duplicate_variant' ? 'That length/colour already exists for this product.' : 'Failed to create variant.');
      return;
    }
    const { variant } = await res.json();
    setVariants((prev) => [...prev, variant]);
    setVariantEdits((prev) => ({ ...prev, [variant.id]: toDraft(variant) }));
    setNewVariantDrafts((prev) => ({ ...prev, [bundleId]: emptyDraft }));
  }

  const variantsByBundle = new Map<string, DbBundleVariant[]>();
  for (const v of variants) {
    variantsByBundle.set(v.bundle_id, [...(variantsByBundle.get(v.bundle_id) ?? []), v]);
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={createBundle} className="flex items-end gap-3 rounded-xl border border-cream/10 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-cream/50" htmlFor="new-bundle-name">
            New product name
          </label>
          <input
            id="new-bundle-name"
            value={newBundleName}
            onChange={(e) => setNewBundleName(e.target.value)}
            placeholder="e.g. Curly Bulk Bundle"
            className="w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === 'new-bundle'}
          className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal disabled:opacity-50"
        >
          Add product
        </button>
      </form>

      <div className="space-y-6">
        {bundles.map((bundle) => {
          const bundleVariants = variantsByBundle.get(bundle.id) ?? [];
          const draft = newVariantDrafts[bundle.id] ?? emptyDraft;
          return (
            <div
              key={bundle.id}
              className={`rounded-xl border p-4 ${bundle.active ? 'border-cream/10' : 'border-red-500/20 opacity-70'}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input
                  value={bundleNameEdits[bundle.id] ?? ''}
                  onChange={(e) => setBundleNameEdits((prev) => ({ ...prev, [bundle.id]: e.target.value }))}
                  className="rounded border border-cream/20 bg-transparent px-3 py-1.5 text-sm font-medium"
                />
                <button
                  onClick={() => saveBundleName(bundle.id)}
                  disabled={busy === `bundle-${bundle.id}`}
                  className="text-xs text-gold hover:underline"
                >
                  Save name
                </button>
                <label className="ml-auto flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={bundle.active}
                    disabled={busy === `bundle-active-${bundle.id}`}
                    onChange={(e) => toggleBundleActive(bundle.id, e.target.checked)}
                  />
                  {bundle.active ? 'Active' : 'Archived'}
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-cream/10 uppercase tracking-wide text-cream/50">
                    <tr>
                      <th className="px-2 py-2">Length (in)</th>
                      <th className="px-2 py-2">Colour</th>
                      <th className="px-2 py-2">Price £</th>
                      <th className="px-2 py-2">Stock qty</th>
                      <th className="px-2 py-2">Image URL</th>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2">In stock</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundleVariants.map((v) => {
                      const vd = variantEdits[v.id];
                      if (!vd) return null;
                      return (
                        <tr key={v.id} className="border-b border-cream/5 last:border-0">
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={vd.inches}
                              onChange={(e) => updateVariantDraft(v.id, { inches: e.target.value })}
                              className="w-16 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={vd.colour}
                              onChange={(e) => updateVariantDraft(v.id, { colour: e.target.value })}
                              className="w-16 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={vd.price_pounds}
                              onChange={(e) => updateVariantDraft(v.id, { price_pounds: e.target.value })}
                              className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={vd.stock_quantity}
                              onChange={(e) => updateVariantDraft(v.id, { stock_quantity: e.target.value })}
                              className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={vd.image_url}
                              placeholder="https://…"
                              onChange={(e) => updateVariantDraft(v.id, { image_url: e.target.value })}
                              className="w-40 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={vd.description}
                              onChange={(e) => updateVariantDraft(v.id, { description: e.target.value })}
                              className="w-40 rounded border border-cream/20 bg-transparent px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={v.in_stock}
                              disabled={busy === `variant-stock-${v.id}`}
                              onChange={(e) => toggleVariantStock(v.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => saveVariant(v.id)}
                              disabled={busy === `variant-${v.id}`}
                              className="text-gold hover:underline"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-cream/[0.02]">
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          placeholder="18"
                          value={draft.inches}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, inches: e.target.value } }))}
                          className="w-16 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          placeholder="1B"
                          value={draft.colour}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, colour: e.target.value } }))}
                          className="w-16 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="50.00"
                          value={draft.price_pounds}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, price_pounds: e.target.value } }))}
                          className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          placeholder="0"
                          value={draft.stock_quantity}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, stock_quantity: e.target.value } }))}
                          className="w-20 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          placeholder="https://…"
                          value={draft.image_url}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, image_url: e.target.value } }))}
                          className="w-40 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          placeholder="Description"
                          value={draft.description}
                          onChange={(e) => setNewVariantDrafts((prev) => ({ ...prev, [bundle.id]: { ...draft, description: e.target.value } }))}
                          className="w-40 rounded border border-cream/20 bg-transparent px-2 py-1"
                        />
                      </td>
                      <td className="px-2 py-2 text-cream/30">new</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => createVariant(bundle.id)}
                          disabled={busy === `new-variant-${bundle.id}`}
                          className="text-gold hover:underline"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-3 border-t border-cream/10 pt-4">
                <h3 className="text-[0.7rem] font-medium uppercase tracking-wide text-cream/50">Photos &amp; videos</h3>
                {bundleVariants.length === 0 ? (
                  <p className="text-[0.7rem] text-cream/40">Add a variant above before uploading media.</p>
                ) : (
                  bundleVariants.map((v) => (
                    <VariantMediaManager
                      key={v.id}
                      variant={v}
                      media={mediaByVariant[v.id] ?? []}
                      busy={mediaBusy[v.id] ?? null}
                      error={mediaError[v.id] ?? null}
                      publicUrl={publicMediaUrl}
                      onUpload={(file) => uploadMedia(v.id, file)}
                      onDelete={(mediaId) => deleteMedia(v.id, mediaId)}
                      onMove={(index, direction) => moveMedia(v.id, index, direction)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One variant's photo/video gallery — thumbnail grid with up/down reorder
 * (same pattern as TrendingDealsManager's move()) and delete, plus a file
 * input that triggers the upload flow in the parent (poster capture for
 * video, then direct-to-Storage upload, then a POST to persist the row).
 */
function VariantMediaManager({
  variant,
  media,
  busy,
  error,
  publicUrl,
  onUpload,
  onDelete,
  onMove,
}: {
  variant: DbBundleVariant;
  media: DbBundleMedia[];
  busy: string | null;
  error: string | null;
  publicUrl: (path: string) => string;
  onUpload: (file: File) => void;
  onDelete: (mediaId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const uploadStage = busy && STAGE_LABEL[busy] ? busy : null;

  return (
    <div className="rounded-lg border border-cream/10 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">
          {variant.inches}&quot; · {variant.colour}
        </span>
        <label className={`text-xs ${uploadStage ? 'cursor-not-allowed text-cream/40' : 'cursor-pointer text-gold hover:underline'}`}>
          {uploadStage ? STAGE_LABEL[uploadStage] : '+ Add photo/video'}
          <input
            type="file"
            accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={Boolean(uploadStage)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>

      {error && <p className="mb-2 text-[0.7rem] text-red-300">{error}</p>}

      {media.length === 0 ? (
        <p className="text-[0.7rem] text-cream/40">No media yet — the storefront falls back to the Image URL field above.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {media.map((m, index) => (
            <div key={m.id} className="w-24 rounded border border-cream/10 p-2 text-center">
              <div className="relative mx-auto mb-1 h-16 w-16 overflow-hidden rounded bg-charcoal/40">
                {/* Plain <img>, not next/image — these are Supabase Storage
                    URLs and next.config.mjs has no remotePatterns entry for
                    that host (out of scope for this change). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicUrl(m.media_type === 'video' ? m.poster_storage_path ?? m.storage_path : m.storage_path)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {m.media_type === 'video' && (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-charcoal/80 px-1 text-[0.55rem] uppercase text-cream">
                    Video
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[0.65rem]">
                <button
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0 || busy === 'reorder'}
                  className="text-cream/50 hover:text-gold disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  ↑
                </button>
                <button
                  onClick={() => onMove(index, 1)}
                  disabled={index === media.length - 1 || busy === 'reorder'}
                  className="text-cream/50 hover:text-gold disabled:opacity-30"
                  aria-label="Move later"
                >
                  ↓
                </button>
                <button
                  onClick={() => onDelete(m.id)}
                  disabled={busy === `deleting-${m.id}`}
                  className="text-red-300 hover:underline disabled:opacity-30"
                >
                  {busy === `deleting-${m.id}` ? '…' : 'Del'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
