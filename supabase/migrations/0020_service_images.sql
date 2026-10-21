-- MIRILUXE Studios — per-service feature image (primarily Trending Deals)
--
-- Trending Deals are ordinary `services` rows under the service_categories
-- row with slug='trending-deals'. They previously rendered as text-only
-- cards. This adds an optional photo per service so Mirakle can upload an
-- image for each deal from the admin. The value is a Supabase Storage path
-- in the existing public `product-media` bucket (prefix `deals/`), resolved
-- to a public URL at render time — same pattern as bundle_media. Null means
-- "render the text-only card" so existing deals keep working untouched.
--
-- Additive only (follows the repo's deletion-lock convention).
alter table services add column if not exists image_path text;

comment on column services.image_path is
  'Optional feature photo (Supabase Storage path in product-media bucket, prefix deals/). Primarily Trending Deals cards. Null = text-only card.';
