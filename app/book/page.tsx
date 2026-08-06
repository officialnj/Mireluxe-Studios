import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import BookingForm from '@/components/sections/BookingForm';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbBundle, DbService } from '@/lib/booking/types';

export const metadata: Metadata = {
  title: 'Book Appointment — MIRILUXE Studios',
  description:
    'Reserve your chair at MIRILUXE. Choose your style, add a bundle and pick your date — new slots release on the 20th of each month.',
};

export const dynamic = 'force-dynamic';

export default async function BookPage() {
  const supabase = createServiceRoleClient();
  const [{ data: services }, { data: bundles }] = await Promise.all([
    supabase.from('services').select('*').eq('active', true).order('sort_order', { ascending: true }),
    supabase.from('bundles').select('*').eq('active', true),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Book Appointment"
        title="Reserve your chair"
        intro="Select your style, add a bundle if you need one, and choose a time that suits you. A deposit secures your slot."
      />
      <BookingForm services={(services as DbService[]) ?? []} bundles={(bundles as DbBundle[]) ?? []} />
    </>
  );
}
