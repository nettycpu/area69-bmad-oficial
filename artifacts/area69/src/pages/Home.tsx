import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import CollageHero from "@/components/landing/CollageHero";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import GallerySection from "@/components/landing/GallerySection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import CallToActionSection from "@/components/landing/CallToActionSection";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import VideoSection from "@/components/landing/VideoSection";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/I18nContext";

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen w-full relative bg-background overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex justify-between items-center bg-white/95 backdrop-blur-sm border-b border-black/10">
        <Link href="/" className="flex items-center gap-3 group cursor-pointer text-black">
          <img src="/logo.png" alt="AREA 69" className="h-10 w-10 object-contain" style={{ mixBlendMode: "multiply" }} />
          <div className="flex flex-col">
            <span className="font-bold text-xl leading-none tracking-tighter text-black">AREA 69</span>
            <span className="text-[10px] uppercase tracking-widest text-black/50 font-bold">AI Models Studio</span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 md:gap-8">
          <Link href="/sign-in" className="text-xs font-bold uppercase tracking-widest text-black/60 hover:text-black transition-colors hidden sm:block cursor-pointer">
            {t("home.signIn")}
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-none bg-[#C0001A] text-white hover:bg-red-700 uppercase text-xs tracking-widest px-6 h-12 font-bold cursor-pointer">
              {t("home.createAccount")}
            </Button>
          </Link>
        </nav>
      </header>

      <main className="w-full">
        <CollageHero />
        <ShowcaseSection />
        <GallerySection />
        <VideoSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <CallToActionSection />
      </main>

      <footer className="w-full bg-[#C0001A] text-white p-12 md:p-24 text-center border-t-[12px] border-white">
        <div className="flex flex-col items-center gap-6">
          <img src="/logo.png" alt="AREA 69" className="h-12 w-12 object-contain" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">
            {t("home.footer")}
          </p>
        </div>
      </footer>
    </div>
  );
}
