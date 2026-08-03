'use client';

import Image from 'next/image';
import { IMG } from '@/lib/site';
import Reveal from '@/components/Reveal';
import { ButtonLink } from '@/components/ui/Button';

const PARAGRAPHS = [
  'I’m a self-taught hairstylist with a genuine love for the craft — a full-time London braider currently sharpening my skills at the London College of Beauty Therapy, because when it comes to creative beauty, I’m all in.',
  'My mission? To enhance your natural beauty and slay your crown. Every client who sits in my chair should walk out feeling like an entirely new, more confident version of themselves — because that’s exactly what MIRILUXE is here to deliver.',
  'But it’s not just about the hair. I believe the real magic happens in the connection — building genuine, lasting relationships with every single client who trusts me with their look.',
];

export default function AboutMeSection() {
  return (
    <section className="container-luxe py-24 lg:py-32">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal direction="right">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl">
            <Image
              src={`${IMG}/ceo.jpg`}
              alt="Miracle De'Shanae, Founder of MIRILUXE Studios"
              fill
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-gold/20" />
          </div>
        </Reveal>

        <Reveal direction="left" delay={0.1}>
          <span className="eyebrow">Meet the founder</span>
          <h2 className="mt-3 font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
            Miracle De’Shanae
          </h2>
          <div className="mt-6 space-y-5 text-sm leading-relaxed text-charcoal/70 dark:text-cream/70 sm:text-base">
            {PARAGRAPHS.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <div className="mt-9">
            <ButtonLink href="/book" variant="solid" size="lg">
              Book with Miracle
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
