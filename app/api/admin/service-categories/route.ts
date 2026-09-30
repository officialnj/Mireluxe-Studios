import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().trim().min(1),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'category'
  );
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ categories: data ?? [] });
}

/**
 * POST — create a new service category. Slug is auto-generated from name
 * with a numeric-suffix retry on collision, same pattern as
 * /api/admin/trending-deals (services) and /api/admin/services.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from('service_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from('service_categories')
      .insert({
        name: parsed.data.name,
        slug,
        sort_order: nextSortOrder,
        active: true,
      })
      .select('*')
      .single();

    if (!error) {
      revalidatePublicPages();
      return NextResponse.json({ category: data });
    }
    if (error.code !== '23505') return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    slug = `${baseSlug}-${attempt + 2}`; // slug collision, retry with a suffix
  }

  return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
}
