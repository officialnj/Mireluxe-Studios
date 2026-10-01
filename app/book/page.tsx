import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import BookingForm from '@/components/sections/BookingForm';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbBundle, DbBundleVariant, DbService, DbServiceCategory } from '@/lib/booking/types';

export const metadata: Metadata = {
  title: 'Book Appointment — MIRILUXE Studios',
  description:
    'Reserve your chair at MIRILUXE. Choose your style, add a bundle and pick your date that suits you.',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BookPage({
  searchParams,
}: {
  searchParams: { service?: string };
}) {
  const supabase = createServiceRoleClient();
  const [{ data: categories }, { data: services }, { data: bundles }, { data: bundleVariants }] = await Promise.all([
    supabase.from('service_categories').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('services').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('bundles').select('*').eq('active', true),
    // Unfiltered — out-of-stock variants still need to render as "Currently
    // unavailable" in the bundle catalog rather than vanishing, same as
    // /shop. The real purchasability gate is independently re-enforced
    // server-side in app/api/bookings/route.ts at submission time
    // regardless of what the client was shown.
    supabase.from('bundle_variants').select('*'),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Book Appointment"
        title="Reserve your chair"
        intro="Select your style, add a bundle if you need one, and choose a time that suits you. A deposit secures your slot."
      />
      <BookingForm
        categories={(categories as DbServiceCategory[]) ?? []}
        services={(services as DbService[]) ?? []}
        bundles={(bundles as DbBundle[]) ?? []}
        bundleVariants={(bundleVariants as DbBundleVariant[]) ?? []}
        initialServiceSlug={searchParams.service}
      />
    </>
  );
}
