export const IMG = '/Mireluxe-Studios/Images';

/** Dedicated photos for sections that previously just reused the 3 hero
 *  shots. Drop real photos into public/Mireluxe-Studios/Images/ with these
 *  exact filenames — no code changes needed once they're there. */
export const SERVICES_CAROUSEL_IMAGES = [
  `${IMG}/services-carousel-1.jpg`,
  `${IMG}/services-carousel-2.jpg`,
  `${IMG}/services-carousel-3.jpg`,
];
export const CTA_BANNER_IMAGE = `${IMG}/cta-banner.jpg`;
export const ABOUT_PAGE_HERO_IMAGE = `${IMG}/about-page-hero.jpg`;

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '/about' },
  { label: 'Shop', href: '/shop' },
  { label: 'Book Appointment', href: '/book' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Contact Us', href: '/contact' },
];

export const CONTACT = {
  area: 'Wembley · NW London',
  address: 'Wembley, North West London, HA9',
  openingHours: '9am – 6pm · Mon–Sat',
  phoneHours: '11am – 5pm',
  phone: '+44 20 7946 0231',
  instagram: '@miriluxe.studios',
  instagramUrl: 'https://instagram.com/miriluxe.studios',
  email: 'hello@miriluxestudios.com',
};

export type Service = {
  name: string;
  price: string;
  category: string;
  description: string;
  note?: string;
  hairIncluded?: boolean;
};

export const SERVICES: Service[] = [
  {
    name: 'Goddess Knotless Braids',
    price: 'from £120',
    category: 'Signature',
    description:
      'Soft, weightless knotless braids finished with curled goddess pieces for an effortless, romantic silhouette.',
    hairIncluded: true,
  },
  {
    name: 'Feed-In Cornrows',
    price: 'from £45',
    category: 'Scalp',
    description:
      'Sleek, gradually built cornrows laid flat to the scalp — clean partings and a razor-sharp finish.',
  },
  {
    name: 'Knotless Braids',
    price: 'from £90',
    category: 'Classic',
    description:
      'Tension-free knotless braids in your chosen length and size, plaited for comfort that lasts for weeks.',
  },
  {
    name: 'Hair Included Styles',
    price: 'from £110',
    category: 'All-Inclusive',
    description:
      'Turn up, sit back, leave transformed. Premium braiding hair is included — no shopping, no stress.',
    note: 'Limited premium slots',
    hairIncluded: true,
  },
  {
    name: 'Sew-In Install',
    price: 'from £130',
    category: 'Install',
    description:
      'A seamless, natural-looking sew-in install with a flawless leave-out or closure of your choice.',
    hairIncluded: true,
  },
  {
    name: 'Boho Twists',
    price: 'from £100',
    category: 'Textured',
    description:
      'Bohemian twists blended with curly human-hair pieces for that undone, free-spirited finish.',
  },
  {
    name: 'Touch-Up & Refresh',
    price: 'from £30',
    category: 'Maintenance',
    description:
      'Refresh your edges, re-lay your parting and revive your style between full appointments.',
  },
  {
    name: 'Trending Deal',
    price: 'from £85',
    category: 'Featured',
    description:
      'This month’s most-requested look at a curated rate — reserve early, slots move fast.',
    note: 'Deal of the month',
  },
];

export const HAIR_INCLUDED = SERVICES.filter((s) =>
  ['Hair Included Styles', 'Sew-In Install', 'Goddess Knotless Braids'].includes(
    s.name
  )
);

export const REVIEWS = [
  {
    quote:
      'Mirakle is genuinely an artist. My knotless braids were the neatest I have ever had, and the studio felt like a private retreat from start to finish.',
    author: 'Verified client',
  },
  {
    quote:
      'From the moment I sat down I felt looked after. Zero tension, immaculate partings, and I left feeling like the most confident version of myself.',
    author: 'Verified client',
  },
  {
    quote:
      'The attention to detail is unmatched. It is so much more than hair — it is the calm, the care, and the way she makes every appointment feel special.',
    author: 'Verified client',
  },
];

