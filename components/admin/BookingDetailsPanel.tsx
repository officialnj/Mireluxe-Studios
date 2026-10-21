'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { computeTotals, formatPence, WITHOUT_HAIR_FLAT_DEPOSIT_PENCE } from '@/lib/booking/pricing';
import { statusStyle } from '@/lib/admin/bookingStatus';
import type { DbService, DbServiceAddon, TimeSlot } from '@/lib/booking/types';
import type { BookingRow } from '@/components/admin/BookingsTable';

type Mode = 'view' | 'edit';

const fieldClass =
  'w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gold';
const labelClass = 'mb-1 block text-[0.65rem] font-medium uppercase tracking-luxe text-charcoal/50';
const btn = 'inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50';
const btnGold = `${btn} bg-gold text-charcoal hover:opacity-90`;
const btnGhost = `${btn} bg-charcoal/[0.06] text-charcoal/70 hover:bg-charcoal/10`;
const btnDanger = `${btn} bg-rose-500/15 text-rose-700 hover:bg-rose-500/25`;
const btnSky = `${btn} bg-sky-500/15 text-sky-700 hover:bg-sky-500/25`;

function londonDate(iso: string): string {
  return formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'yyyy-MM-dd');
}

export default function BookingDetailsPanel({
  booking,
  onClose,
  onChanged,
}: {
  booking: BookingRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const style = statusStyle(booking.status);
  const isPast = new Date(booking.appointment_start) <= new Date();
  const canTransition = booking.status === 'confirmed' && isPast;
  const isEditable = booking.status === 'confirmed' || booking.status === 'pending_payment';

  // ── Edit-mode catalogue (services + add-ons), loaded once on first edit ──
  const [services, setServices] = useState<DbService[]>([]);
  const [addons, setAddons] = useState<DbServiceAddon[]>([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);

  // ── Editable draft ──
  const [serviceId, setServiceId] = useState(booking.service_id);
  const [hairIncluded, setHairIncluded] = useState(booking.hair_included);
  const [date, setDate] = useState(londonDate(booking.appointment_start));
  const [slotStart, setSlotStart] = useState<string>(booking.appointment_start);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [notes, setNotes] = useState(booking.notes ?? '');

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [offeredAlternatives, setOfferedAlternatives] = useState<TimeSlot[] | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  async function enterEdit() {
    setMode('edit');
    setError(null);
    if (!catalogueLoaded) {
      try {
        const [svcRes, addonRes] = await Promise.all([fetch('/api/services'), fetch('/api/admin/addons')]);
        const svcData = await svcRes.json();
        const addonData = await addonRes.json();
        setServices((svcData.services as DbService[]) ?? []);
        setAddons((addonData.addons as DbServiceAddon[]) ?? []);
        setCatalogueLoaded(true);
      } catch {
        setError('Could not load services/add-ons. Try again.');
      }
    }
  }

  // Add-ons available for the current selection: the hair-included bucket
  // (category_id === null) when hair is included, otherwise the selected
  // service's own category — mirrors the public booking form's filter.
  const availableAddons = useMemo(() => {
    if (!selectedService) return [];
    return addons.filter((a) => (hairIncluded ? a.category_id === null : a.category_id === selectedService.category_id));
  }, [addons, hairIncluded, selectedService]);

  // Drop any selected add-on that isn't valid for the new service/hair choice.
  useEffect(() => {
    if (mode !== 'edit') return;
    setSelectedAddonIds((prev) => prev.filter((id) => availableAddons.some((a) => a.id === id)));
  }, [availableAddons, mode]);

  // Fetch valid slots whenever date / service / hair changes in edit mode.
  useEffect(() => {
    if (mode !== 'edit' || !serviceId || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    const q = new URLSearchParams({ serviceId, date, hairIncluded: String(hairIncluded), excludeBookingId: booking.id });
    fetch(`/api/admin/bookings/slots?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: TimeSlot[] = d.slots ?? [];
        setSlots(list);
        // Keep the current time selected if it's still offered; else pick the
        // first available; else leave the current value (server will validate).
        setSlotStart((cur) => (list.some((s) => s.start === cur) ? cur : list[0]?.start ?? cur));
      })
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, serviceId, date, hairIncluded, booking.id]);

  // ── Live pricing preview (client-side, mirrors the server calculation) ──
  const preview = useMemo(() => {
    if (!selectedService) return null;
    const addOnLines = availableAddons.filter((a) => selectedAddonIds.includes(a.id)).map((addon) => ({ addon }));
    const base = computeTotals(selectedService, hairIncluded, [], addOnLines);
    const bundlesPence = booking.booking_bundles.reduce((s, b) => s + b.price_pence_at_booking * b.quantity, 0);
    const total = base.servicePricePence + base.addOnsPricePence + bundlesPence;
    const depositDue = hairIncluded ? Math.round(total * 0.5) : WITHOUT_HAIR_FLAT_DEPOSIT_PENCE;
    return {
      total,
      depositDue,
      balance: Math.max(0, total - booking.deposit_paid_pence),
      diff: total - booking.total_price_pence,
    };
  }, [selectedService, availableAddons, selectedAddonIds, hairIncluded, booking]);

  async function callAndRefresh(url: string, init: RequestInit, failMsg: string, onOk?: () => void) {
    setBusy(url);
    setError(null);
    const res = await fetch(url, init);
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'slot_unavailable' || data.error === 'slot_taken') {
        setOfferedAlternatives(data.slots ?? []);
        setError('That time isn’t available. Pick one of the suggested times.');
      } else {
        setError(failMsg);
      }
      return false;
    }
    onOk?.();
    onChanged();
    return true;
  }

  async function saveEdit() {
    setOfferedAlternatives(null);
    const ok = await callAndRefresh(
      `/api/admin/bookings/${booking.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          hairIncluded,
          slotStart,
          addonIds: selectedAddonIds,
          notes: notes.trim() || null,
        }),
      },
      'Failed to save changes.',
      () => setMode('view')
    );
    return ok;
  }

  async function doCancel() {
    if (!confirm('Cancel this booking? This cannot be undone.')) return;
    await callAndRefresh(`/api/admin/bookings/${booking.id}/cancel`, { method: 'POST' }, 'Failed to cancel booking.');
  }

  async function doStatus(status: 'completed' | 'no_show') {
    await callAndRefresh(
      `/api/admin/bookings/${booking.id}/status`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
      'Failed to update status.'
    );
  }

  async function doResend() {
    setBusy('resend');
    setError(null);
    const res = await fetch(`/api/admin/bookings/${booking.id}/resend-confirmation`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) setError('Failed to resend confirmation.');
    else setResent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-charcoal/40 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-ivory shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-charcoal/10 bg-ivory/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[0.62rem] uppercase tracking-luxe text-charcoal/45">
              {mode === 'edit' ? 'Edit booking' : 'Booking'}
            </p>
            <h2 className="font-serif text-xl font-light">{booking.customer_name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-charcoal/50 hover:bg-charcoal/[0.06] hover:text-charcoal">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 px-5 py-5">
          {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}

          {mode === 'view' ? (
            <ViewBody booking={booking} style={style} />
          ) : (
            <EditBody
              services={services}
              serviceId={serviceId}
              setServiceId={setServiceId}
              hairIncluded={hairIncluded}
              setHairIncluded={setHairIncluded}
              selectedService={selectedService}
              date={date}
              setDate={setDate}
              slots={slots}
              slotsLoading={slotsLoading}
              slotStart={slotStart}
              setSlotStart={setSlotStart}
              currentStart={booking.appointment_start}
              availableAddons={availableAddons}
              selectedAddonIds={selectedAddonIds}
              setSelectedAddonIds={setSelectedAddonIds}
              notes={notes}
              setNotes={setNotes}
              preview={preview}
              previousTotal={booking.total_price_pence}
              depositPaid={booking.deposit_paid_pence}
              offeredAlternatives={offeredAlternatives}
              onPickAlternative={(s) => {
                setDate(londonDate(s));
                setSlotStart(s);
                setOfferedAlternatives(null);
              }}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 border-t border-charcoal/10 bg-ivory/95 px-5 py-4 backdrop-blur">
          {mode === 'view' ? (
            <div className="flex flex-wrap gap-2">
              {isEditable && (
                <button onClick={enterEdit} className={btnGold}>Edit / Reschedule</button>
              )}
              {canTransition && (
                <>
                  <button onClick={() => doStatus('completed')} disabled={!!busy} className={btnSky}>Mark completed</button>
                  <button onClick={() => doStatus('no_show')} disabled={!!busy} className={btnDanger}>No-show</button>
                </>
              )}
              {booking.status === 'confirmed' && (
                <button onClick={doResend} disabled={!!busy} className={btnGhost}>{resent ? 'Sent ✓' : 'Resend confirmation'}</button>
              )}
              {isEditable && (
                <button onClick={doCancel} disabled={!!busy} className={btnDanger}>Cancel booking</button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={!!busy} className={`${btnGold} flex-1`}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setMode('view'); setError(null); setOfferedAlternatives(null); }} className={btnGhost}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewBody({ booking, style }: { booking: BookingRow; style: ReturnType<typeof statusStyle> }) {
  const balance = Math.max(0, booking.total_price_pence - booking.deposit_paid_pence);
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>{style.label}</span>
        {booking.created_by_admin && (
          <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-luxe text-charcoal/50">Manual</span>
        )}
      </div>

      <Row label="When">
        {formatInTimeZone(new Date(booking.appointment_start), STUDIO_TIMEZONE, 'EEEE d MMMM yyyy')}
        <br />
        {formatInTimeZone(new Date(booking.appointment_start), STUDIO_TIMEZONE, 'h:mmaaa')} –{' '}
        {formatInTimeZone(new Date(booking.appointment_end), STUDIO_TIMEZONE, 'h:mmaaa')}
      </Row>
      <Row label="Service">
        {booking.services?.name ?? '—'}
        {booking.hair_included ? ' · hair included' : ''}
      </Row>
      {booking.booking_addons.length > 0 && (
        <Row label="Add-ons">{booking.booking_addons.map((a) => a.name_at_booking).join(', ')}</Row>
      )}
      {booking.booking_bundles.length > 0 && (
        <Row label="Bundles">
          {booking.booking_bundles
            .map((b) => `${b.quantity}× ${b.bundle_variants?.inches ?? '?'}" ${b.bundle_variants?.colour ?? ''}`)
            .join(', ')}
        </Row>
      )}
      <Row label="Contact">
        {booking.customer_email}
        <br />
        {booking.customer_phone}
      </Row>
      {booking.notes && <Row label="Notes">{booking.notes}</Row>}

      <div className="rounded-xl border border-charcoal/10 bg-white p-4">
        <PriceLine label="Total" value={formatPence(booking.total_price_pence)} strong />
        <PriceLine label="Deposit paid" value={`− ${formatPence(booking.deposit_paid_pence)}`} muted />
        <div className="my-2 border-t border-charcoal/10" />
        <PriceLine label="Balance due" value={formatPence(balance)} strong />
      </div>
    </div>
  );
}

function EditBody(props: {
  services: DbService[];
  serviceId: string;
  setServiceId: (v: string) => void;
  hairIncluded: boolean;
  setHairIncluded: (v: boolean) => void;
  selectedService: DbService | null;
  date: string;
  setDate: (v: string) => void;
  slots: TimeSlot[];
  slotsLoading: boolean;
  slotStart: string;
  setSlotStart: (v: string) => void;
  currentStart: string;
  availableAddons: DbServiceAddon[];
  selectedAddonIds: string[];
  setSelectedAddonIds: (fn: (prev: string[]) => string[]) => void;
  notes: string;
  setNotes: (v: string) => void;
  preview: { total: number; depositDue: number; balance: number; diff: number } | null;
  previousTotal: number;
  depositPaid: number;
  offeredAlternatives: TimeSlot[] | null;
  onPickAlternative: (start: string) => void;
}) {
  const p = props;
  const hairAvailable = p.selectedService?.hair_incl_price_pence != null;
  const slotIncludesCurrent = p.slots.some((s) => s.start === p.slotStart);

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Service</label>
        <select className={fieldClass} value={p.serviceId} onChange={(e) => p.setServiceId(e.target.value)}>
          {p.services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <label className={`flex items-center gap-2 text-sm ${hairAvailable ? '' : 'opacity-40'}`}>
        <input type="checkbox" checked={p.hairIncluded} disabled={!hairAvailable} onChange={(e) => p.setHairIncluded(e.target.checked)} />
        Hair included{!hairAvailable && ' (not offered for this service)'}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <input type="date" className={fieldClass} value={p.date} onChange={(e) => p.setDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Time</label>
          <select className={fieldClass} value={p.slotStart} onChange={(e) => p.setSlotStart(e.target.value)} disabled={p.slotsLoading}>
            {!slotIncludesCurrent && (
              <option value={p.currentStart}>
                {formatInTimeZone(new Date(p.currentStart), STUDIO_TIMEZONE, 'h:mmaaa')} (current)
              </option>
            )}
            {p.slots.map((s) => (
              <option key={s.start} value={s.start}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      {p.slotsLoading && <p className="-mt-3 text-xs text-charcoal/40">Checking availability…</p>}
      {!p.slotsLoading && p.slots.length === 0 && (
        <p className="-mt-3 text-xs text-amber-700">No open times that day — pick another date.</p>
      )}

      {p.offeredAlternatives && p.offeredAlternatives.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-800">Suggested times:</p>
          <div className="flex flex-wrap gap-1.5">
            {p.offeredAlternatives.map((s) => (
              <button key={s.start} onClick={() => p.onPickAlternative(s.start)} className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.availableAddons.length > 0 && (
        <div>
          <label className={labelClass}>Add-ons</label>
          <div className="space-y-1.5 rounded-lg border border-charcoal/10 bg-white p-3">
            {p.availableAddons.map((a) => (
              <label key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.selectedAddonIds.includes(a.id)}
                    onChange={(e) =>
                      p.setSelectedAddonIds((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                    }
                  />
                  {a.name}
                </span>
                <span className="text-charcoal/50">{a.price_delta_pence >= 0 ? '+' : ''}{formatPence(a.price_delta_pence)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Notes</label>
        <textarea rows={3} className={fieldClass} value={p.notes} onChange={(e) => p.setNotes(e.target.value)} />
      </div>

      {p.preview && (
        <div className="rounded-xl border border-charcoal/10 bg-white p-4">
          <PriceLine label="Previous total" value={formatPence(p.previousTotal)} muted />
          <PriceLine label="New total" value={formatPence(p.preview.total)} strong />
          {p.preview.diff !== 0 && (
            <PriceLine
              label="Difference"
              value={`${p.preview.diff > 0 ? '+' : ''}${formatPence(p.preview.diff)}`}
              className={p.preview.diff > 0 ? 'text-rose-700' : 'text-emerald-700'}
            />
          )}
          <div className="my-2 border-t border-charcoal/10" />
          <PriceLine label="Deposit paid" value={`− ${formatPence(p.depositPaid)}`} muted />
          <PriceLine label="Balance due" value={formatPence(p.preview.balance)} strong />
          <p className="mt-2 text-[0.68rem] text-charcoal/45">
            Editing never charges or refunds automatically. Settle any balance in the Checkout tab.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.62rem] uppercase tracking-luxe text-charcoal/45">{label}</p>
      <p className="mt-0.5 text-charcoal/80">{children}</p>
    </div>
  );
}

function PriceLine({ label, value, muted, strong, className }: { label: string; value: string; muted?: boolean; strong?: boolean; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5 text-sm">
      <span className={muted ? 'text-charcoal/50' : strong ? 'font-medium text-charcoal' : 'text-charcoal/75'}>{label}</span>
      <span className={`tabular-nums ${className ?? (strong ? 'font-medium text-gold' : muted ? 'text-charcoal/50' : 'text-charcoal/75')}`}>{value}</span>
    </div>
  );
}
