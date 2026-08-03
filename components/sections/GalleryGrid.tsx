'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GALLERY, GALLERY_CATEGORIES } from '@/lib/site';

export default function GalleryGrid() {
  const [category, setCategory] = useState('All');
  const [lightbox, setLightbox] = useState<number | null>(null);

  const items = useMemo(
    () =>
      GALLERY.filter((g) => category === 'All' || g.category === category),
    [category]
  );

  const spanClass = (span: string) =>
    span === 'tall'
      ? 'row-span-2'
      : span === 'wide'
      ? 'sm:col-span-2'
      : '';

  return (
    <section className="container-luxe pb-24 lg:pb-32">
      {/* Filters */}
      <div className="mb-12 flex flex-wrap justify-center gap-2">
        {GALLERY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full border px-5 py-2 text-[0.7rem] font-medium uppercase tracking-[0.15em] transition-all duration-300 ${
              category === cat
                ? 'border-gold bg-gold text-charcoal'
                : 'border-charcoal/20 text-charcoal/70 hover:border-gold hover:text-gold dark:border-cream/20 dark:text-cream/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Masonry-style grid */}
      <motion.div
        layout
        className="grid auto-rows-[220px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        <AnimatePresence>
          {items.map((item, i) => (
            <motion.button
              layout
              key={`${item.src}-${item.category}-${i}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setLightbox(i)}
              className={`group relative overflow-hidden rounded-2xl ${spanClass(item.span)}`}
            >
              <Image
                src={item.src}
                alt={`${item.category} braided style`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-[900ms] ease-luxe group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-charcoal/0 transition-colors duration-500 group-hover:bg-charcoal/30" />
              <span className="absolute bottom-3 left-3 rounded-full bg-charcoal/60 px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.15em] text-cream opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-100">
                {item.category}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && items[lightbox] && (
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
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative h-[75vh] w-full max-w-4xl overflow-hidden rounded-2xl"
            >
              <Image
                src={items[lightbox].src}
                alt={`${items[lightbox].category} braided style`}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
