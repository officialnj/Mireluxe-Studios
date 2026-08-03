import Link from 'next/link';
import Reveal from '@/components/Reveal';

export default function SectionHeader({
  eyebrow,
  title,
  support,
  link,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  support?: string;
  link?: { label: string; href: string };
  align?: 'left' | 'center';
}) {
  return (
    <div
      className={`flex flex-col gap-6 ${
        align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
      }`}
    >
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl font-light leading-tight tracking-tightest sm:text-5xl">
          {title}
        </h2>
        {support && (
          <p className={`mt-4 max-w-lg text-sm text-charcoal/65 dark:text-cream/65 ${align === 'center' ? 'mx-auto' : ''}`}>
            {support}
          </p>
        )}
      </Reveal>
      {link && (
        <Reveal delay={0.1}>
          <Link
            href={link.href}
            className="link-underline whitespace-nowrap text-xs font-medium uppercase tracking-luxe text-gold"
          >
            {link.label}
          </Link>
        </Reveal>
      )}
    </div>
  );
}
