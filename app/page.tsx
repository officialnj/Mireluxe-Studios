import HeroSlider from '@/components/sections/HeroSlider';
import DealsSection from '@/components/home/DealsSection';
import ServicesCarousel from '@/components/sections/ServicesCarousel';
import AboutMeSection from '@/components/sections/AboutMeSection';
import ReviewsSection from '@/components/sections/ReviewsSection';
import { SHOW_HAIR_INCLUDED_CAROUSEL } from '@/components/home/featureFlags';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DbService } from '@/lib/booking/types';

export const revalidate = 3600;

export default async function HomePage() {
  const supabase = createServiceRoleClient();
  const { data: category } = await supabase
    .from('service_categories')
    .select('*')
    .eq('slug', 'trending-deals')
    .eq('active', true)
    .maybeSingle();

  const { data: deals } = category
    ? await supabase
        .from('services')
        .select('*')
        .eq('category_id', category.id)
        .eq('active', true)
        .order('sort_order', { ascending: true })
    : { data: [] };

  return (
    <>
      <HeroSlider />
      <DealsSection deals={(deals as DbService[]) ?? []} />
      {SHOW_HAIR_INCLUDED_CAROUSEL && <ServicesCarousel />}
      <AboutMeSection />
      <ReviewsSection />
    </>
  );
}
