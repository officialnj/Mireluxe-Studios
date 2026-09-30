-- MIRILUXE Studios — fix internal placeholder text leaking onto public cards
-- 0009 stored internal "this duration is a placeholder, needs Mirakle's
-- confirmation" tracking notes in services.note for the 3 new Trending Deals
-- rows. components/home/DealsSection.tsx renders `note` directly on the
-- public homepage card (it's meant for genuine customer-facing prep copy,
-- e.g. "Hair must be clean and free of oils"), so those internal notes were
-- incorrectly visible to real customers. The placeholder-duration tracking
-- itself is preserved in 0009's migration header comment and in the GATE 1
-- report — this migration only clears the customer-facing field. Idempotent.
update services
   set note = null
 where slug in (
   'trending-small-mirakle-knots',
   'trending-medium-boho-knotless',
   'trending-4-stitch-braids-sewin'
 )
   and note like 'PLACEHOLDER duration%';
