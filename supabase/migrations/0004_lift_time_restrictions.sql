-- MIRILUXE Studios — temporarily lift all morning-only time restrictions
-- Mirakle hasn't yet confirmed real per-service scheduling constraints, so
-- every service is bookable at any open-hours slot until she provides
-- accurate hours. The `morning_only` column and its enforcement in
-- lib/booking/availability.ts stay intact — this is a data change, not a
-- feature removal, so individual services can be flipped back on later via
-- the admin Services table once real constraints are known.

update services set morning_only = false;
