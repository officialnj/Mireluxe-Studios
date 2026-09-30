-- MIRILUXE Studios — narrow the live "Curl texture bulk braiding bundle"
-- option to exactly one default: 18" / Black. Client direction: only this
-- combination should be customer-selectable for now; everything else stays
-- in the DB (deletion lock) for her to reactivate or repurpose via the
-- admin Products page once real length/colour options are confirmed.
--
-- "1B" is the standard hair-industry code for off-black/natural black —
-- relabelled to "Black" rather than left as a numeric code customers won't
-- recognise. If that's not actually the right shade, rename it back via
-- /admin/bundles (the price/stock stay exactly as they are either way).
update bundle_variants
   set colour = 'Black'
 where bundle_id = (select id from bundles where name = 'Curl texture bulk braiding bundle')
   and inches = 18
   and colour = '1B';

-- Take the other currently-live 18" option out of stock so only the new
-- "Black" one is selectable. Not deleted — flip in_stock back on via admin
-- any time.
update bundle_variants
   set in_stock = false
 where bundle_id = (select id from bundles where name = 'Curl texture bulk braiding bundle')
   and inches = 18
   and colour = '4';
