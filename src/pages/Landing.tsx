import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/landing/Hero";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { PercentileMappingInfo } from "@/components/landing/PercentileMappingInfo";
import { TrustCards } from "@/components/landing/TrustCards";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <FeatureCards />
      <PercentileMappingInfo />
      <HowItWorks />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Landing;
