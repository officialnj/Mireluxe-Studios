-- MIRILUXE Studios — QA fixes (post GATE 1/2)
-- 1. Same internal-placeholder-leak bug as 0010, found by QA on two more
--    active services: Medium/Large Miracle Knots. Their `note` column mixed
--    genuine customer-facing hair-requirement text with an internal
--    "confirm with Mirakle" caveat, both rendered verbatim on the public
--    /book page. Strip the internal sentence, keep the real prep note.
update services
   set note = 'Requires a minimum of 2 crotchet bundles HUMAN HAIR only (client-supplied).'
 where slug = 'medium-miracle-knots';

update services
   set note = 'Requires a minimum of 1 crotchet bundle HUMAN HAIR only (client-supplied).'
 where slug = 'large-miracle-knots';

-- 2. Seed the 6 out-of-stock retail bundle styles from Agent E's shop
--    rebuild (handed off for the migrations owner to apply, never actually
--    run). All 18" / Black, in_stock = false, stock_quantity = 0 — /shop
--    hides the price and shows "Currently unavailable" for these. Idempotent.
insert into bundles (name)
select v.name
from (values ('Body Wave'), ('Water Wave'), ('Deep Wave'), ('Burmese Curl'), ('Loose Deep Wave'), ('Italian Curls')) as v(name)
where not exists (select 1 from bundles b where b.name = v.name);

insert into bundle_variants (bundle_id, inches, colour, price_pence, in_stock, stock_quantity)
select b.id, 18, 'Black', 5000, false, 0
from bundles b
where b.name in ('Body Wave', 'Water Wave', 'Deep Wave', 'Burmese Curl', 'Loose Deep Wave', 'Italian Curls')
  and not exists (
    select 1 from bundle_variants v
    where v.bundle_id = b.id and v.inches = 18 and v.colour = 'Black'
  );
