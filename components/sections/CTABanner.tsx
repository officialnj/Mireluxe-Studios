import Image from 'next/image';
import { IMG } from '@/lib/site';
import Reveal from '@/components/Reveal';
import { ButtonLink } from '@/components/ui/Button';

export default function CTABanner({
  title = 'Ready to slay your crown?',
  support = 'New slots release on the 20th of every month. Reserve your chair and leave feeling like the most confident version of yourself.',
}: {
  title?: string;
  support?: string;
}) {
  return (
    <section className="container-luxe py-24 lg:py-32">
      <div className="relative overflow-hidden rounded-3xl">
        <Image
          src={`${IMG}/hero-slide-2.jpg`}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_30%]"
        />
        <div className="absolute inset-0 bg-charcoal/70" />
        <Reveal className="relative flex flex-col items-center px-6 py-24 text-center text-cream">
          <span className="eyebrow text-gold-light">Book your appointment</span>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-cream/80">
            {support}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/book" variant="solid" size="lg">
              Book Now
            </ButtonLink>
            <ButtonLink
              href="/gallery"
              variant="outline"
              size="lg"
              className="border-cream/50 text-cream hover:border-gold hover:text-gold"
            >
              View Gallery
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
