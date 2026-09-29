-- MIRILUXE Studios — shop merchandise orders
-- Full-price checkout for /shop products (unlike bookings, which only ever
-- collect a deposit). `items` is a jsonb price-snapshot array rather than a
-- relational line-items table since PRODUCTS itself is static TS data in
-- lib/site.ts, not a DB table — mirrors the same "snapshot the price at
-- time of transaction" approach already used by booking_bundles.
-- price_pence_at_booking.

create table shop_orders (
  id                        uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id  text unique,
  customer_name             text not null,
  customer_email            text not null,
  customer_phone            text,
  shipping_line1            text not null,
  shipping_line2            text,
  shipping_city             text not null,
  shipping_postcode         text not null,
  shipping_country          text not null default 'GB',
  items                     jsonb not null,
  subtotal_pence            integer not null,
  status                    text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'cancelled')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table shop_orders enable row level security;
-- No public policies: only the service-role checkout route and the Stripe
-- webhook ever touch this table, same pattern as the `admins` table.
