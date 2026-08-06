import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import BookingForm from '@/components/sections/BookingForm';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbBundleVariant, DbService, DbServiceCategory } from '@/lib/booking/types';

export const metadata: Metadata = {
  title: 'Book Appointment — MIRILUXE Studios',
  description:
    'Reserve your chair at MIRILUXE. Choose your style, add a bundle and pick your date — new slots release on the 20th of each month.',
};

export const dynamic = 'force-dynamic';

export default async function BookPage() {
  const supabase = createServiceRoleClient();
  const [{ data: categories }, { data: services }, { data: bundleVariants }] = await Promise.all([
    supabase.from('service_categories').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('services').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('bundle_variants').select('*').eq('in_stock', true),
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
        bundleVariants={(bundleVariants as DbBundleVariant[]) ?? []}
      />
    </>
  );
}
