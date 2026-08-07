'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/booking/DatePicker';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import OrderSummary from '@/components/booking/OrderSummary';
import PaymentStep from '@/components/booking/PaymentStep';
import BundleUpsell, { type BundleLine } from '@/components/booking/BundleUpsell';
import { computeTotals, formatPence } from '@/lib/booking/pricing';
import type { DbBundleVariant, DbService, DbServiceCategory, TimeSlot } from '@/lib/booking/types';

const field =
  'w-full rounded-xl border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40 dark:[color-scheme:dark]';
const label = 'mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60';

type Step = 'service' | 'bundles' | 'datetime' | 'details' | 'payment' | 'success';

type BookingResult = {
  bookingId: string;
  bookingRef: string;
  clientSecret: string;
};

type Props = {
  categories: DbServiceCategory[];
  services: DbService[];
  bundleVariants: DbBundleVariant[];
};

function formatDuration(mins: number): string {
  const hours = mins / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr${hours === 1 ? '' : 's'}`;
}

const PREP_NOTICE =
  'Please arrive with natural hair freshly washed and blow-dried, free of any oils or conditioners.';

export default function BookingForm({ categories, services, bundleVariants }: Props) {
  const categoriesWithServices = categories.filter((c) => services.some((s) => s.category_id === c.id));

  const [step, setStep] = useState<Step>('service');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categoriesWithServices[0]?.id ?? null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [hairIncluded, setHairIncluded] = useState(false);
  const [bundleLines, setBundleLines] = useState<BundleLine[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const activeService = services.find((s) => s.id === serviceId) ?? null;
  const visibleServices = services.filter((s) => s.category_id === activeCategoryId);

  const resolvedBundleLines = useMemo(
    () =>
      bundleLines
        .map((line) => {
          const variant = bundleVariants.find((v) => v.id === line.variantId);
          return variant ? { variant, quantity: line.quantity } : null;
        })
        .filter((l): l is { variant: DbBundleVariant; quantity: number } => l !== null),
    [bundleLines, bundleVariants]
  );

  const totals = useMemo(() => {
    if (!activeService) return null;
    return computeTotals(activeService, hairIncluded, resolvedBundleLines);
  }, [activeService, hairIncluded, resolvedBundleLines]);

  const summaryBundleLines = resolvedBundleLines.map((l) => ({
    inches: l.variant.inches,
    colour: l.variant.colour,
    quantity: l.quantity,
    pricePence: l.variant.price_pence,
  }));

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  function selectService(service: DbService, chooseHairIncluded: boolean) {
    setServiceId(service.id);
    setHairIncluded(chooseHairIncluded);
    setBundleLines([]);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setErrorMessage(null);
    setBookingResult(null);
  }

  async function handleSubmitDetails() {
    if (!activeService || !selectedSlot || !dateStr) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: activeService.id,
          hairIncluded,
          bundleLines: bundleLines.map((l) => ({ bundleVariantId: l.variantId, quantity: l.quantity })),
          date: dateStr,
          slotStart: selectedSlot.start,
          customerName,
          customerEmail,
          customerPhone,
          notes: notes || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'slot_taken' || data.error === 'slot_unavailable') {
          setErrorMessage('This slot was just taken — please choose another time.');
          setSelectedSlot(null);
          setStep('datetime');
        } else {
          setErrorMessage('Something went wrong creating your booking. Please try again.');
        }
        return;
      }

      setBookingResult({ bookingId: data.bookingId, bookingRef: data.bookingRef, clientSecret: data.clientSecret });
      setStep('payment');
    } catch {
      setErrorMessage('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (services.length === 0) {
    return (
      <div className="container-luxe pb-24 text-center text-sm text-charcoal/60 dark:text-cream/60">
        Booking is temporarily unavailable — please contact the studio directly.
      </div>
    );
  }

  if (step === 'success' && bookingResult) {
    return (
      <div className="container-luxe max-w-lg pb-24 text-center lg:pb-32">
        <Reveal>
          <div className="rounded-3xl border border-gold/40 bg-gold/5 p-10">
            <p className="font-serif text-2xl font-light">Booking confirmed ✦</p>
            <p className="mt-2 text-sm text-charcoal/65 dark:text-cream/65">
              Reference <span className="font-medium text-gold">{bookingResult.bookingRef}</span>
            </p>
            {selectedDate && selectedSlot && (
              <p className="mt-1 text-sm text-charcoal/65 dark:text-cream/65">
                {format(selectedDate, 'EEEE d MMMM yyyy')} · {selectedSlot.label}
              </p>
            )}
            <p className="mt-3 text-xs text-charcoal/50 dark:text-cream/50">
              A confirmation email is on its way to {customerEmail}.
            </p>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="container-luxe max-w-3xl pb-24 lg:pb-32">
      {errorMessage && (
        <p className="mb-6 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {step === 'service' && (
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">1 · Choose your style</h2>
          <p className="mt-2 text-xs text-charcoal/50 dark:text-cream/50">{PREP_NOTICE}</p>

          <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
            {categoriesWithServices.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs uppercase tracking-luxe transition-colors duration-300 ${
                  activeCategoryId === cat.id
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-charcoal/15 text-charcoal/60 hover:border-gold/50 dark:border-cream/15 dark:text-cream/60'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {visibleServices.map((service) => {
              const active = serviceId === service.id;
              return (
                <div
                  key={service.id}
                  className={`rounded-2xl border p-6 transition-colors duration-300 ${
                    active ? 'border-gold bg-gold/10' : 'border-charcoal/12 dark:border-cream/12'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg font-light tracking-tight">{service.name}</span>
                    {service.morning_only && (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] uppercase tracking-luxe text-gold">
                        Morning appointments only
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-charcoal/55 dark:text-cream/55">{service.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal/50 dark:text-cream/50">
                    {service.service_time_mins != null && <span>Service time: {formatDuration(service.service_time_mins)}</span>}
                    {service.style_duration_weeks && <span>Lasts: {service.style_duration_weeks}</span>}
                    {service.xpression_packs && <span>Xpression: {service.xpression_packs} packs</span>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => selectService(service, false)}
                      className={`rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
                        active && !hairIncluded
                          ? 'border-gold bg-gold text-charcoal'
                          : 'border-charcoal/20 hover:border-gold/50 dark:border-cream/20'
                      }`}
                    >
                      Without hair — {formatPence(service.base_price_pence)}
                    </button>
                    {service.hair_incl_price_pence != null && (
                      <button
                        type="button"
                        onClick={() => selectService(service, true)}
                        className={`rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
                          active && hairIncluded
                            ? 'border-gold bg-gold text-charcoal'
                            : 'border-charcoal/20 hover:border-gold/50 dark:border-cream/20'
                        }`}
                      >
                        With hair — {formatPence(service.hair_incl_price_pence)}
                        {service.included_bundle_count > 0 && ` (incl. ${service.included_bundle_count}× ${service.included_bundle_inches}" bundles)`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" size="md" className="mt-8 w-full" disabled={!serviceId} onClick={() => setStep('bundles')}>
            Continue
          </Button>
        </Reveal>
      )}

      {step === 'bundles' && activeService && (
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">2 · Add bundles</h2>
          {hairIncluded && activeService.included_bundle_count > 0 ? (
            <p className="mt-2 text-sm text-charcoal/65 dark:text-cream/65">
              Your package already includes {activeService.included_bundle_count}× {activeService.included_bundle_inches}&quot;
              bundles. Add extra bundles or a different length/colour below — entirely optional.
            </p>
          ) : (
            <p className="mt-2 text-sm text-charcoal/65 dark:text-cream/65">
              Add curl-texture bulk braiding hair to your appointment — choose length, colour and quantity below.
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-charcoal/12 p-6 dark:border-cream/12">
            <BundleUpsell variants={bundleVariants} lines={bundleLines} onChange={setBundleLines} />
          </div>

          <div className="mt-8 flex gap-3">
            <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setStep('service')}>
              Back
            </Button>
            <Button type="button" size="md" className="flex-1" onClick={() => setStep('datetime')}>
              {bundleLines.length > 0 ? 'Continue' : 'Continue without bundles'}
            </Button>
          </div>
        </Reveal>
      )}

      {step === 'datetime' && activeService && (
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">3 · Choose date &amp; time</h2>
          {activeService.morning_only && (
            <p className="mt-2 text-xs text-charcoal/50 dark:text-cream/50">
              This style requires a full morning in the chair, so only start times before 12:00pm are offered.
            </p>
          )}
          <div className="mt-6">
            <DatePicker
              serviceId={activeService.id}
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
            />
          </div>
          {dateStr && (
            <div className="mt-6">
              <p className={label}>Available times</p>
              <TimeSlotPicker serviceId={activeService.id} date={dateStr} selected={selectedSlot} onSelect={setSelectedSlot} />
            </div>
          )}
          <div className="mt-8 flex gap-3">
            <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setStep('bundles')}>
              Back
            </Button>
            <Button type="button" size="md" className="flex-1" disabled={!selectedSlot} onClick={() => setStep('details')}>
              Continue
            </Button>
          </div>
        </Reveal>
      )}

      {step === 'details' && activeService && totals && (
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">4 · Your details</h2>
          <div className="mt-6">
            <OrderSummary
              serviceName={activeService.name}
              hairIncluded={hairIncluded}
              bundleLines={summaryBundleLines}
              totals={totals}
            />
          </div>
          <p className="mt-4 text-xs text-charcoal/50 dark:text-cream/50">{PREP_NOTICE}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitDetails();
            }}
            className="mt-6 space-y-5"
          >
            <div>
              <label className={label} htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                required
                className={field}
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className={field}
                placeholder="you@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                required
                className={field}
                placeholder="+44 …"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                className={field}
                placeholder="Length, colour, inspiration…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setStep('datetime')}>
                Back
              </Button>
              <Button type="submit" size="md" className="flex-1" disabled={submitting}>
                {submitting ? 'Please wait…' : 'Continue to payment'}
              </Button>
            </div>
          </form>
        </Reveal>
      )}

      {step === 'payment' && bookingResult && (
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">5 · Payment</h2>
          <p className="mt-2 text-xs text-charcoal/50 dark:text-cream/50">
            Card details are handled securely by Stripe — MIRILUXE never sees your card number.
          </p>
          <div className="mt-6">
            <PaymentStep
              clientSecret={bookingResult.clientSecret}
              onSuccess={() => setStep('success')}
              onError={(message) => setErrorMessage(message)}
            />
          </div>
        </Reveal>
      )}

      <p className="mt-10 text-center text-[0.68rem] text-charcoal/45 dark:text-cream/45">
        New slots release on the 20th of each month.
      </p>
    </div>
  );
}
