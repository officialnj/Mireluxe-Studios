'use client';

import { useRef } from 'react';
import { HAIR_INCLUDED } from '@/lib/site';
import SectionHeader from '@/components/ui/SectionHeader';
import { Card, CardImage, Tag } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { IMG } from '@/lib/site';

const IMAGES = [
  `${IMG}/hero-slide-2.jpg`,
  `${IMG}/hero-slide-3.jpg`,
  `${IMG}/hero-slide-1.jpg`,
];

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

export default function ServicesCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className="bg-cream-soft py-24 dark:bg-charcoal-soft lg:py-32">
      <div className="container-luxe">
        <div className="flex items-end justify-between gap-6">
          <SectionHeader
            eyebrow="Hair included"
            title="Styles With Hair Included"
            support="Turn up, sit back, leave transformed. Premium braiding hair comes as standard on every look below."
            link={{ label: 'View all & book', href: '/book' }}
          />
        </div>

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

          <div
            ref={trackRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4"
          >
            {HAIR_INCLUDED.map((service, i) => (
              <Card
                key={service.name}
                className="flex w-[85vw] shrink-0 snap-start flex-col sm:w-[380px]"
              >
                <CardImage src={IMAGES[i % IMAGES.length]} alt={service.name} ratio="aspect-[4/3]" />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between">
                    <Tag>{service.category}</Tag>
                    <span className="font-serif text-xl font-light text-gold">
                      {service.price}
                    </span>
                  </div>
                  <h3 className="mt-4 font-serif text-xl font-light tracking-tight">
                    {service.name}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-charcoal/65 dark:text-cream/65">
                    {service.description}
                  </p>
                  <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold">
                    ✦ Braiding hair included
                  </p>
                  <ButtonLink href="/book" variant="solid" size="sm" className="mt-6 w-full">
                    Book This Style
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
