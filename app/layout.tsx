import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import CartProvider from '@/components/CartProvider';
import SiteChrome from '@/components/SiteChrome';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'MIRILUXE Studios — Luxury Braid Studio · Wembley, NW London',
  description:
    'Where braiding is elevated into a luxury experience. Detail-driven, flawless braided styles crafted by Mirakle in a private Wembley studio.',
  keywords: [
    'braiding',
    'knotless braids',
    'luxury hair studio',
    'Wembley',
    'London braider',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans">
        <ThemeProvider>
          <CartProvider>
            <SiteChrome>{children}</SiteChrome>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
