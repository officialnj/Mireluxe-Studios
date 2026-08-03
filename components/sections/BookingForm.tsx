'use client';

import { useState } from 'react';
import { SERVICES } from '@/lib/site';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/Button';

const field =
  'w-full rounded-xl border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40 dark:[color-scheme:dark]';
const label = 'mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60';

export default function BookingForm() {
  const [selected, setSelected] = useState<string>('Goddess Knotless Braids');
  const [bundle, setBundle] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeService = SERVICES.find((s) => s.name === selected);

  return (
    <div className="container-luxe grid grid-cols-1 gap-14 pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:pb-32">
      {/* Service selection */}
      <div>
        <Reveal>
          <h2 className="font-serif text-2xl font-light tracking-tight">
            1 · Choose your style
          </h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {SERVICES.map((service, i) => {
            const active = selected === service.name;
            return (
              <Reveal key={service.name} delay={Math.min(i * 0.04, 0.3)}>
                <button
                  onClick={() => setSelected(service.name)}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-6 py-5 text-left transition-all duration-400 ease-luxe ${
                    active
                      ? 'border-gold bg-gold/10'
                      : 'border-charcoal/12 hover:border-gold/50 dark:border-cream/12'
                  }`}
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        active ? 'border-gold bg-gold' : 'border-charcoal/30 dark:border-cream/30'
                      }`}
                    >
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-charcoal" />
                      )}
                    </span>
                    <span>
                      <span className="block font-serif text-lg font-light tracking-tight">
                        {service.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-charcoal/55 dark:text-cream/55">
                        {service.category}
                        {service.hairIncluded ? ' · Hair included' : ''}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-serif text-lg font-light text-gold">
                    {service.price}
                  </span>
                </button>
              </Reveal>
            );
          })}
        </div>

        {/* Bundle add-on toggle */}
        <Reveal>
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-charcoal/12 px-6 py-5 dark:border-cream/12">
            <div>
              <p className="font-serif text-lg font-light tracking-tight">
                Add a hair bundle
              </p>
              <p className="mt-0.5 text-xs text-charcoal/55 dark:text-cream/55">
                Premium braiding hair delivered ready for your appointment (+£28).
              </p>
            </div>
            <button
              role="switch"
              aria-checked={bundle}
              onClick={() => setBundle((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-400 ${
                bundle ? 'bg-gold' : 'bg-charcoal/20 dark:bg-cream/20'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-cream shadow transition-all duration-400 ease-luxe ${
                  bundle ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </Reveal>
      </div>

      {/* Booking form */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-charcoal/10 bg-cream-soft/60 p-8 dark:border-cream/10 dark:bg-charcoal-soft/60">
            <h2 className="font-serif text-2xl font-light tracking-tight">
              2 · Your details
            </h2>
            <div className="mt-4 rounded-xl bg-gold/10 px-4 py-3 text-sm text-charcoal/70 dark:text-cream/70">
              <span className="text-charcoal/50 dark:text-cream/50">Selected: </span>
              <span className="font-medium text-gold">{activeService?.name}</span>
              {' · '}
              {activeService?.price}
              {bundle && ' · + Bundle'}
            </div>

            {submitted ? (
              <div className="mt-8 rounded-xl border border-gold/40 bg-gold/5 p-6 text-center">
                <p className="font-serif text-xl font-light">Request received ✦</p>
                <p className="mt-2 text-sm text-charcoal/65 dark:text-cream/65">
                  Thank you. We’ll confirm your appointment and deposit details by
                  email shortly.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="mt-6 space-y-5"
              >
                <div>
                  <label className={label} htmlFor="name">Full name</label>
                  <input id="name" required className={field} placeholder="Your name" />
                </div>
                <div>
                  <label className={label} htmlFor="email">Email</label>
                  <input id="email" type="email" required className={field} placeholder="you@email.com" />
                </div>
                <div>
                  <label className={label} htmlFor="phone">Phone</label>
                  <input id="phone" type="tel" required className={field} placeholder="+44 …" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label} htmlFor="date">Date</label>
                    <input id="date" type="date" required className={field} />
                  </div>
                  <div>
                    <label className={label} htmlFor="time">Time</label>
                    <input id="time" type="time" required className={field} />
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="notes">Notes</label>
                  <textarea id="notes" rows={3} className={field} placeholder="Length, colour, inspiration…" />
                </div>
                <Button type="submit" size="md" className="w-full">
                  Request Appointment
                </Button>
                <p className="text-center text-[0.68rem] text-charcoal/45 dark:text-cream/45">
                  New slots release on the 20th of each month.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
