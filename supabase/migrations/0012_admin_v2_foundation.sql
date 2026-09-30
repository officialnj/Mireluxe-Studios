-- MIRILUXE Studios — admin v2 foundation
-- Schema groundwork for: Shop Orders dashboard, full service/category
-- management, booking lifecycle tools (manual create, complete/no-show),
-- customer directory (derived, no new table needed), video/image product
-- media gallery, discount codes, and real shipping rate configuration.
-- Idempotent throughout.

-- ── Shop Orders: separate fulfillment status from payment status ─────────
-- `status` already tracks payment (pending_payment/paid/cancelled). Shopify
-- distinguishes financial status from fulfillment status — add that here.
alter table shop_orders
  add column if not exists fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'fulfilled', 'shipped', 'delivered', 'cancelled')),
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text,
  add column if not exists shipped_at timestamptz,
  add column if not exists admin_notes text;

-- ── Bookings: manual admin-created bookings, non-Stripe payment tracking ──
alter table bookings
  add column if not exists created_by_admin boolean not null default false,
  add column if not exists payment_method text not null default 'stripe'
    check (payment_method in ('stripe', 'cash', 'other'));

-- ── Service categories: admin write access (public read already existed) ─
drop policy if exists admin_write_categories on service_categories;
create policy admin_write_categories on service_categories
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));

-- ── Product media gallery (images + short videos) ─────────────────────────
-- Replaces reliance on bundle_variants.image_url (kept, not deleted, per
-- deletion lock) with a proper one-to-many gallery. Videos store a
-- client-captured first-frame poster image alongside the clip so the
-- storefront can show a static cover without loading the video first.
create table if not exists bundle_media (
  id                  uuid primary key default gen_random_uuid(),
  bundle_variant_id   uuid not null references bundle_variants(id) on delete cascade,
  media_type          text not null check (media_type in ('image', 'video')),
  storage_path        text not null,
  poster_storage_path text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

alter table bundle_media enable row level security;

drop policy if exists public_read_bundle_media on bundle_media;
create policy public_read_bundle_media on bundle_media
  for select to anon, authenticated using (true);

drop policy if exists admin_write_bundle_media on bundle_media;
create policy admin_write_bundle_media on bundle_media
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));

-- Public storage bucket for product media. iPhone clips run ~15s; 100MB cap
-- gives generous headroom even for 4K HEVC source footage. Admin uploads go
-- through the service-role client server-side (bypasses RLS entirely), so
-- no storage.objects policies are needed beyond the bucket being public for
-- reads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  104857600,
  array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Discount / coupon codes ────────────────────────────────────────────────
create table if not exists discount_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  discount_type       text not null check (discount_type in ('percent', 'fixed')),
  value               integer not null,
  active              boolean not null default true,
  usage_limit         integer,
  used_count          integer not null default 0,
  min_subtotal_pence  integer not null default 0,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

alter table discount_codes enable row level security;
-- No public policies — codes are validated by the checkout route via the
-- service-role client (same pattern as `admins`), never read directly by
-- an anonymous client. Prevents scraping/enumerating valid codes via RLS.

drop policy if exists admin_write_discount_codes on discount_codes;
create policy admin_write_discount_codes on discount_codes
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));

-- ── Shipping rate configuration ────────────────────────────────────────────
-- Singleton settings row, same pattern as booking_settings. Replaces the
-- hardcoded flat £0 placeholder in the shop checkout route. Public read so
-- /shop can display "free shipping over £X" messaging; the actual charge is
-- always computed server-side at checkout, never trusted from the client.
create table if not exists shipping_settings (
  id                          boolean primary key default true check (id),
  flat_rate_pence             integer not null default 0,
  free_shipping_threshold_pence integer,
  updated_at                  timestamptz not null default now()
);

insert into shipping_settings (id) values (true) on conflict (id) do nothing;

alter table shipping_settings enable row level security;

drop policy if exists public_read_shipping_settings on shipping_settings;
create policy public_read_shipping_settings on shipping_settings
  for select to anon, authenticated using (true);

drop policy if exists admin_write_shipping_settings on shipping_settings;
create policy admin_write_shipping_settings on shipping_settings
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));
