'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { computeTotals, formatPence } from '@/lib/booking/pricing';
import type { DbService, TimeSlot } from '@/lib/booking/types';

const field =
  'w-full rounded-lg border border-cream/20 bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-cream/40 focus:border-gold';
const label = 'mb-1.5 block text-[0.65rem] font-medium uppercase tracking-wide text-cream/50';

type FormState = {
  serviceId: string;
  hairIncluded: boolean;
  date: string; // YYYY-MM-DD
  slot: TimeSlot | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  hairPrepAgreed: boolean;
  paymentMethod: 'cash' | 'other';
  depositPaidPence: string; // kept as string while editing, parsed on submit
};

const initialForm: FormState = {
  serviceId: '',
  hairIncluded: false,
  date: format(new Date(), 'yyyy-MM-dd'),
  slot: null,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  notes: '',
  hairPrepAgreed: true,
  paymentMethod: 'cash',
  depositPaidPence: '',
};

/**
 * "Create Booking" trigger + modal for manually adding a walk-in/phone
 * booking from the admin dashboard. Self-contained (owns its own open/close
 * state) so it can be dropped once into the bookings page above the
 * list/calendar tab switcher and reach both views, rather than needing to be
 * wired into BookingsViewTabs (out of scope for this change).
 *
 * Slot picking calls the admin-only GET /api/admin/bookings/slots, which
 * mirrors the customer-facing availability logic minus the 2-hour
 * minimum-notice and month-release-window rules — see
 * app/api/admin/bookings/_lib/adminAvailability.ts for the full rationale.
 * Every other real constraint (studio hours, blocked dates, slot overrides,
 * existing-booking overlap) still applies, and the DB's
 * no_overlapping_bookings exclusion constraint is the final backstop on
 * submit regardless.
 */
export default function CreateBookingModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<DbService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServicesLoading(true);
    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => setServices((data.services ?? []).filter((s: DbService) => s.service_time_mins != null)))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [open]);

  const service = useMemo(() => services.find((s) => s.id === form.serviceId) ?? null, [services, form.serviceId]);

  useEffect(() => {
    if (!open || !form.serviceId || !form.date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/admin/bookings/slots?serviceId=${form.serviceId}&date=${form.date}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.serviceId, form.date]);

  const totals = useMemo(() => {
    if (!service) return null;
    if (form.hairIncluded && service.hair_incl_price_pence == null) return null;
    return computeTotals(service, form.hairIncluded, []);
  }, [service, form.hairIncluded]);

  // Default the editable deposit-collected field to the computed deposit
  // whenever it changes (service/hair-included changes), but only while the
  // admin hasn't typed a custom value yet in this session — avoids clobbering
  // a manual entry every time an unrelated field updates.
  const [depositTouched, setDepositTouched] = useState(false);
  useEffect(() => {
    if (!depositTouched && totals) {
      setForm((f) => ({ ...f, depositPaidPence: String(totals.depositDuePence / 100) }));
    }
  }, [totals, depositTouched]);

  function reset() {
    setForm(initialForm);
    setSlots([]);
    setError(null);
    setDepositTouched(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slot || !service) return;
    setSubmitting(true);
    setError(null);

    const depositPaidPence = Math.round(parseFloat(form.depositPaidPence || '0') * 100);

    const res = await fetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: form.serviceId,
        hairIncluded: form.hairIncluded,
        date: form.date,
        slotStart: form.slot.start,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone,
        notes: form.notes.trim() || null,
        hairPrepAgreed: form.hairPrepAgreed,
        paymentMethod: form.paymentMethod,
        depositPaidPence: Number.isFinite(depositPaidPence) ? depositPaidPence : 0,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error === 'slot_taken'
          ? 'That time was just taken by another booking — pick a different slot.'
          : data.error === 'slot_unavailable'
            ? 'That slot is no longer available — pick another.'
            : 'Failed to create booking.'
      );
      return;
    }

    close();
    router.refresh();
    // BookingsCalendar fetches its own data client-side and won't otherwise
    // notice a router.refresh() (that only re-runs the server-rendered
    // list view) — this lets it opt in to refetching without this component
    // needing to know about it directly.
    window.dispatchEvent(new CustomEvent('admin-bookings-changed'));
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-gold px-4 py-2 text-xs font-medium uppercase tracking-wide text-charcoal hover:opacity-90"
      >
        + Create Booking
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cream/10 bg-charcoal p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-light">Create Booking</h2>
          <button onClick={close} className="text-cream/50 hover:text-cream" aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={label}>Service</label>
            <select
              required
              className={field}
              value={form.serviceId}
              onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value, slot: null }))}
              disabled={servicesLoading}
            >
              <option value="">{servicesLoading ? 'Loading services…' : 'Select a service'}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {service && (
            <div className="flex items-center gap-2">
              <input
                id="hairIncluded"
                type="checkbox"
                checked={form.hairIncluded}
                disabled={service.hair_incl_price_pence == null}
                onChange={(e) => setForm((f) => ({ ...f, hairIncluded: e.target.checked }))}
              />
              <label htmlFor="hairIncluded" className="text-sm text-cream/80">
                Hair included{service.hair_incl_price_pence == null ? ' (not offered for this service)' : ''}
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Date</label>
              <input
                type="date"
                required
                className={field}
                value={form.date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, slot: null }))}
              />
            </div>
            <div>
              <label className={label}>Time</label>
              {slotsLoading ? (
                <p className="pt-2 text-xs text-cream/40">Loading…</p>
              ) : slots.length === 0 ? (
                <p className="pt-2 text-xs text-cream/40">{form.serviceId ? 'No slots available.' : 'Pick a service first.'}</p>
              ) : (
                <select
                  required
                  className={field}
                  value={form.slot?.start ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, slot: slots.find((s) => s.start === e.target.value) ?? null }))}
                >
                  <option value="">Select a time</option>
                  {slots.map((s) => (
                    <option key={s.start} value={s.start}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={label}>Client name</label>
            <input
              required
              className={field}
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Email</label>
              <input
                type="email"
                required
                className={field}
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input
                required
                className={field}
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className={label}>Notes</label>
            <textarea
              className={field}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="hairPrepAgreed"
              type="checkbox"
              checked={form.hairPrepAgreed}
              onChange={(e) => setForm((f) => ({ ...f, hairPrepAgreed: e.target.checked }))}
            />
            <label htmlFor="hairPrepAgreed" className="text-sm text-cream/80">
              Hair-prep agreement confirmed verbally
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Payment method</label>
              <select
                className={field}
                value={form.paymentMethod}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as 'cash' | 'other' }))}
              >
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={label}>Deposit collected (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={field}
                value={form.depositPaidPence}
                onChange={(e) => {
                  setDepositTouched(true);
                  setForm((f) => ({ ...f, depositPaidPence: e.target.value }));
                }}
              />
            </div>
          </div>

          {totals && (
            <p className="text-xs text-cream/50">
              Total: {formatPence(totals.totalPricePence)} · Computed deposit: {formatPence(totals.depositDuePence)} · Balance due
              at appointment: {formatPence(totals.balanceAtAppointmentPence)}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="text-sm text-cream/60 hover:text-cream">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.slot || !totals}
              className="rounded-full bg-gold px-5 py-2 text-xs font-medium uppercase tracking-wide text-charcoal hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
