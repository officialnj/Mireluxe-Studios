'use client';

import { DEALS } from '@/lib/site';
import Reveal from '@/components/Reveal';
import SectionHeader from '@/components/ui/SectionHeader';
import { Card, CardImage, Tag } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';

export default function DealsSection() {
  return (
    <section className="container-luxe py-24 lg:py-32">
      <SectionHeader
        eyebrow="Limited time"
        title="Deals of the Month"
        support="A rotating edit of featured styles at curated monthly rates — reserved for the few who book early."
        link={{ label: 'View all deals', href: '/book' }}
      />

      <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-3">
        {DEALS.map((deal, i) => (
          <Reveal key={deal.name} delay={i * 0.1}>
            <Card className="flex h-full flex-col">
              <CardImage src={deal.image} alt={deal.name} ratio="aspect-[4/5]" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between">
                  <Tag>{deal.category}</Tag>
                  <span className="font-serif text-2xl font-light text-gold">
                    {deal.price}
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
                <ButtonLink href="/book" variant="outline" size="sm" className="mt-6 w-full">
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
