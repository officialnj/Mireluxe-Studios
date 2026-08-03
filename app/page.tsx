import HeroSlider from '@/components/sections/HeroSlider';
import DealsSection from '@/components/sections/DealsSection';
import ServicesCarousel from '@/components/sections/ServicesCarousel';
import AboutMeSection from '@/components/sections/AboutMeSection';
import ReviewsSection from '@/components/sections/ReviewsSection';

export default function HomePage() {
  return (
    <>
      <HeroSlider />
      <DealsSection />
      <ServicesCarousel />
      <AboutMeSection />
      <ReviewsSection />
    </>
  );
}
