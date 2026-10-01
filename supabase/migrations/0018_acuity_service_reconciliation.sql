-- MIRILUXE Studios — service catalogue reconciliation against the live
-- Acuity booking page (bookwithmiriluxe.as.me), client-confirmed via chat
-- (2026-10-01). Three kinds of fix:
--   1. Rename services whose name was wrong but price/duration matched a
--      real Acuity entry under a different name.
--   2. Null out "hair included" prices that don't correspond to any real
--      Acuity offering for that size (base price is correct and untouched).
--   3. Archive (active = false, never deleted) services with no matching
--      Acuity entry in any category — may be stale data or styles Mirakle
--      no longer lists; can be reactivated or corrected later.

-- 1. Naming fixes — price and duration already correct, name was not.
-- "14–16 Feed-Ins" doesn't exist on Acuity; its £120 / 5hr matches
-- Acuity's "12-14 FeedIn Braids" exactly.
update services
   set name = '12–14 Feed-Ins'
 where name = '14–16 Feed-Ins';

update services
   set name = 'Sleek Ponytail X Small FeedIns'
 where name = 'Sleek Ponytail x Feed-Ins';

-- 2. Hair-included prices with no corresponding Acuity offering for that
-- size — remove the phantom upsell price, base price is untouched.
update services
   set hair_incl_price_pence = null,
       hair_incl_service_time_mins = null
 where name in ('Medium Miracle Knots', 'Large Miracle Knots', 'Small Lemonade Braids');

-- 3. Archive services with no matching Acuity entry in any category.
update services
   set active = false
 where name in (
   'Smedium Fulani Braids',
   'Smedium Fulani Twists',
   '18–20 Feed-Ins',
   'Medium Lemonade Braids',
   'Large Lemonade Braids'
 );
