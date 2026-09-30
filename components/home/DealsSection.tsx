'use client';

import { useRef } from 'react';
import Reveal from '@/components/Reveal';
import SectionHeader from '@/components/ui/SectionHeader';
import { ButtonLink } from '@/components/ui/Button';
import { formatPence } from '@/lib/booking/pricing';
import type { DbService } from '@/lib/booking/types';

// Visual clone of components/sections/ServicesCarousel.tsx (round arrow
// buttons, snap-scroll track, w-[85vw]/sm:w-[380px] cards, gold-filled
// solid button) per the rebuild brief — cards here are text-only (no images
// yet) with a dark background and a subtle gold border instead of a photo.
function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

export default function DealsSection({ deals }: { deals: DbService[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (deals.length === 0) return null;

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className="container-luxe py-24 lg:py-32">
      <SectionHeader
        eyebrow="Limited time"
        title="Deals of the Month"
        support="A rotating edit of featured styles at curated monthly rates — reserved for the few who book early."
        link={{ label: 'View all deals', href: '/book' }}
      />

      <div className="mt-14">
        <div className="mb-6 flex justify-end gap-3">
          <button
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/20 transition-colors duration-300 hover:border-gold hover:text-gold dark:border-cream/20"
          >
            <Arrow dir="left" />
          </button>
          <button
            aria-label="Next"
            onClick={() => scrollBy(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/20 transition-colors duration-300 hover:border-gold hover:text-gold dark:border-cream/20"
          >
            <Arrow dir="right" />
          </button>
        </div>

        <div ref={trackRef} className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
          {deals.map((deal, i) => {
            const hairIncluded = deal.hair_incl_price_pence != null;
            const price = hairIncluded ? (deal.hair_incl_price_pence as number) : deal.base_price_pence;
            const depositNote = hairIncluded
              ? `50% deposit — ${formatPence(Math.round(price * 0.5))} due today`
              : '£20 flat deposit due today';

            return (
              <Reveal key={deal.id} delay={i * 0.08} className="w-[85vw] shrink-0 snap-start sm:w-[380px]">
                <div className="flex h-full flex-col rounded-2xl border border-gold/25 bg-charcoal-soft p-6 text-cream shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] transition-all duration-500 ease-luxe hover:-translate-y-1 hover:border-gold/50">
                  <span className="inline-block w-fit rounded-full border border-gold/40 px-3 py-1 text-[0.6rem] font-medium uppercase tracking-luxe text-gold">
                    {hairIncluded ? 'Hair Included' : 'No Hair Included'}
                  </span>

                  <h3 className="mt-4 font-serif text-xl font-light tracking-tight">{deal.name}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-cream/65">{deal.description}</p>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-[0.65rem] uppercase tracking-luxe text-cream/50">From</span>
                    <span className="font-serif text-2xl font-light text-gold">{formatPence(price)}</span>
                  </div>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.15em] text-cream/45">{depositNote}</p>

                  {deal.note && (
                    <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold">
                      ✦ {deal.note}
                    </p>
                  )}

                  <ButtonLink href={`/book?service=${deal.slug}`} variant="solid" size="sm" className="mt-6 w-full">
                    Book Now
                  </ButtonLink>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
