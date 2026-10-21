/** Shared admin navigation data (no JSX, so both the client shell and server
 *  pages can import it). Icons live in AdminShell; this is just the link list. */

export type ManageLink = { href: string; label: string; group: string; description: string };

export const MANAGE_LINKS: ManageLink[] = [
  { href: '/admin/service-categories', label: 'Service Categories', group: 'Catalogue', description: 'Organise services into categories' },
  { href: '/admin/services', label: 'Services', group: 'Catalogue', description: 'Appointment types, durations and prices' },
  { href: '/admin/addons', label: 'Add-ons', group: 'Catalogue', description: 'Optional extras per category' },
  { href: '/admin/trending-deals', label: 'Trending Deals', group: 'Catalogue', description: 'Featured deals + home-page images' },
  { href: '/admin/bundles', label: 'Products', group: 'Shop', description: 'Braiding-hair bundles, variants and media' },
  { href: '/admin/orders', label: 'Orders', group: 'Shop', description: 'Shop orders, refunds and fulfilment' },
  { href: '/admin/discounts', label: 'Discounts', group: 'Shop', description: 'Discount codes' },
  { href: '/admin/consumables', label: 'Stock', group: 'Shop', description: 'Quick in-stock toggles' },
  { href: '/admin/gallery', label: 'Gallery', group: 'Content', description: 'Upload and remove gallery photos' },
  { href: '/admin/blocked-dates', label: 'Blocked Dates', group: 'Scheduling', description: 'Close whole days or ranges' },
  { href: '/admin/settings', label: 'Settings', group: 'Account', description: 'Studio hours, booking rules, shipping' },
];

export const MANAGE_GROUPS = Array.from(new Set(MANAGE_LINKS.map((l) => l.group)));
