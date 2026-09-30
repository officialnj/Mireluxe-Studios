import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import GalleryGrid from '@/components/sections/GalleryGrid';

export const metadata: Metadata = {
  title: 'Gallery — MIRILUXE Studios',
  description: 'A portfolio of detail-driven braided styles.',
};

// Re-reads the Gallery folder on every request rather than baking the file
// list in at build time — new photos show up immediately, no rebuild/deploy
// needed to see them.
export const dynamic = 'force-dynamic';

const GALLERY_DIR = path.join(process.cwd(), 'public', 'Mireluxe-Studios', 'Gallery');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Reads whatever's actually in the Gallery folder at request time — drop
 *  any number of photos in with any filenames and they show up automatically,
 *  no code change needed. Prefix filenames with numbers (01-, 02-, ...) to
 *  control display order; otherwise sorted alphabetically. */
function getGalleryImages(): string[] {
  let filenames: string[];
  try {
    filenames = fs.readdirSync(GALLERY_DIR);
  } catch {
    return [];
  }
  return filenames
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `/Mireluxe-Studios/Gallery/${encodeURIComponent(name)}`);
}

export default function GalleryPage() {
  const images = getGalleryImages();

  return (
    <>
      <PageHero
        eyebrow="The Gallery"
        title="A portfolio of finished crowns"
        intro="Browse a curated selection of recent work. Tap any image to view it in full."
      />
      <GalleryGrid images={images} />
    </>
  );
}
