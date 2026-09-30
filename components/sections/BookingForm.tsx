'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/Button';
import DatePicker from '@/components/booking/DatePicker';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import OrderSummary from '@/components/booking/OrderSummary';
import PaymentStep from '@/components/booking/PaymentStep';
import { type BundleLine } from '@/components/booking/BundleUpsell';
import BundleCatalog from '@/components/booking/BundleCatalog';
import { computeTotals, formatPence } from '@/lib/booking/pricing';
import { useCart } from '@/components/CartProvider';
import type { DbBundle, DbBundleVariant, DbService, DbServiceCategory, TimeSlot } from '@/lib/booking/types';

// Two synthetic tabs come before every real category: "Trending Deals" is
// always first and selected by default, then "All Styles". These string ids
// can never collide with a real category's uuid `id`.
const TRENDING_TAB_ID = 'trending-deals' as const;
const ALL_STYLES_TAB_ID = 'all-styles' as const;
type TabId = typeof TRENDING_TAB_ID | typeof ALL_STYLES_TAB_ID | string;

// Real category names in the DB (see supabase/migrations/0002/0003) don't
// exactly match Acuity's category names (e.g. "Knotless Braids" /
// "Fulani Braids" / "Lemonade Braids" vs Acuity's single "Braids"), so this
// is a best-effort keyword match against Acuity's stated order — Braids,
// FeedIns, Hair Included Styles, Miracle Knots, Ponytails, Sew-Ins,
// Touch-Ups, Twists — rather than an exact slug list. Categories matching no
// keyword (or with no active services) fall through to the end, ordered by
// their own sort_order.
const CATEGORY_ORDER_KEYWORDS = [
  'braid',
  'feed-in',
  'hair-included',
  'miracle-knot',
  'ponytail',
  'sew-in',
  'touch-up',
  'twist',
];

function categoryRank(cat: DbServiceCategory): number {
  const haystack = `${cat.slug} ${cat.name}`.toLowerCase();
  const idx = CATEGORY_ORDER_KEYWORDS.findIndex((kw) => haystack.includes(kw));
  return idx === -1 ? CATEGORY_ORDER_KEYWORDS.length : idx;
}

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
  bundles: DbBundle[];
  bundleVariants: DbBundleVariant[];
  initialServiceSlug?: string;
};

