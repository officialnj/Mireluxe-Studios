-- MIRILUXE Studios — statewide bundle length/pricing update, client-confirmed
-- via chat (2026-09-30). Applies to all 6 active bundle products (Body Wave,
-- Burmese Curl, Deep Wave, Italian Curls, Loose Deep Wave, Water Wave).
-- Only 18" is in stock (capacity 10 each); the other lengths are listed but
-- unavailable until restocked.

-- 1. Re-price the existing 18"/Black variant on each active bundle.
update bundle_variants bv
   set price_pence = 7450
  from bundles b
 where bv.bundle_id = b.id
   and b.active = true
   and b.name <> 'Curl texture bulk braiding bundle'
   and bv.inches = 18
   and bv.colour = 'Black';

-- 2. Add the remaining lengths, out of stock, for each active bundle.
with lengths(inches, price_pence) as (
  values
    (14, 6919),
    (16, 7272),
    (20, 7892),
    (22, 8423),
    (24, 8953),
    (26, 9661)
)
insert into bundle_variants (bundle_id, inches, colour, price_pence, in_stock, stock_quantity)
select b.id, l.inches, 'Black', l.price_pence, false, 0
  from bundles b
  cross join lengths l
 where b.active = true
   and b.name <> 'Curl texture bulk braiding bundle'
   and not exists (
     select 1 from bundle_variants bv
      where bv.bundle_id = b.id
        and bv.inches = l.inches
        and bv.colour = 'Black'
   );
