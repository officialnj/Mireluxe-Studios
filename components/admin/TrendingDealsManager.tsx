'use client';

import { useMemo, useRef, useState } from 'react';
import type { DbService } from '@/lib/booking/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

const BUCKET = 'product-media';

type DealDraft = {
  name: string;
  description: string;
  note: string;
  base_price_pounds: string;
  hair_incl_price_pounds: string;
  service_time_mins: string;
  deposit_pounds: string;
  morning_only: boolean;
  included_bundle_count: string;
  included_bundle_inches: string;
  image_path: string | null;
};

const emptyDraft: DealDraft = {
  name: '',
  description: '',
  note: '',
  base_price_pounds: '',
  hair_incl_price_pounds: '',
  service_time_mins: '',
  deposit_pounds: '',
  morning_only: false,
  included_bundle_count: '0',
  included_bundle_inches: '',
  image_path: null,
};

function toDraft(s: DbService): DealDraft {
  return {
    name: s.name,
    description: s.description,
    note: s.note ?? '',
    base_price_pounds: (s.base_price_pence / 100).toString(),
    hair_incl_price_pounds: s.hair_incl_price_pence != null ? (s.hair_incl_price_pence / 100).toString() : '',
    service_time_mins: s.service_time_mins != null ? s.service_time_mins.toString() : '',
    deposit_pounds: (s.deposit_pence / 100).toString(),
    morning_only: s.morning_only,
    included_bundle_count: s.included_bundle_count.toString(),
    included_bundle_inches: s.included_bundle_inches != null ? s.included_bundle_inches.toString() : '',
    image_path: s.image_path ?? null,
  };
}

function draftToPayload(d: DealDraft) {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    note: d.note.trim() || null,
    base_price_pence: Math.round(parseFloat(d.base_price_pounds || '0') * 100),
    hair_incl_price_pence: d.hair_incl_price_pounds ? Math.round(parseFloat(d.hair_incl_price_pounds) * 100) : null,
    service_time_mins: d.service_time_mins ? parseInt(d.service_time_mins, 10) : null,
    deposit_pence: d.deposit_pounds ? Math.round(parseFloat(d.deposit_pounds) * 100) : undefined,
    morning_only: d.morning_only,
    included_bundle_count: d.included_bundle_count ? parseInt(d.included_bundle_count, 10) : 0,
    included_bundle_inches: d.included_bundle_inches ? parseInt(d.included_bundle_inches, 10) : null,
    image_path: d.image_path,
  };
}

