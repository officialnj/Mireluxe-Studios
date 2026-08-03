import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import BookingForm from '@/components/sections/BookingForm';

export const metadata: Metadata = {
  title: 'Book Appointment — MIRILUXE Studios',
  description:
    'Reserve your chair at MIRILUXE. Choose your style, add a bundle and pick your date — new slots release on the 20th of each month.',
};

export default function BookPage() {
  return (
    <>
      <PageHero
        eyebrow="Book Appointment"
        title="Reserve your chair"
        intro="Select your style, add a bundle if you need one, and choose a time that suits you. A deposit secures your slot."
      />
      <BookingForm />
    </>
  );
}
