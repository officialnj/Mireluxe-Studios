import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const BUCKET = 'product-media';

/**
 * DELETE — remove a bundle_media row AND its underlying Storage object(s).
 * Storage is deleted first; if that fails we bail out without touching the
 * DB row, so a failed storage delete never orphans a DB row that points at
 * a file we couldn't actually remove (the inverse — deleting the DB row
 * first — could orphan the file in Storage forever with no row to clean it
 * up from).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();

  const { data: row, error: fetchError } = await supabase
    .from('bundle_media')
    .select('storage_path, poster_storage_path')
    .eq('id', params.id)
    .single();

  if (fetchError || !row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const paths = [row.storage_path, row.poster_storage_path].filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) return NextResponse.json({ error: 'storage_delete_failed' }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from('bundle_media').delete().eq('id', params.id);
  if (deleteError) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
