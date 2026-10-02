'use client';

import { useState } from 'react';
import type { DbService, DbServiceCategory } from '@/lib/booking/types';

type ServiceRow = DbService & { service_categories: { name: string } | null };

type ServiceDraft = {
  category_id: string;
  name: string;
  size: string;
  description: string;
  note: string;
  base_price_pounds: string;
  hair_incl_price_pounds: string;
  service_time_mins: string;
  hair_incl_service_time_mins: string;
  style_duration_weeks: string;
  xpression_packs: string;
  morning_only: boolean;
  included_bundle_count: string;
  included_bundle_inches: string;
  deposit_pounds: string;
};

function emptyDraft(defaultCategoryId: string): ServiceDraft {
  return {
    category_id: defaultCategoryId,
    name: '',
    size: '',
    description: '',
    note: '',
    base_price_pounds: '',
    hair_incl_price_pounds: '',
    service_time_mins: '',
    hair_incl_service_time_mins: '',
    style_duration_weeks: '',
    xpression_packs: '',
    morning_only: false,
    included_bundle_count: '0',
    included_bundle_inches: '',
    deposit_pounds: '',
  };
}

function toDraft(s: ServiceRow): ServiceDraft {
  return {
    category_id: s.category_id,
    name: s.name,
    size: s.size ?? '',
    description: s.description,
    note: s.note ?? '',
    base_price_pounds: (s.base_price_pence / 100).toString(),
    hair_incl_price_pounds: s.hair_incl_price_pence != null ? (s.hair_incl_price_pence / 100).toString() : '',
    service_time_mins: s.service_time_mins != null ? s.service_time_mins.toString() : '',
    hair_incl_service_time_mins: s.hair_incl_service_time_mins != null ? s.hair_incl_service_time_mins.toString() : '',
    style_duration_weeks: s.style_duration_weeks ?? '',
    xpression_packs: s.xpression_packs ?? '',
    morning_only: s.morning_only,
    included_bundle_count: s.included_bundle_count.toString(),
    included_bundle_inches: s.included_bundle_inches != null ? s.included_bundle_inches.toString() : '',
    deposit_pounds: (s.deposit_pence / 100).toString(),
  };
}

function draftToPayload(d: ServiceDraft) {
  return {
    category_id: d.category_id,
    name: d.name.trim(),
    size: d.size.trim() || null,
    description: d.description.trim(),
    note: d.note.trim() || null,
    base_price_pence: Math.round(parseFloat(d.base_price_pounds || '0') * 100),
    hair_incl_price_pence: d.hair_incl_price_pounds ? Math.round(parseFloat(d.hair_incl_price_pounds) * 100) : null,
    service_time_mins: d.service_time_mins ? parseInt(d.service_time_mins, 10) : null,
    hair_incl_service_time_mins: d.hair_incl_service_time_mins ? parseInt(d.hair_incl_service_time_mins, 10) : null,
    style_duration_weeks: d.style_duration_weeks.trim() || null,
    xpression_packs: d.xpression_packs.trim() || null,
    morning_only: d.morning_only,
    included_bundle_count: d.included_bundle_count ? parseInt(d.included_bundle_count, 10) : 0,
    included_bundle_inches: d.included_bundle_inches ? parseInt(d.included_bundle_inches, 10) : null,
    deposit_pence: d.deposit_pounds ? Math.round(parseFloat(d.deposit_pounds) * 100) : undefined,
  };
}

const inputClass = 'w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm';

