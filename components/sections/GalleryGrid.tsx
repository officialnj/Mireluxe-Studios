'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function labelFor(src: string): string {
  const filename = decodeURIComponent(src.split('/').pop() ?? '');
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'MIRILUXE braided style';
}

export default function GalleryGrid({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <section className="container-luxe pb-24 text-center lg:pb-32">
        <p className="text-sm text-charcoal/55 dark:text-cream/55">
          Photos coming soon.
        </p>
      </section>
    );
  }

  return (
    <section className="container-luxe pb-24 lg:pb-32">
      {/* Natural-height masonry — each photo keeps its own (typically vertical)
          proportions rather than being cropped into a fixed box. CSS columns
          reflow cleanly from 2-up on phones to 4-up on desktop with no JS. */}
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        <AnimatePresence>
          {images.map((src, i) => (
            <motion.button
              key={src}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => setLightbox(i)}
              className="group relative mb-4 block w-full overflow-hidden rounded-2xl break-inside-avoid"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic
                  size is the point: no fixed aspect-ratio box, no crop. */}
              <img
                src={src}
                alt={labelFor(src)}
                loading="lazy"
                className="block h-auto w-full rounded-2xl transition-transform duration-[900ms] ease-luxe group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-charcoal/0 transition-colors duration-500 group-hover:bg-charcoal/20" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && images[lightbox] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/90 p-6 backdrop-blur-sm"
          >
            <button
              aria-label="Close"
              onClick={() => setLightbox(null)}
              className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-cream/30 text-cream transition-colors hover:border-gold hover:text-gold"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lightbox]}
              alt={labelFor(images[lightbox])}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
