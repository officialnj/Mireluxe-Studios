-- MIRILUXE Studios — data fix: Italian Curls was marked in_stock=true while
-- stock_quantity is genuinely 0 (admin toggle without matching quantity).
-- Client confirmed via chat: restore the intended out-of-stock state from
-- its original seed (0011_qa_fixes.sql).
update bundle_variants
   set in_stock = false
 where stock_quantity = 0
   and in_stock = true;
