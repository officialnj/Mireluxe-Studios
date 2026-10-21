import { createServiceRoleClient } from '@/lib/supabase/server';
import GalleryManager, { type GalleryImage } from '@/components/admin/GalleryManager';

export const dynamic = 'force-dynamic';

export default async function AdminGalleryPage() {
  const supabase = createServiceRoleClient();
  const { data: images } = await supabase
    .from('gallery_images')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Gallery</h1>
      <p className="mb-6 text-sm text-charcoal/60">
        Upload and remove images shown on the public Gallery page. Uploaded images appear first, ahead of the
        existing studio portfolio.
      </p>
      <GalleryManager initialImages={(images as GalleryImage[]) ?? []} />
    </div>
  );
}
