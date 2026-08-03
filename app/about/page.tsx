import Image from 'next/image';
import type { Metadata } from 'next';
import { IMG, STATS, WHY_CHOOSE, FAQS } from '@/lib/site';
import Reveal from '@/components/Reveal';
import PageHero from '@/components/ui/PageHero';
import Accordion from '@/components/ui/Accordion';
import CTABanner from '@/components/sections/CTABanner';

export const metadata: Metadata = {
  title: 'About Us — MIRILUXE Studios',
  description:
    'The story of MIRILUXE Studios — a luxury braid studio in Wembley founded by Miracle De’Shanae.',
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Story"
        title="A studio built on craft, calm and connection"
        intro="MIRILUXE was born from a simple belief — that braiding, done with intention, is a luxury experience worth savouring."
      />

      {/* Story */}
      <section className="container-luxe py-16 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal direction="right">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl">
              <Image
                src={`${IMG}/hero-slide-1.jpg`}
                alt="Inside the MIRILUXE studio"
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal direction="left" delay={0.1}>
            <span className="eyebrow">The beginning</span>
            <h2 className="mt-3 font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
              More than a service — a purpose
            </h2>
            <div className="mt-6 space-y-5 text-sm leading-relaxed text-charcoal/70 dark:text-cream/70 sm:text-base">
              <p>
                What began as a passion for detail-driven braided styles has grown
                into a private Wembley studio where every appointment is treated as
                an experience. With over three years in the hair and beauty
                industry, founder Miracle has refined a signature approach: precise,
                tension-free, and unmistakably luxurious.
              </p>
              <p>
                Every element — from the calm of the space to the finish of each
                plait — is intentional. The mission is simple but uncompromising: to
                redefine luxurious braiding and ensure every woman leaves feeling her
                absolute best.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-charcoal/10 bg-cream-soft py-14 dark:border-cream/10 dark:bg-charcoal-soft">
        <div className="container-luxe grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08} className="text-center">
              <p className="font-serif text-5xl font-light text-gold sm:text-6xl">
                {stat.value}
              </p>
              <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60">
                {stat.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="container-luxe py-24 lg:py-32">
        <div className="text-center">
          <Reveal>
            <span className="eyebrow">Why choose us</span>
            <h2 className="mx-auto mt-3 max-w-2xl font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
              The details that set MIRILUXE apart
            </h2>
          </Reveal>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-charcoal/10 p-8 transition-colors duration-500 hover:border-gold/40 dark:border-cream/10">
                <span className="font-serif text-3xl font-light text-gold">
                  0{i + 1}
                </span>
                <h3 className="mt-6 font-serif text-xl font-light tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-charcoal/65 dark:text-cream/65">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-cream-soft py-24 dark:bg-charcoal-soft lg:py-32">
        <div className="container-luxe grid grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal>
            <span className="eyebrow">Good to know</span>
            <h2 className="mt-3 font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
              Frequently asked questions
            </h2>
            <p className="mt-5 max-w-sm text-sm text-charcoal/65 dark:text-cream/65">
              Everything you need to know about booking, policies and preparing for
              your appointment.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Accordion items={FAQS} />
          </Reveal>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
