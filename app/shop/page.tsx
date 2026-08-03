import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import ShopGrid from '@/components/sections/ShopGrid';

export const metadata: Metadata = {
  title: 'Shop — MIRILUXE Studios',
  description:
    'Premium braiding hair, curly add-ons, wefts and aftercare — curated to pair with your appointment.',
};

export default function ShopPage() {
  return (
    <>
      <PageHero
        eyebrow="The Shop"
        title="Premium hair & aftercare"
        intro="Hand-picked bundles and essentials to pair with your style. Add any item to your appointment at checkout."
      />
      <ShopGrid />
    </>
  );
}
