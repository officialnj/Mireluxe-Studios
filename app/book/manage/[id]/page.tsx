import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageHero from '@/components/ui/PageHero';
import ManageBookingClient from '@/components/booking/ManageBookingClient';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbBooking, DbService } from '@/lib/booking/types';

export const metadata: Metadata = {
  title: 'Manage Booking — MIRILUXE Studios',
  description: 'View, reschedule or cancel your MIRILUXE Studios appointment.',
};

export const dynamic = 'force-dynamic';

// The booking id in the URL is an unguessable capability token, same pattern
// as Agent B's GET/POST /api/bookings/[id]/{status,reschedule,cancel}
// routes — knowledge of the id is the only authorization check, so this page
// deliberately never lists bookings or accepts any other lookup key. Reads
// happen server-side via the service-role client (never exposed to the
// browser); the client component below only ever calls the existing
// capability-token API routes for mutations.
export default async function ManageBookingPage({ params }: { params: { id: string } }) {
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', params.id).maybeSingle();

  if (!booking) {
    notFound();
  }

  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', (booking as DbBooking).service_id)
    .maybeSingle();

  return (
    <>
      <PageHero
        eyebrow="Manage Booking"
        title="Your appointment"
        intro={`Reference ${(booking as DbBooking).booking_ref}`}
      />
      <ManageBookingClient booking={booking as DbBooking} service={(service as DbService) ?? null} />
    </>
  );
}
