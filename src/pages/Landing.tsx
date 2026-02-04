import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TrustCards } from "@/components/landing/TrustCards";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Footer } from "@/components/landing/Footer";

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <TrustCards />
      <HowItWorks />
      <Footer />
    </div>
  );
};

export default Landing;
