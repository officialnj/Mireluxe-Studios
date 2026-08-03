'use client';

import { REVIEWS } from '@/lib/site';
import Reveal from '@/components/Reveal';
import SectionHeader from '@/components/ui/SectionHeader';

function QuoteMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="text-gold/40">
      <path
        d="M16 8C10.5 10 7 15 7 21v11h12V20h-6c0-4 1.5-7 5-8.5L16 8zm17 0c-5.5 2-9 7-9 13v11h12V20h-6c0-4 1.5-7 5-8.5L33 8z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ReviewsSection() {
  return (
    <section className="bg-cream-soft py-24 dark:bg-charcoal-soft lg:py-32">
      <div className="container-luxe">
        <SectionHeader
          eyebrow="Loved by our clients"
          title="The MIRILUXE Experience, In Their Words"
          align="center"
        />

        <div className="mt-16 grid grid-cols-1 gap-7 md:grid-cols-3">
          {REVIEWS.map((review, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <figure className="flex h-full flex-col rounded-2xl border border-charcoal/10 bg-cream/60 p-8 transition-colors duration-500 hover:border-gold/40 dark:border-cream/10 dark:bg-charcoal/40">
                <QuoteMark />
                <blockquote className="mt-6 flex-1 font-serif text-lg font-light italic leading-relaxed tracking-tight text-charcoal/85 dark:text-cream/85">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-8 text-[0.7rem] font-medium uppercase tracking-luxe text-gold">
                  — {review.author}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
