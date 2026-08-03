'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, IMG } from '@/lib/site';
import Reveal from '@/components/Reveal';
import { Tag } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SORTS = ['Featured', 'Price: Low to High', 'Price: High to Low', 'Name'];

const IMAGES = [
  `${IMG}/hero-slide-1.jpg`,
  `${IMG}/hero-slide-2.jpg`,
  `${IMG}/hero-slide-3.jpg`,
  `${IMG}/ceo.jpg`,
];

const priceNum = (p: string) => Number(p.replace(/[^0-9.]/g, ''));

export default function ShopGrid() {
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('Featured');

  const items = useMemo(() => {
    let list = PRODUCTS.filter(
      (p) => category === 'All' || p.category === category
    );
    if (sort === 'Price: Low to High')
      list = [...list].sort((a, b) => priceNum(a.price) - priceNum(b.price));
    if (sort === 'Price: High to Low')
      list = [...list].sort((a, b) => priceNum(b.price) - priceNum(a.price));
    if (sort === 'Name')
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [category, sort]);

  return (
    <section className="container-luxe pb-24 lg:pb-32">
      {/* Filter / sort bar */}
      <div className="flex flex-col gap-6 border-y border-charcoal/10 py-6 dark:border-cream/10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-4 py-2 text-[0.7rem] font-medium uppercase tracking-[0.15em] transition-all duration-300 ${
                category === cat
                  ? 'border-gold bg-gold text-charcoal'
                  : 'border-charcoal/20 text-charcoal/70 hover:border-gold hover:text-gold dark:border-cream/20 dark:text-cream/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[0.7rem] uppercase tracking-luxe text-charcoal/50 dark:text-cream/50">
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-full border border-charcoal/20 bg-transparent px-4 py-2 text-sm outline-none transition-colors focus:border-gold dark:border-cream/20 dark:bg-charcoal"
          >
            {SORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((product, i) => (
          <Reveal key={product.name} delay={(i % 4) * 0.08}>
            <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-cream-soft/60 transition-all duration-500 ease-luxe hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_24px_60px_-30px_rgba(26,26,26,0.5)] dark:border-cream/10 dark:bg-charcoal-soft/60">
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={IMAGES[i % IMAGES.length]}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 22vw"
                  className="object-cover transition-transform duration-[900ms] ease-luxe group-hover:scale-105"
                />
                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.15em] backdrop-blur-sm ${
                    product.stock === 'Low stock'
                      ? 'bg-charcoal/70 text-gold-light'
                      : 'bg-charcoal/60 text-cream'
                  }`}
                >
                  {product.stock}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <Tag>{product.category}</Tag>
                <h3 className="mt-3 font-serif text-lg font-light tracking-tight">
                  {product.name}
                </h3>
                <p className="mt-1 text-xs text-charcoal/55 dark:text-cream/55">
                  {product.spec}
                </p>
                <p className="mt-4 font-serif text-2xl font-light text-gold">
                  {product.price}
                </p>
                <p className="mt-2 text-[0.68rem] uppercase tracking-[0.15em] text-charcoal/45 dark:text-cream/45">
                  Add to your appointment at checkout
                </p>
                <Button size="sm" className="mt-5 w-full">
                  Add to Cart
                </Button>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
