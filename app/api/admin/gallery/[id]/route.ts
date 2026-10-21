import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const BUCKET = 'product-media';

/**
 * DELETE — remove a gallery_images row AND its underlying Storage object.
 * Storage is deleted first (mirrors bundle-media): a failed storage delete
 * bails out before touching the DB row so we never orphan a file in Storage.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchError } = await supabase
    .from('gallery_images')
    .select('storage_path')
    .eq('id', params.id)
    .single();

  if (fetchError || !row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
  if (storageError) return NextResponse.json({ error: 'storage_delete_failed' }, { status: 500 });

  const { error: deleteError } = await supabase.from('gallery_images').delete().eq('id', params.id);
  if (deleteError) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