function formatDuration(mins: number): string {
  const hours = mins / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr${hours === 1 ? '' : 's'}`;
}

const PREP_NOTICE =
  'Please arrive with natural hair freshly washed and blow-dried, free of any oils or conditioners.';

export default function BookingForm({ categories, services, bundles, bundleVariants, initialServiceSlug }: Props) {
  const cart = useCart();
  const categoriesWithServices = categories.filter((c) => services.some((s) => s.category_id === c.id));

  const trendingCategory = categories.find((c) => c.slug === 'trending-deals') ?? null;
  const trendingHasServices = !!trendingCategory && services.some((s) => s.category_id === trendingCategory.id);

  const orderedCategories = categoriesWithServices
    .filter((c) => c.id !== trendingCategory?.id)
    .sort((a, b) => {
      const ra = categoryRank(a);
      const rb = categoryRank(b);
      return ra !== rb ? ra - rb : a.sort_order - b.sort_order;
    });

  const tabs: { id: TabId; label: string }[] = [
    ...(trendingHasServices ? [{ id: TRENDING_TAB_ID, label: 'Trending Deals' }] : []),
    { id: ALL_STYLES_TAB_ID, label: 'All Styles' },
    ...orderedCategories.map((c) => ({ id: c.id, label: c.name })),
  ];

  const matchedService = initialServiceSlug
    ? services.find((s) => s.slug === initialServiceSlug) ?? null
    : null;

  const [step, setStep] = useState<Step>(matchedService ? 'bundles' : 'service');
  const [activeCategoryId, setActiveCategoryId] = useState<TabId>(
    matchedService?.category_id ?? (trendingHasServices ? TRENDING_TAB_ID : ALL_STYLES_TAB_ID)
  );
  const [serviceId, setServiceId] = useState<string | null>(matchedService?.id ?? null);
  const [hairIncluded, setHairIncluded] = useState(
    matchedService ? matchedService.hair_incl_price_pence != null : false
  );
  const bundleLines = cart.bundleLines;
  function setBundleLines(lines: BundleLine[]) {
    cart.setBundleLines(
      lines.map((l) => ({
        ...l,
        pricePence: bundleVariants.find((v) => v.id === l.variantId)?.price_pence ?? 0,
      }))
    );
  }

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [hairPrepAgreed, setHairPrepAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const activeService = services.find((s) => s.id === serviceId) ?? null;
  const visibleServices =
    activeCategoryId === ALL_STYLES_TAB_ID
      ? services
      : activeCategoryId === TRENDING_TAB_ID
        ? trendingCategory
          ? services.filter((s) => s.category_id === trendingCategory.id)
          : []
        : services.filter((s) => s.category_id === activeCategoryId);

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
    variantId: l.variant.id,
    bundleName: bundles.find((b) => b.id === l.variant.bundle_id)?.name ?? null,
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
    if (!activeService || !selectedSlot || !dateStr || !hairPrepAgreed) return;
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
          hairPrepAgreed,
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
            <Link
              href={`/book/manage/${bookingResult.bookingId}`}
              className="mt-6 inline-block text-xs uppercase tracking-luxe text-gold underline underline-offset-4"
            >
              Manage or reschedule this booking
            </Link>
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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryId(tab.id)}
                className={`flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 py-2 text-xs uppercase tracking-luxe transition-colors duration-300 ${
                  activeCategoryId === tab.id
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-charcoal/15 text-charcoal/60 hover:border-gold/50 dark:border-cream/15 dark:text-cream/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleServices.length === 0 && (
            <p className="mt-6 text-sm text-charcoal/50 dark:text-cream/50">No styles in this category yet.</p>
          )}

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
                  {service.note && (
                    <p className="mt-1 text-xs text-gold">{service.note}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal/50 dark:text-cream/50">
                    {service.service_time_mins != null && <span>Service time: {formatDuration(service.service_time_mins)}</span>}
                    {service.style_duration_weeks && <span>Lasts: {service.style_duration_weeks}</span>}
                    {service.xpression_packs && <span>Xpression: {service.xpression_packs} packs</span>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {service.hair_incl_price_pence != null && service.hair_incl_price_pence === service.base_price_pence ? (
                      // All-inclusive service (e.g. some Trending Deals) — hair is
                      // always included, there's no genuine without-hair tier, so a
                      // single button avoids showing two identical-priced options.
                      <button
                        type="button"
                        onClick={() => selectService(service, true)}
                        className={`flex min-h-[44px] items-center rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
                          active
                            ? 'border-gold bg-gold text-charcoal'
                            : 'border-charcoal/20 hover:border-gold/50 dark:border-cream/20'
                        }`}
                      >
                        Book — {formatPence(service.hair_incl_price_pence)} (hair included)
                        {service.included_bundle_count > 0 && ` (incl. ${service.included_bundle_count}× ${service.included_bundle_inches}" bundles)`}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectService(service, false)}
                          className={`flex min-h-[44px] items-center rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
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
                            className={`flex min-h-[44px] items-center rounded-xl border px-4 py-2.5 text-sm transition-colors duration-300 ${
                              active && hairIncluded
                                ? 'border-gold bg-gold text-charcoal'
                                : 'border-charcoal/20 hover:border-gold/50 dark:border-cream/20'
                            }`}
                          >
                            With hair — {formatPence(service.hair_incl_price_pence)}
                            {service.included_bundle_count > 0 && ` (incl. ${service.included_bundle_count}× ${service.included_bundle_inches}" bundles)`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activeService && totals && (
            <div className="mt-6">
              <OrderSummary
                serviceName={activeService.name}
                hairIncluded={hairIncluded}
                bundleLines={summaryBundleLines}
                totals={totals}
              />
            </div>
          )}

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
              Add braiding hair bundles to your appointment — choose a style, length, and colour below.
            </p>
          )}

          <div className="mt-6">
            <BundleCatalog bundles={bundles} variants={bundleVariants} lines={bundleLines} onChange={setBundleLines} />
          </div>

          {totals && (
            <div className="mt-6">
              <OrderSummary
                serviceName={activeService.name}
                hairIncluded={hairIncluded}
                bundleLines={summaryBundleLines}
                totals={totals}
              />
            </div>
          )}

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
          {totals && (
            <div className="mt-6">
              <OrderSummary
                serviceName={activeService.name}
                hairIncluded={hairIncluded}
                bundleLines={summaryBundleLines}
                totals={totals}
              />
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
            <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-charcoal/75 dark:text-cream/75">
              <input
                type="checkbox"
                required
                checked={hairPrepAgreed}
                onChange={(e) => setHairPrepAgreed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-charcoal/30 text-gold focus:ring-gold dark:border-cream/30"
              />
              <span>
                I confirm my natural hair will be freshly washed and blow-dried, free of any oils or conditioners,
                before my appointment.
              </span>
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => setStep('datetime')}>
                Back
              </Button>
              <Button type="submit" size="md" className="flex-1" disabled={submitting || !hairPrepAgreed}>
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
        New dates for next month open on the 20th of this month.
      </p>
    </div>
  );
}
