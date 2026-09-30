-- MIRILUXE Studios — direct browser-to-storage upload for product media
-- Video clips (up to 100MB) must upload directly from the admin's browser
-- to Supabase Storage using their own authenticated session, not proxied
-- through a Next.js API route (serverless function body-size limits would
-- reject anything but tiny files). Public reads already work on a public
-- bucket without a policy; writes go through RLS and need these.
drop policy if exists "Admin insert product-media" on storage.objects;
create policy "Admin insert product-media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-media' and is_studio_admin(auth.uid()));

drop policy if exists "Admin update product-media" on storage.objects;
create policy "Admin update product-media" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-media' and is_studio_admin(auth.uid()));

drop policy if exists "Admin delete product-media" on storage.objects;
create policy "Admin delete product-media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-media' and is_studio_admin(auth.uid()));
