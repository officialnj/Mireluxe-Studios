// Simple hardcoded feature flags for homepage sections — there's no env-var
// based flag infrastructure elsewhere in this codebase yet, so a small
// exported const is the lowest-footprint option.

/**
 * "Styles With Hair Included" carousel (components/sections/ServicesCarousel.tsx).
 * Its visual design was cloned for the new DB-driven "Deals of the Month"
 * carousel (components/home/DealsSection.tsx), which now covers the same
 * homepage real estate. Per the deletion lock, the original carousel and its
 * `HAIR_INCLUDED` data (lib/site.ts) are kept in place, just hidden — flip
 * this back to `true` to bring it back.
 */
export const SHOW_HAIR_INCLUDED_CAROUSEL = false;
