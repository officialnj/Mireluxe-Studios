-- MIRILUXE Studios — admin Checkout Center balance tracking
--
-- Deposits are taken online at booking time; the remaining balance is settled
-- in the studio (cash/card) on the day. The new admin "Checkout" tab lists
-- upcoming appointments with a balance owing and lets Mirakle mark the balance
-- as collected. These columns record that so a settled appointment drops off
-- the "to collect" list.
--
-- Additive (deletion-lock convention).
alter table bookings add column if not exists balance_collected_at timestamptz;
alter table bookings add column if not exists balance_payment_method text;

comment on column bookings.balance_collected_at is
  'Set when the remaining balance (total - deposit) was collected in-studio via the admin Checkout tab. Null = still owing.';
comment on column bookings.balance_payment_method is
  'How the remaining balance was collected (cash/card), set alongside balance_collected_at.';
