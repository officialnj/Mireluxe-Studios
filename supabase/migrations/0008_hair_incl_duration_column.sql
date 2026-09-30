-- MIRILUXE Studios — hair-included duration override
-- Several real hair-included durations differ from the without-hair duration
-- (sometimes longer, e.g. Small Knotless 10h base / 12h hair-included;
-- sometimes shorter, e.g. Medium Knotless Twist 6h base / 5h hair-included —
-- confirmed correct by the client, not a data error). Null means "same as
-- service_time_mins", the same fallback convention hair_incl_price_pence
-- already uses against base_price_pence. Idempotent: safe to re-run.
alter table services
  add column if not exists hair_incl_service_time_mins integer;

comment on column services.hair_incl_service_time_mins is
  'Appointment length when hair is included, only set when it differs from service_time_mins. Null falls back to service_time_mins. Sourced from the live Acuity "Hair Included Styles"/"Boho" category durations — see data/services.json.';
