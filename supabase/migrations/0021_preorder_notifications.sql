-- MIRILUXE Studios — shop pre-order / "notify me when back in stock" leads
--
-- When a bundle variant (length + colour) is out of stock the shop now shows
-- a "Pre-order" button that captures an email only — no payment. Each signup
-- is stored here and also emailed to the studio so Mirakle can reach out when
-- she restocks that length/colour.
--
-- Public gets INSERT-only (same posture as pending bookings); reads are
-- admin/service-role only. Additive (deletion-lock convention).
create table if not exists preorder_notifications (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid references bundles(id) on delete set null,
  bundle_variant_id uuid references bundle_variants(id) on delete set null,
  inches integer,
  colour text,
  email text not null,
  created_at timestamptz not null default now(),
  -- Set by the studio once the customer has been told it's back, so the admin
  -- list can distinguish outstanding leads from handled ones.
  notified_at timestamptz
);

create index if not exists preorder_notifications_variant_idx
  on preorder_notifications (bundle_variant_id);
create index if not exists preorder_notifications_outstanding_idx
  on preorder_notifications (created_at desc) where notified_at is null;

alter table preorder_notifications enable row level security;

-- Public can submit a signup, nothing else.
drop policy if exists "Public insert preorder_notifications" on preorder_notifications;
create policy "Public insert preorder_notifications" on preorder_notifications
  for insert to anon, authenticated with check (true);

-- Only the studio admin can read/update (service-role bypasses RLS anyway;
-- this is defense-in-depth, matching the rest of the schema).
drop policy if exists "Admin read preorder_notifications" on preorder_notifications;
create policy "Admin read preorder_notifications" on preorder_notifications
  for select to authenticated using (is_studio_admin(auth.uid()));

drop policy if exists "Admin update preorder_notifications" on preorder_notifications;
create policy "Admin update preorder_notifications" on preorder_notifications
  for update to authenticated using (is_studio_admin(auth.uid()));
