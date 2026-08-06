'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/booking/DatePicker';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import OrderSummary from '@/components/booking/OrderSummary';
import PaymentStep from '@/components/booking/PaymentStep';
import { computeTotals, formatPence } from '@/lib/booking/pricing';
import type { DbBundle, DbService, TimeSlot } from '@/lib/booking/types';

const field =
  'w-full rounded-xl border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40 dark:[color-scheme:dark]';
const label = 'mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60';

type Step = 'select' | 'details' | 'payment' | 'success';

type BookingResult = {
  bookingId: string;
  bookingRef: string;
  clientSecret: string;
};

type Props = {
  services: DbService[];
  bundles: DbBundle[];
};

export default function BookingForm({ services, bundles }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [bundleSelected, setBundleSelected] = useState(false);
  const [step, setStep] = useState<Step>('select');
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
  const activeBundle = bundles[0] ?? null; // single hair-bundle add-on, matches existing site copy
  const totals = useMemo(() => {
    if (!activeService) return null;
    return computeTotals(activeService, bundleSelected ? activeBundle : null);
  }, [activeService, activeBundle, bundleSelected]);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  function resetForNewService(nextId: string) {
    setServiceId(nextId);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setErrorMessage(null);
    setBookingResult(null);
    setStep('select');
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
          bundleId: bundleSelected ? activeBundle?.id ?? null : null,
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
          setStep('select');
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

  return (
    <div className="container-luxe grid grid-cols-1 gap-14 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:pb-32">
      {/* Service selection */}
      <div>
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">1 · Choose your style</h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {services.map((service, i) => {
            const active = serviceId === service.id;
            return (
              <Reveal key={service.id} delay={Math.min(i * 0.04, 0.3)}>
                <button
                  onClick={() => resetForNewService(service.id)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-6 py-5 text-left transition-all duration-400 ease-luxe ${
                    active ? 'border-gold bg-gold/10' : 'border-charcoal/12 hover:border-gold/50 dark:border-cream/12'
                  }`}
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        active ? 'border-gold bg-gold' : 'border-charcoal/30 dark:border-cream/30'
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-charcoal" />}
                    </span>
                    <span>
                      <span className="block font-serif text-lg font-light tracking-tight">{service.name}</span>
                      <span className="mt-0.5 block text-xs text-charcoal/55 dark:text-cream/55">
                        {service.category}
                        {service.hair_included ? ' · Hair included' : ''}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-serif text-lg font-light text-gold">
                    from {formatPence(service.price_from_pence)}
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>

        {activeBundle && (
          <Reveal>
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-charcoal/12 px-6 py-5 dark:border-cream/12">
              <div>
                <p className="font-serif text-lg font-light tracking-tight">Add a hair bundle</p>
                <p className="mt-0.5 text-xs text-charcoal/55 dark:text-cream/55">
                  {activeBundle.description ?? 'Premium braiding hair delivered ready for your appointment.'} (+
                  {formatPence(activeBundle.price_pence)})
                </p>
              </div>
              <button
                role="switch"
                aria-checked={bundleSelected}
                onClick={() => setBundleSelected((v) => !v)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-400 ${
                  bundleSelected ? 'bg-gold' : 'bg-charcoal/20 dark:bg-cream/20'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-cream shadow transition-all duration-400 ease-luxe ${
                    bundleSelected ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </Reveal>
        )}
      </div>

      {/* Booking wizard */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-charcoal/10 bg-cream-soft/60 p-8 dark:border-cream/10 dark:bg-charcoal-soft/60">
            {step === 'success' && bookingResult ? (
              <div className="rounded-xl border border-gold/40 bg-gold/5 p-6 text-center">
                <p className="font-serif text-xl font-light">Booking confirmed ✦</p>
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
            ) : (
              <>
                {activeService && totals && (
                  <div className="mb-6">
                    <OrderSummary serviceName={activeService.name} bundleSelected={bundleSelected} totals={totals} />
                  </div>
                )}

                {errorMessage && (
                  <p className="mb-4 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {errorMessage}
                  </p>
                )}

                {step === 'select' && (
                  <>
                    <h2 className="font-serif text-2xl font-light tracking-tight">2 · Choose date &amp; time</h2>
                    <div className="mt-6">
                      <DatePicker
                        serviceId={serviceId}
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
                        <TimeSlotPicker
                          serviceId={serviceId}
                          date={dateStr}
                          selected={selectedSlot}
                          onSelect={setSelectedSlot}
                        />
                      </div>
                    )}
                    <Button
                      type="button"
                      size="md"
                      className="mt-8 w-full"
                      disabled={!selectedSlot}
                      onClick={() => setStep('details')}
                    >
                      Continue
                    </Button>
                  </>
                )}

                {step === 'details' && (
                  <>
                    <h2 className="font-serif text-2xl font-light tracking-tight">3 · Your details</h2>
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
                        <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setStep('select')}>
                          Back
                        </Button>
                        <Button type="submit" size="md" className="flex-1" disabled={submitting}>
                          {submitting ? 'Please wait…' : 'Continue to payment'}
                        </Button>
                      </div>
                    </form>
                  </>
                )}

                {step === 'payment' && bookingResult && (
                  <>
                    <h2 className="font-serif text-2xl font-light tracking-tight">4 · Payment</h2>
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
                  </>
                )}

                <p className="mt-6 text-center text-[0.68rem] text-charcoal/45 dark:text-cream/45">
                  New slots release on the 20th of each month.
                </p>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
