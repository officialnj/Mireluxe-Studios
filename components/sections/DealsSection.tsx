'use client';

import { IMG } from '@/lib/site';
import { formatPence } from '@/lib/booking/pricing';
import type { DbService } from '@/lib/booking/types';
import Reveal from '@/components/Reveal';
import SectionHeader from '@/components/ui/SectionHeader';
import { Card, CardImage, Tag } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';

// Placeholder imagery — the `services` table has no image column yet (same
// gap ServicesCarousel already works around), so these round-robin existing
// hero photos by deal slug until real per-deal photography exists.
const DEAL_IMAGES = [`${IMG}/hero-slide-1.jpg`, `${IMG}/hero-slide-2.jpg`, `${IMG}/hero-slide-3.jpg`, `${IMG}/hero.jpg`];

export default function DealsSection({ deals }: { deals: DbService[] }) {
  if (deals.length === 0) return null;

  return (
    <section className="container-luxe py-24 lg:py-32">
      <SectionHeader
        eyebrow="Limited time"
        title="Deals of the Month"
        support="A rotating edit of featured styles at curated monthly rates — reserved for the few who book early."
        link={{ label: 'View all deals', href: '/book' }}
      />

      <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-3">
        {deals.map((deal, i) => (
          <Reveal key={deal.id} delay={i * 0.1}>
            <Card className="flex h-full flex-col">
              <CardImage src={DEAL_IMAGES[i % DEAL_IMAGES.length]} alt={deal.name} ratio="aspect-[4/5]" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <Tag>Trending Deal</Tag>
                  <span className="font-serif text-2xl font-light text-gold">
                    {formatPence(deal.hair_incl_price_pence ?? deal.base_price_pence)}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-xl font-light tracking-tight">
                  {deal.name}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-charcoal/65 dark:text-cream/65">
                  {deal.description}
                </p>
                {deal.note && (
                  <p className="mt-4 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gold">
                    ✦ {deal.note}
                  </p>
                )}
                <ButtonLink href={`/book?service=${deal.slug}`} variant="outline" size="sm" className="mt-6 w-full">
                  Book Now
                </ButtonLink>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
