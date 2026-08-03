'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'solid' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium uppercase tracking-luxe text-[0.7rem] transition-all duration-500 ease-luxe focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50';

const variants: Record<Variant, string> = {
  solid:
    'bg-gold text-charcoal hover:bg-gold-light hover:shadow-[0_10px_30px_-12px_rgba(176,141,87,0.7)] hover:-translate-y-0.5',
  outline:
    'border border-charcoal/40 text-charcoal hover:border-gold hover:text-gold dark:border-cream/40 dark:text-cream dark:hover:border-gold dark:hover:text-gold',
  ghost:
    'text-charcoal hover:text-gold dark:text-cream dark:hover:text-gold',
};

const sizes: Record<Size, string> = {
  sm: 'px-5 py-2.5',
  md: 'px-7 py-3.5',
  lg: 'px-9 py-4',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = 'solid',
  size = 'md',
  className = '',
  children,
  ...rest
}: CommonProps & ComponentProps<'button'>) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'solid',
  size = 'md',
  className = '',
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
