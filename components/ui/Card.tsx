'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-charcoal/10 bg-cream-soft/60 backdrop-blur-sm transition-all duration-500 ease-luxe hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_24px_60px_-30px_rgba(26,26,26,0.5)] dark:border-cream/10 dark:bg-charcoal-soft/70 dark:hover:border-gold/40 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardImage({
  src,
  alt,
  ratio = 'aspect-[4/5]',
}: {
  src: string;
  alt: string;
  ratio?: string;
}) {
  return (
    <div className={`relative w-full overflow-hidden ${ratio}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
        className="object-cover transition-transform duration-[900ms] ease-luxe group-hover:scale-[1.06]"
      />
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-gold/40 px-3 py-1 text-[0.6rem] font-medium uppercase tracking-luxe text-gold">
      {children}
    </span>
  );
}
