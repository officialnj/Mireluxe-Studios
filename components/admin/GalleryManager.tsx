'use client';

import { useMemo, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

const BUCKET = 'product-media';

export type GalleryImage = {
  id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

/**
 * Admin gallery manager. Uploads images straight from the browser to the
 * public `product-media` bucket (prefix `gallery/`) using the admin's own
 * authenticated session — same model as the product media uploader — then
 * records the path via /api/admin/gallery. Supports remove and reorder.
 * These images render first on the public /gallery page, ahead of the
 * git-managed filesystem portfolio.
 */
export default function GalleryManager({ initialImages }: { initialImages: GalleryImage[] }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  async function handleFiles(files: FileList) {
    setError(null);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files can be added to the gallery.');
        continue;
      }
      setBusy(`upload-${file.name}`);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `gallery/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) {
        setError(`Upload failed for ${file.name}.`);
        setBusy(null);
        continue;
      }
      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path }),
      });
      if (!res.ok) {
        await supabase.storage.from(BUCKET).remove([path]); // best-effort — don't orphan
        setError(`Could not save ${file.name}.`);
        setBusy(null);
        continue;
      }
      const { image } = await res.json();
      setImages((prev) => [...prev, image as GalleryImage]);
    }
    setBusy(null);
  }

  async function removeImage(id: string) {
    setBusy(`delete-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to remove image.');
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function persistOrder(ordered: GalleryImage[]) {
    setBusy('reorder');
    setError(null);
    const res = await fetch('/api/admin/gallery/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: ordered.map((i) => i.id) }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to reorder.');
      return;
    }
    setImages(ordered.map((img, i) => ({ ...img, sort_order: i })));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(reordered);
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(busy && busy.startsWith('upload'))}
          className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
        >
          {busy && busy.startsWith('upload') ? 'Uploading…' : '+ Upload images'}
        </button>
        <p className="mt-2 text-xs text-charcoal/40">
          Uploaded images appear first on the public gallery, ahead of the existing portfolio.
        </p>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-charcoal/50">No uploaded gallery images yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => (
            <div key={img.id} className="overflow-hidden rounded-xl border border-charcoal/10">
              <div className="relative aspect-square w-full bg-charcoal/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage host isn't in next.config remotePatterns */}
                <img src={publicUrl(img.storage_path)} alt={img.caption ?? 'Gallery image'} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || busy === 'reorder'}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1 || busy === 'reorder'}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 disabled:opacity-30"
                    aria-label="Move later"
                  >
                    ↓
                  </button>
                </div>
                <button
                  onClick={() => removeImage(img.id)}
                  disabled={busy === `delete-${img.id}`}
                  className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/25 disabled:opacity-50"
                >
                  {busy === `delete-${img.id}` ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
