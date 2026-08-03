import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import GalleryGrid from '@/components/sections/GalleryGrid';

export const metadata: Metadata = {
  title: 'Gallery — MIRILUXE Studios',
  description:
    'A portfolio of detail-driven braided styles — knotless, boho, stitch, feed-ins and kids.',
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="The Gallery"
        title="A portfolio of finished crowns"
        intro="Browse a curated selection of recent work. Filter by style, and tap any image to view it in full."
      />
      <GalleryGrid />
    </>
  );
}
