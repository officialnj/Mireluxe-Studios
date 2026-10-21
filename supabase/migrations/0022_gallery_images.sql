-- MIRILUXE Studios — admin-managed gallery images
--
-- The public /gallery page historically listed whatever JPEGs sat in
-- public/Mireluxe-Studios/Gallery (git-managed, no admin control). This adds
-- an admin-managed layer: images Mirakle uploads from the admin are stored in
-- the existing public `product-media` bucket (prefix `gallery/`) and recorded
-- here. The public page renders these first (newest curated work), then still
-- falls back to the filesystem portfolio, so nothing she had disappears.
--
-- Public read / admin write, additive (deletion-lock convention).
create table if not exists gallery_images (
  id uuid primary key default gen_random_uuid(),
  -- Path within the public product-media bucket, e.g. gallery/1719-xyz.jpg
  storage_path text not null,
  -- Optional caption / alt text.
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists gallery_images_sort_idx on gallery_images (sort_order asc);

alter table gallery_images enable row level security;

-- Anyone can read the gallery (it's public content).
drop policy if exists "Public read gallery_images" on gallery_images;
create policy "Public read gallery_images" on gallery_images
  for select to anon, authenticated using (true);

-- Only the studio admin writes (service-role bypasses RLS; this is
-- defense-in-depth, matching the rest of the schema).
drop policy if exists "Admin insert gallery_images" on gallery_images;
create policy "Admin insert gallery_images" on gallery_images
  for insert to authenticated with check (is_studio_admin(auth.uid()));

drop policy if exists "Admin update gallery_images" on gallery_images;
create policy "Admin update gallery_images" on gallery_images
  for update to authenticated using (is_studio_admin(auth.uid()));

drop policy if exists "Admin delete gallery_images" on gallery_images;
create policy "Admin delete gallery_images" on gallery_images
  for delete to authenticated using (is_studio_admin(auth.uid()));
