import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useI18n } from "@/lib/I18nContext";

export default function CollageHero() {
  const { t } = useI18n();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
  };

  const photoVariants = {
    hidden: { opacity: 0, scale: 0.8, rotate: 0 },
    visible: (custom: number) => ({
      opacity: 1,
      scale: 1,
      rotate: custom,
      transition: { type: "spring" as const, stiffness: 80, delay: 0.4 }
    })
  };

  const pills = ["Geração de Imagem & Vídeo", "Modelos sem Censura", "Geração assíncrona", "Histórico com expiração"];

  return (
    <section className="relative w-full min-h-screen pt-40 md:pt-48 pb-24 overflow-hidden flex items-center bg-[#C0001A]">
      <div className="max-w-[1600px] mx-auto w-full px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center relative z-10">

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-10 max-w-2xl"
        >
          <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] uppercase text-white">
            {t("collageHero.headline")} <br />
            <span className="relative inline-block">
              <span className="relative z-10 font-cursive lowercase">{t("collageHero.model")}</span>
              <span className="absolute bottom-2 left-0 w-full h-4 bg-white/30 -z-10 -rotate-1 origin-left" />
            </span> <br />
            {t("collageHero.ultraRealistic")}
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-white/80 font-medium leading-relaxed max-w-xl">
            {t("collageHero.desc")}
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap gap-4 items-center">
            <Link href="/sign-up" className="bg-white text-[#C0001A] px-10 py-5 font-bold uppercase tracking-widest text-sm hover:bg-red-50 transition-all flex items-center justify-center">
              {t("collageHero.startNow")}
            </Link>
            <Link href="/sign-in" className="text-white border border-white/60 hover:bg-white/10 px-10 py-5 font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center">
              {t("collageHero.haveAccount")}
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-wrap gap-2 mt-4">
            {pills.map((pill, i) => (
              <div key={i} className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white">
                {pill}
              </div>
            ))}
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 p-6 bg-white/15 border-l-4 border-white text-white shadow-xl relative max-w-md rotate-1">
            <div className="absolute -top-3 -left-3 w-8 h-8 bg-white rotate-12 flex items-center justify-center text-[#C0001A] text-sm font-black shadow-sm">★</div>
            <h4 className="font-bold uppercase tracking-widest text-xs mb-2">{t("collageHero.proTipLabel")}</h4>
            <p className="text-sm font-medium text-white/80 leading-relaxed">
              {t("collageHero.proTipText")}
            </p>
          </motion.div>
        </motion.div>

        <div className="relative h-[600px] lg:h-[800px] w-full mt-12 lg:mt-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute top-8 right-8 z-50 bg-white text-[#C0001A] px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg"
          >
            {t("collageHero.badge")}
          </motion.div>

          <motion.div custom={-6} variants={photoVariants} initial="hidden" animate="visible" className="absolute top-12 left-4 md:left-12 p-3 pb-12 bg-white shadow-2xl border border-white/20 w-[240px] md:w-[300px] z-20 group hover:z-50">
            <div className="w-full aspect-[3/4] bg-red-100 relative overflow-hidden">
              <img src="/images/polaroid-1.png" alt="Editorial 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">{t("collageHero.polaroidLabel")}</p>
            </div>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-white/60 border border-white/30 -rotate-3 shadow-sm" />
          </motion.div>

          <motion.div custom={8} variants={photoVariants} initial="hidden" animate="visible" className="absolute top-48 right-4 md:right-12 p-3 pb-12 bg-white shadow-2xl border border-white/20 w-[260px] md:w-[320px] z-30 group hover:z-50">
            <div className="w-full aspect-[3/4] bg-red-100 relative overflow-hidden">
              <img src="/images/polaroid-2.png" alt="Editorial 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">{t("collageHero.polaroidLabel")}</p>
            </div>
            <div className="absolute -top-4 right-8 w-16 h-5 bg-white/60 border border-white/30 rotate-12 shadow-sm" />
          </motion.div>

          <motion.div custom={-4} variants={photoVariants} initial="hidden" animate="visible" className="absolute bottom-12 left-16 md:left-32 p-3 pb-12 bg-white shadow-2xl border border-white/20 w-[220px] md:w-[280px] z-40 group hover:z-50">
            <div className="w-full aspect-[3/4] bg-red-100 relative overflow-hidden">
              <img src="/images/polaroid-3.png" alt="Editorial 3" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/40">{t("collageHero.polaroidLabel")}</p>
            </div>
            <div className="absolute top-1/2 -left-4 w-12 h-6 bg-white/60 border border-white/30 -rotate-45 shadow-sm" />
          </motion.div>

          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/4 z-50 select-none pointer-events-none rotate-12"
          >
            <img src="/emoji-drool.png" alt="" className="w-16 drop-shadow-xl" style={{ mixBlendMode: "screen" }} />
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-1/3 right-1/4 z-50 select-none pointer-events-none -rotate-12"
          >
            <img src="/emoji-hot.png" alt="" className="w-16 drop-shadow-2xl" style={{ mixBlendMode: "screen" }} />
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-12 left-1/2 z-10 select-none pointer-events-none"
          >
            <img src="/emoji-18.png" alt="" className="w-14 drop-shadow-md" style={{ mixBlendMode: "screen" }} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
