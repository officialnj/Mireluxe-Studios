import { createServiceRoleClient } from '@/lib/supabase/server';
import OrdersManager from '@/components/admin/OrdersManager';
import type { DbShopOrder } from '@/lib/shop/types';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const supabase = createServiceRoleClient();
  const { data: orders } = await supabase
    .from('shop_orders')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-light">Orders</h1>
      <OrdersManager initialOrders={(orders ?? []) as DbShopOrder[]} />
    </div>
  );
}