export const PRODUCTS = [
  {
    slug: 'signature-knotless-bundle',
    name: 'Signature Knotless Bundle',
    category: 'Braiding Hair',
    spec: 'Pre-stretched · 3 packs · 26"',
    pricePence: 2800,
    stock: 'In stock',
  },
  {
    slug: 'goddess-curl-pack',
    name: 'Goddess Curl Pack',
    category: 'Curly Add-On',
    spec: 'Human-blend · Water-wave · 18"',
    pricePence: 2200,
    stock: 'In stock',
  },
  {
    slug: 'boho-human-hair-curls',
    name: 'Boho Human Hair Curls',
    category: 'Curly Add-On',
    spec: '100% human hair · 20"',
    pricePence: 3400,
    stock: 'Low stock',
  },
  {
    slug: 'premium-sew-in-weft',
    name: 'Premium Sew-In Weft',
    category: 'Wefts',
    spec: 'Double-drawn · Bundle of 3 · 22"',
    pricePence: 12000,
    stock: 'In stock',
  },
  {
    slug: 'edge-control-lay-kit',
    name: 'Edge Control & Lay Kit',
    category: 'Aftercare',
    spec: 'Strong hold · Flake-free · 100ml',
    pricePence: 1400,
    stock: 'In stock',
  },
  {
    slug: 'silk-sleep-bonnet',
    name: 'Silk Sleep Bonnet',
    category: 'Aftercare',
    spec: '100% mulberry silk · Adjustable',
    pricePence: 1800,
    stock: 'In stock',
  },
  {
    slug: 'feed-in-control-pack',
    name: 'Feed-In Control Pack',
    category: 'Braiding Hair',
    spec: 'Pre-stretched · 2 packs · 24"',
    pricePence: 1900,
    stock: 'In stock',
  },
  {
    slug: 'scalp-soothe-oil',
    name: 'Scalp Soothe Oil',
    category: 'Aftercare',
    spec: 'Tea tree & peppermint · 60ml',
    pricePence: 1600,
    stock: 'Low stock',
  },
];

export const PRODUCT_CATEGORIES = [
  'All',
  'Braiding Hair',
  'Curly Add-On',
  'Wefts',
  'Aftercare',
];

export const GALLERY = [
  { src: `${IMG}/hero-slide-1.jpg`, category: 'Knotless', span: 'tall' },
  { src: `${IMG}/hero-slide-2.jpg`, category: 'Boho', span: 'wide' },
  { src: `${IMG}/ceo.jpg`, category: 'Stitch', span: 'normal' },
  { src: `${IMG}/hero-slide-3.jpg`, category: 'Feed-Ins', span: 'tall' },
  { src: `${IMG}/hero.jpg`, category: 'Knotless', span: 'wide' },
  { src: `${IMG}/hero-slide-2.jpg`, category: 'Kids', span: 'normal' },
  { src: `${IMG}/hero-slide-1.jpg`, category: 'Stitch', span: 'normal' },
  { src: `${IMG}/hero-slide-3.jpg`, category: 'Boho', span: 'tall' },
  { src: `${IMG}/ceo.jpg`, category: 'Feed-Ins', span: 'wide' },
  { src: `${IMG}/hero.jpg`, category: 'Knotless', span: 'normal' },
  { src: `${IMG}/hero-slide-2.jpg`, category: 'Kids', span: 'tall' },
  { src: `${IMG}/hero-slide-1.jpg`, category: 'Boho', span: 'normal' },
];

export const FAQS = [
  {
    q: 'How do I book an appointment?',
    a: 'All appointments are booked online through the Book Appointment page. Choose your style, add any bundle you need, and select a date and time. A booking deposit secures your slot.',
  },
  {
    q: 'How far ahead can I book?',
    a: 'New availability opens continuously, so you can always book a future date directly on the Book Appointment page — no need to wait for a fixed release day.',
  },
  {
    q: 'Do you provide the hair?',
    a: 'For any style marked “hair included”, premium braiding hair is provided. For all other services you are welcome to bring your own, or add a bundle from the Shop at checkout.',
  },
  {
    q: 'What is your cancellation and lateness policy?',
    a: 'Deposits are non-refundable but transferable with 48 hours’ notice. Please arrive with clean, blow-dried hair. Arrivals more than 20 minutes late may need to rebook.',
  },
  {
    q: 'Where is the studio located?',
    a: 'MIRILUXE is a private studio in Wembley, North West London. The full address and access details are sent once your appointment is confirmed.',
  },
];

export const STATS = [
  { value: '3+', label: 'Years of craft' },
  { value: '500+', label: 'Crowns styled' },
  { value: '5.0', label: 'Average rating' },
  { value: '1:1', label: 'Private studio experience' },
];

export const WHY_CHOOSE = [
  {
    title: 'Detail-Driven Craft',
    body: 'Every parting, every plait, every finish is intentional. Precision is the standard, never the exception.',
  },
  {
    title: 'A Private Experience',
    body: 'One client at a time in a calm, considered studio — no crowds, no rush, just you and your crown.',
  },
  {
    title: 'Premium Hair Included',
    body: 'Select styles include high-grade braiding hair, so you can simply turn up and leave transformed.',
  },
  {
    title: 'Lasting Relationships',
    body: 'The real magic is the connection — genuine care built with every client who trusts us with their look.',
  },
];
