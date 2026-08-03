import Reveal from '@/components/Reveal';

export default function PageHero({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <section className="container-luxe pb-8 pt-36 text-center sm:pt-44">
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-5xl font-light leading-[1.05] tracking-tightest sm:text-6xl">
          {title}
        </h1>
        {intro && (
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-charcoal/65 dark:text-cream/65 sm:text-base">
            {intro}
          </p>
        )}
        <div className="mx-auto mt-10 h-px w-24 bg-gold/50" />
      </Reveal>
    </section>
  );
}