export default function TrendingDealsManager({ initialDeals }: { initialDeals: DbService[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [edits, setEdits] = useState<Record<string, DealDraft>>(Object.fromEntries(initialDeals.map((d) => [d.id, toDraft(d)])));
  const [newDraft, setNewDraft] = useState<DealDraft>(emptyDraft);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  function update(id: string, patch: Partial<DealDraft>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveDeal(id: string) {
    const draft = edits[id];
    if (!draft) return;
    setBusy(`save-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/trending-deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(draft)),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save.');
      return;
    }
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...draftToPayload(draft) } as DbService : d)));
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(`active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/trending-deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)));
  }

  async function persistOrder(ordered: DbService[]) {
    setBusy('reorder');
    setError(null);
    const res = await fetch('/api/admin/trending-deals/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: ordered.map((d) => d.id) }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to reorder.');
      return;
    }
    setDeals(ordered.map((d, i) => ({ ...d, sort_order: i })));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= deals.length) return;
    const reordered = [...deals];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(reordered);
  }

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!newDraft.name.trim() || !newDraft.description.trim() || !newDraft.base_price_pounds) {
      setError('Name, description and base price are required.');
      return;
    }
    setBusy('create');
    setError(null);
    const res = await fetch('/api/admin/trending-deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(newDraft)),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to create deal.');
      return;
    }
    const { deal } = await res.json();
    setDeals((prev) => [...prev, deal]);
    setEdits((prev) => ({ ...prev, [deal.id]: toDraft(deal) }));
    setNewDraft(emptyDraft);
    setShowNewForm(false);
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={() => setShowNewForm((v) => !v)}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal"
      >
        {showNewForm ? 'Cancel' : '+ New deal'}
      </button>

      {showNewForm && (
        <form onSubmit={createDeal} className="grid gap-3 rounded-xl border border-charcoal/10 p-4 md:grid-cols-2">
          <DealFields draft={newDraft} onChange={(patch) => setNewDraft((prev) => ({ ...prev, ...patch }))} />
          <div className="md:col-span-2">
            <button type="submit" disabled={busy === 'create'} className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50">
              {busy === 'create' ? 'Creating…' : 'Create deal'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {deals.length === 0 ? (
          <p className="text-sm text-charcoal/50">No Trending Deals yet.</p>
        ) : (
          deals.map((deal, index) => {
            const draft = edits[deal.id];
            if (!draft) return null;
            return (
              <div key={deal.id} className={`rounded-xl border p-4 ${deal.active ? 'border-charcoal/10' : 'border-red-500/20 opacity-70'}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => move(index, -1)} disabled={index === 0 || busy === 'reorder'} className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 disabled:opacity-30">
                      ↑
                    </button>
                    <button onClick={() => move(index, 1)} disabled={index === deals.length - 1 || busy === 'reorder'} className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/10 text-charcoal/60 hover:bg-charcoal/20 disabled:opacity-30">
                      ↓
                    </button>
                    <span className="text-sm font-medium">{deal.name}</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={deal.active}
                      disabled={busy === `active-${deal.id}`}
                      onChange={(e) => toggleActive(deal.id, e.target.checked)}
                    />
                    {deal.active ? 'On' : 'Off'}
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <DealFields draft={draft} onChange={(patch) => update(deal.id, patch)} />
                </div>
                <button
                  onClick={() => saveDeal(deal.id)}
                  disabled={busy === `save-${deal.id}`}
                  className="mt-3 inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                >
                  {busy === `save-${deal.id}` ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded border border-charcoal/20 bg-transparent px-3 py-2 text-sm';

function DealFields({ draft, onChange }: { draft: DealDraft; onChange: (patch: Partial<DealDraft>) => void }) {
  return (
    <>
      <div className="md:col-span-2">
        <Field label="Deal image (shown on the home page card)">
          <ImageUploader value={draft.image_path} onChange={(image_path) => onChange({ image_path })} />
        </Field>
      </div>
      <Field label="Name">
        <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Base price £">
        <input type="number" step="0.01" value={draft.base_price_pounds} onChange={(e) => onChange({ base_price_pounds: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Hair-included price £ (optional)">
        <input type="number" step="0.01" value={draft.hair_incl_price_pounds} onChange={(e) => onChange({ hair_incl_price_pounds: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Duration (mins)">
        <input type="number" value={draft.service_time_mins} onChange={(e) => onChange({ service_time_mins: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Deposit £ (inert — see pricing rules in lib/booking/pricing.ts)">
        <input type="number" step="0.01" value={draft.deposit_pounds} onChange={(e) => onChange({ deposit_pounds: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Included bundle count">
        <input type="number" value={draft.included_bundle_count} onChange={(e) => onChange({ included_bundle_count: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Included bundle length (in, optional)">
        <input type="number" value={draft.included_bundle_inches} onChange={(e) => onChange({ included_bundle_inches: e.target.value })} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-xs">
        <input type="checkbox" checked={draft.morning_only} onChange={(e) => onChange({ morning_only: e.target.checked })} />
        Morning only
      </label>
      <div className="md:col-span-2">
        <Field label="Description">
          <textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} className={`${inputClass} min-h-[60px]`} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Note (optional)">
          <textarea value={draft.note} onChange={(e) => onChange({ note: e.target.value })} className={`${inputClass} min-h-[50px]`} />
        </Field>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-charcoal/50">{label}</label>
      {children}
    </div>
  );
}

/**
 * Deal image uploader. Uploads the file straight from the admin's browser to
 * the public `product-media` bucket (prefix `deals/`) using their own
 * authenticated session — same model as the product media uploader — then
 * hands the Storage path up via onChange so it saves with the rest of the
 * deal. Only the path is persisted; the public URL is derived at render time.
 */
function ImageUploader({ value, onChange }: { value: string | null; onChange: (path: string | null) => void }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const previewUrl = value ? supabase.storage.from(BUCKET).getPublicUrl(value).data.publicUrl : null;

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.');
      return;
    }
    setErr(null);
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `deals/${Date.now()}-${Math.round(file.size)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    setBusy(false);
    if (error) {
      setErr('Upload failed — try again.');
      return;
    }
    onChange(path);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-charcoal/15 bg-charcoal/5">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Storage host isn't in next.config remotePatterns
          <img src={previewUrl} alt="Deal preview" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[0.65rem] text-charcoal/40">No image</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold hover:bg-gold/25 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-full bg-charcoal/10 px-3 py-1 text-xs text-charcoal/60 hover:bg-charcoal/20"
            >
              Remove
            </button>
          )}
        </div>
        {err && <p className="text-[0.7rem] text-red-600">{err}</p>}
      </div>
    </div>
  );
}