export default function ServicesTable({
  initialServices,
  categories,
}: {
  initialServices: ServiceRow[];
  categories: DbServiceCategory[];
}) {
  const [services, setServices] = useState(initialServices);
  const [edits, setEdits] = useState<Record<string, ServiceDraft>>(
    Object.fromEntries(initialServices.map((s) => [s.id, toDraft(s)]))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<ServiceDraft>(emptyDraft(categories[0]?.id ?? ''));
  const [showNewForm, setShowNewForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<ServiceDraft>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveService(id: string) {
    const draft = edits[id];
    if (!draft) return;
    if (!draft.name.trim() || !draft.description.trim()) {
      setError('Name and description are required.');
      return;
    }
    setBusy(`save-${id}`);
    setError(null);
    const payload = draftToPayload(draft);
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to save.');
      return;
    }
    const categoryName = categories.find((c) => c.id === payload.category_id)?.name ?? null;
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? ({ ...s, ...payload, deposit_pence: payload.deposit_pence ?? s.deposit_pence, service_categories: { name: categoryName ?? '' } } as ServiceRow)
          : s
      )
    );
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(`active-${id}`);
    setError(null);
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update.');
      return;
    }
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
  }

  async function persistOrder(categoryId: string, ordered: ServiceRow[]) {
    setBusy('reorder');
    setError(null);
    const res = await fetch('/api/admin/services/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, orderedIds: ordered.map((s) => s.id) }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to reorder.');
      return;
    }
    const orderMap = new Map(ordered.map((s, i) => [s.id, i]));
    setServices((prev) => prev.map((s) => (orderMap.has(s.id) ? { ...s, sort_order: orderMap.get(s.id)! } : s)));
  }

  function move(categoryId: string, groupServices: ServiceRow[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= groupServices.length) return;
    const reordered = [...groupServices];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    persistOrder(categoryId, reordered);
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!newDraft.category_id || !newDraft.name.trim() || !newDraft.description.trim() || !newDraft.base_price_pounds) {
      setError('Category, name, description and base price are required.');
      return;
    }
    setBusy('create');
    setError(null);
    const res = await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(newDraft)),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to create service.');
      return;
    }
    const { service } = await res.json();
    setServices((prev) => [...prev, service]);
    setEdits((prev) => ({ ...prev, [service.id]: toDraft(service) }));
    setNewDraft(emptyDraft(categories[0]?.id ?? ''));
    setShowNewForm(false);
  }

  const servicesByCategory = new Map<string, ServiceRow[]>();
  for (const s of services) {
    servicesByCategory.set(s.category_id, [...(servicesByCategory.get(s.category_id) ?? []), s]);
  }
  for (const list of servicesByCategory.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  const orderedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  // Catch any service whose category was removed from the categories list.
  const knownCategoryIds = new Set(orderedCategories.map((c) => c.id));
  const uncategorised = services.filter((s) => !knownCategoryIds.has(s.category_id));

  return (
    <div className="space-y-8">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button
        onClick={() => setShowNewForm((v) => !v)}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal"
      >
        {showNewForm ? 'Cancel' : '+ New service'}
      </button>

      {showNewForm && (
        <form onSubmit={createService} className="rounded-xl border border-cream/10 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <ServiceFields draft={newDraft} categories={categories} onChange={(patch) => setNewDraft((prev) => ({ ...prev, ...patch }))} />
          </div>
          <button
            type="submit"
            disabled={busy === 'create'}
            className="mt-3 rounded-full bg-gold px-4 py-2 text-xs font-medium text-charcoal disabled:opacity-50"
          >
            {busy === 'create' ? 'Creating…' : 'Create service'}
          </button>
        </form>
      )}

      {orderedCategories.map((category) => {
        const groupServices = servicesByCategory.get(category.id) ?? [];
        return (
          <div key={category.id}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-cream/50">
              {category.name} {!category.active && <span className="text-red-300">(category inactive)</span>}
            </h2>
            {groupServices.length === 0 ? (
              <p className="text-sm text-cream/40">No services in this category yet.</p>
            ) : (
              <div className="space-y-3">
                {groupServices.map((s, index) => {
                  const draft = edits[s.id];
                  if (!draft) return null;
                  const isExpanded = expandedId === s.id;
                  return (
                    <div key={s.id} className={`rounded-xl border p-4 ${s.active ? 'border-cream/10' : 'border-red-500/20 opacity-70'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => move(category.id, groupServices, index, -1)}
                            disabled={index === 0 || busy === 'reorder'}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => move(category.id, groupServices, index, 1)}
                            disabled={index === groupServices.length - 1 || busy === 'reorder'}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10 text-cream/60 hover:bg-cream/20 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-cream/40">
                            £{(s.base_price_pence / 100).toFixed(2)}
                            {s.service_time_mins != null ? ` · ${s.service_time_mins}min` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={s.active}
                              disabled={busy === `active-${s.id}`}
                              onChange={(e) => toggleActive(s.id, e.target.checked)}
                            />
                            {s.active ? 'Active' : 'Archived'}
                          </label>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            className="inline-flex items-center rounded-full bg-cream/10 px-2.5 py-1 text-xs font-medium text-cream/70 transition-colors hover:bg-cream/20"
                          >
                            {isExpanded ? 'Collapse' : 'Edit'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <ServiceFields draft={draft} categories={categories} onChange={(patch) => update(s.id, patch)} />
                          </div>
                          <button
                            onClick={() => saveService(s.id)}
                            disabled={busy === `save-${s.id}`}
                            className="mt-3 inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                          >
                            {busy === `save-${s.id}` ? 'Saving…' : 'Save changes'}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {uncategorised.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-red-300">Uncategorised</h2>
          <div className="space-y-3">
            {uncategorised.map((s) => {
              const draft = edits[s.id];
              if (!draft) return null;
              return (
                <div key={s.id} className="rounded-xl border border-red-500/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{s.name}</span>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.active}
                        disabled={busy === `active-${s.id}`}
                        onChange={(e) => toggleActive(s.id, e.target.checked)}
                      />
                      {s.active ? 'Active' : 'Archived'}
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ServiceFields draft={draft} categories={categories} onChange={(patch) => update(s.id, patch)} />
                  </div>
                  <button onClick={() => saveService(s.id)} disabled={busy === `save-${s.id}`} className="mt-3 inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50">
                    {busy === `save-${s.id}` ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceFields({
  draft,
  categories,
  onChange,
}: {
  draft: ServiceDraft;
  categories: DbServiceCategory[];
  onChange: (patch: Partial<ServiceDraft>) => void;
}) {
  return (
    <>
      <Field label="Category">
        <select value={draft.category_id} onChange={(e) => onChange({ category_id: e.target.value })} className={inputClass}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Size (optional)">
        <input value={draft.size} onChange={(e) => onChange({ size: e.target.value })} className={inputClass} />
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
      <Field label="Hair-included duration (mins, optional)">
        <input type="number" value={draft.hair_incl_service_time_mins} onChange={(e) => onChange({ hair_incl_service_time_mins: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Deposit £">
        <input type="number" step="0.01" value={draft.deposit_pounds} onChange={(e) => onChange({ deposit_pounds: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Style duration, weeks (display only, e.g. 4-5)">
        <input value={draft.style_duration_weeks} onChange={(e) => onChange({ style_duration_weeks: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Xpression packs (display only, e.g. 3-4)">
        <input value={draft.xpression_packs} onChange={(e) => onChange({ xpression_packs: e.target.value })} className={inputClass} />
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
      <label className="mb-1 block text-xs text-cream/50">{label}</label>
      {children}
    </div>
  );
}
