-- MIRILUXE Studios — wire discount codes + shipping into shop_orders
-- Stores what was actually applied at checkout, for order-detail breakdowns
-- and so a refund/admin view can see the discount/shipping split rather
-- than just the final subtotal. Idempotent.
alter table shop_orders
  add column if not exists discount_code_id uuid references discount_codes(id),
  add column if not exists discount_pence integer not null default 0,
  add column if not exists shipping_pence integer not null default 0;

-- The £0 default seeded in 0012 was a placeholder-of-a-placeholder; the
-- actually-agreed placeholder (flagged for Mirakle to replace with her real
-- rate) is £3.99, matching what the checkout route now falls back to if the
-- settings row is ever missing. Only touch the value if it's still exactly
-- the original 0-default — never overwrite a real rate she's already set
-- via the admin Settings page.
update shipping_settings set flat_rate_pence = 399 where flat_rate_pence = 0;
