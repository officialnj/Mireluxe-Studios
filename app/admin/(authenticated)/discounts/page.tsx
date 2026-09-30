import { createServiceRoleClient } from '@/lib/supabase/server';
import DiscountCodesManager from '@/components/admin/DiscountCodesManager';
import type { DbDiscountCode } from '@/lib/shop/types';

export const dynamic = 'force-dynamic';

export default async function AdminDiscountsPage() {
  const supabase = createServiceRoleClient();
  const { data: discountCodes } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Discount Codes</h1>
      <p className="mb-6 text-sm text-cream/60">
        Create and manage shop discount codes. Codes are matched case-insensitively at checkout. There is no
        delete — an unwanted code is switched off instead.
      </p>
      <DiscountCodesManager initialCodes={(discountCodes as DbDiscountCode[] | null) ?? []} />
    </div>
  );
}
