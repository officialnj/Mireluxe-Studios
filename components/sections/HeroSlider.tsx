'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IMG } from '@/lib/site';
import { ButtonLink } from '@/components/ui/Button';

type Slide = {
  image: string;
  /** Purpose-shot 9:16 crop for phones — subject sits low, clean space up top. */
  imageMobile: string;
  eyebrow: string;
  headline: [string, string];
  paragraph: string;
  /** Mobile-only condensed copy — first sentence, so the block never runs 4+ lines. */
  paragraphShort: string;
  /** Horizontal object-position for the mobile crop so the subject stays in frame. */
  mobilePosition: string;
};

const SLIDES: Slide[] = [
  {
    image: `${IMG}/hero-slide-1.jpg`,
    imageMobile: `${IMG}/hero-slide-1-mobile.jpg`,
    eyebrow: 'Wembley · NW London',
    headline: ['Welcome to', 'Miriluxe Studios.'],
    paragraph:
      'Where braiding is elevated into a luxury experience. I am Miracle, Founder & CEO, with over three years of experience in the hair and beauty industry and a passion for creating flawless, detail-driven braided styles.',
    paragraphShort:
      'Where braiding is elevated into a luxury experience, by Miracle — Founder & CEO.',
    mobilePosition: 'object-[55%_top]',
  },
  {
    image: `${IMG}/hero-slide-2.jpg`,
    imageMobile: `${IMG}/hero-slide-2-mobile.jpg`,
    eyebrow: 'The Philosophy',
    headline: ['Your hair', 'is your crown.'],
    paragraph:
      'Every appointment is an opportunity to help you feel confident, empowered, and effortlessly beautiful. For me, braiding is more than a service — it’s my purpose and the foundation of everything I’ve built.',
    paragraphShort:
      'Every appointment is an opportunity to feel confident, empowered and effortlessly beautiful.',
    mobilePosition: 'object-[62%_top]',
  },
  {
    image: `${IMG}/hero-slide-3.jpg`,
    imageMobile: `${IMG}/hero-slide-3-mobile.jpg`,
    eyebrow: 'The Mission',
    headline: ['Redefining', 'luxury braiding.'],
    paragraph:
      'At Miriluxe Studios, every detail is intentional. From exceptional craftsmanship to a refined client experience, my mission is to redefine luxurious braiding and ensure every woman leaves feeling her absolute best.',
    paragraphShort:
      'At Miriluxe Studios, every detail is intentional — luxury braiding, redefined.',
    mobilePosition: 'object-[50%_top]',
  },
];

const DURATION = 7000;

export default function HeroSlider() {
  const [index, setIndex] = useState(0);

  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => go(index + 1), DURATION);
    return () => clearTimeout(t);
  }, [index, go]);

  const slide = SLIDES[index];

  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
      {/* Background images crossfade */}
      <AnimatePresence>
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {/* Desktop crop — optimised, framing unchanged. Not preloaded on
              mobile (display:none + lazy), so phones never fetch the 2MB file. */}
          <Image
            src={slide.image}
            alt={slide.eyebrow}
            fill
            sizes="100vw"
            className="hidden object-cover object-[30%_center] lg:block"
          />
          {/* Mobile crop — purpose-shot 9:16: subject low, clean space up top. */}
          <Image
            src={slide.imageMobile}
            alt={slide.eyebrow}
            fill
            priority={index === 0}
            sizes="100vw"
            className={`object-cover ${slide.mobilePosition} lg:hidden`}
          />
          {/* Subtle readability wash — desktop only (kept minimal, no solid panel) */}
          <div className="absolute inset-0 hidden bg-gradient-to-r from-charcoal/50 via-charcoal/10 to-charcoal/45 lg:block" />
          <div className="absolute inset-0 hidden bg-gradient-to-t from-charcoal/40 via-transparent to-charcoal/20 lg:block" />
        </motion.div>
      </AnimatePresence>

      {/* Mobile-only scrim — dark-to-transparent from the TOP so the
          top-anchored text stays legible over the light upper background,
          while the subject stays clear in the lower frame. Hidden on desktop,
          which stays overlay-free as specified. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-charcoal/85 via-charcoal/25 to-transparent lg:hidden" />
      {/* Mobile-only bottom scrim — keeps the bottom-anchored CTAs and dots
          legible over the lower part of the image. Desktop stays overlay-free. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-charcoal/70 via-charcoal/15 to-transparent lg:hidden" />

      {/* Text block — mobile: text anchored to the top (over the clean space in
          the purpose-shot crop), CTAs pushed to the bottom of the image.
          Desktop (lg+): right-aligned, vertically centered (unchanged). */}
      <div className="container-luxe relative flex h-full items-stretch justify-start pb-20 pt-28 sm:pb-24 sm:pt-32 lg:items-center lg:justify-end lg:pb-0 lg:pt-0">
        <div className="flex h-full w-full max-w-xl flex-col text-left text-cream lg:block lg:h-auto lg:text-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="eyebrow text-gold-light">{slide.eyebrow}</span>
              <h1 className="mt-4 font-serif text-4xl font-light leading-[1.05] tracking-tightest sm:mt-5 sm:text-5xl lg:text-7xl lg:leading-[1.02]">
                {slide.headline[0]}
                <br />
                <span className="italic">{slide.headline[1]}</span>
              </h1>
              {/* Condensed first sentence on mobile; full paragraph from sm up */}
              <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/85 sm:mt-6 sm:text-base lg:ml-auto">
                <span className="sm:hidden">{slide.paragraphShort}</span>
                <span className="hidden sm:inline">{slide.paragraph}</span>
              </p>
            </motion.div>
          </AnimatePresence>

          {/* CTAs — identical across all slides. Mobile: stacked full-width,
              pushed to the bottom of the image via mt-auto. sm+: inline row.
              lg: back inline under the paragraph, right-aligned (unchanged). */}
          <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:mt-9 lg:justify-end lg:pt-0">
            <ButtonLink href="/book" variant="solid" size="lg" className="w-full sm:w-auto">
              Book Now
            </ButtonLink>
            <ButtonLink
              href="/shop"
              variant="outline"
              size="lg"
              className="w-full border-cream/50 text-cream hover:border-gold hover:text-gold sm:w-auto"
            >
              Shop Bundles
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* Dot navigation */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => go(i)}
            className="group h-2.5 overflow-hidden rounded-full transition-all duration-500 ease-luxe"
            style={{ width: i === index ? 40 : 10 }}
          >
            <span
              className={`block h-full w-full rounded-full transition-colors duration-500 ${
                i === index ? 'bg-gold' : 'bg-cream/50 group-hover:bg-cream'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
