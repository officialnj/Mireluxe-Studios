import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

/**
 * DELETE — remove a slot override. Deleting a 'blocked' row re-opens that
 * default start time; deleting an 'open' row removes the extra start time.
 * This is a normal data-management action on an admin-managed exceptions
 * table (same pattern as /api/admin/blocked-dates/[id]), not a "supersede a
 * feature" deletion — the deletion lock does not apply to it.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('slot_overrides').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
