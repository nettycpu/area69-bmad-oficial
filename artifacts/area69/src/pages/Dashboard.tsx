import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";

export default function Dashboard() {
  const { state } = useStore();
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  const totalImages = state.generations.filter((g) => g.type === "image").length;
  const totalVideos = state.generations.filter((g) => g.type === "video").length;
  const readyModels = state.models.filter((m) => m.status === "ready").length;
  const trainingModels = state.models.length - readyModels;

  return (
    <DashboardLayout title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>

      {state.credits === 0 && state.models.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#C0001A] text-white p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-black uppercase tracking-tight">{t("dashboard.banner.title")}</p>
            <p className="text-xs text-white/70 font-medium mt-0.5">{t("dashboard.banner.desc")}</p>
          </div>
          <button
            onClick={() => setLocation("/dashboard/checkout")}
            className="bg-white text-[#C0001A] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors flex-shrink-0"
          >
            {t("dashboard.banner.cta")}
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          {
            label: t("dashboard.stats.readyModels"),
            value: readyModels,
            sub: trainingModels > 0 ? t("dashboard.stats.inTraining", { n: trainingModels }) : t("dashboard.stats.noModels"),
          },
          { label: t("dashboard.stats.imagesGenerated"), value: totalImages, sub: t("dashboard.stats.total") },
          { label: t("dashboard.stats.videosGenerated"), value: totalVideos, sub: t("dashboard.stats.total") },
          { label: t("dashboard.stats.credits"), value: state.credits, sub: t("dashboard.stats.available") },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white border border-black/8 p-5"
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-2">{s.label}</p>
            <p className={`text-3xl font-black leading-none ${s.value === 0 ? "text-black/20" : "text-black"}`}>
              {s.value}
            </p>
            <p className="text-[10px] text-black/40 font-medium mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">{t("dashboard.quickActions.title")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: "◈",
              label: t("dashboard.quickActions.train"),
              desc: t("dashboard.quickActions.trainDesc"),
              color: "bg-[#C0001A]",
              href: "/dashboard/models",
            },
            {
              icon: "✦",
              label: t("dashboard.quickActions.generate"),
              desc: readyModels > 0 ? t("dashboard.quickActions.generateDesc") : t("dashboard.quickActions.generateLocked"),
              color: readyModels > 0 ? "bg-black" : "bg-black/30",
              href: "/dashboard/generate",
            },
            {
              icon: "▷",
              label: t("dashboard.quickActions.video"),
              desc: readyModels > 0 ? t("dashboard.quickActions.videoDesc") : t("dashboard.quickActions.generateLocked"),
              color: readyModels > 0 ? "bg-black" : "bg-black/30",
              href: "/dashboard/video",
            },
          ].map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <Link
                href={a.href}
                className={`${a.color} text-white p-5 text-left hover:opacity-90 transition-opacity group flex flex-col w-full`}
              >
                <span className="text-2xl leading-none block mb-3 group-hover:scale-110 transition-transform">{a.icon}</span>
                <p className="text-sm font-black uppercase tracking-tight">{a.label}</p>
                <p className="text-[10px] text-white/60 font-medium mt-1">{a.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mb-8 block relative overflow-hidden bg-[#0a0a0a] opacity-60 cursor-default select-none"
      >
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-[#C0001A]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-56 h-56 bg-[#25D366]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-[#25D366] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <span className="absolute -inset-1 border border-[#25D366]/40 animate-ping rounded-sm pointer-events-none" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-white text-sm font-black uppercase tracking-tight">{t("dashboard.whatsapp.title")}</p>
                <span className="text-[7px] font-black uppercase tracking-widest text-[#25D366] border border-[#25D366]/40 px-1.5 py-0.5 leading-none">{t("dashboard.whatsapp.badge")}</span>
              </div>
              <p className="text-white/40 text-[10px] font-medium leading-snug">
                {t("dashboard.whatsapp.desc")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest">{t("dashboard.whatsapp.active")}</span>
            </div>
            <div className="bg-black/40 text-white/50 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10">
              Em breve
            </div>
          </div>
        </div>

        <div className="h-0.5 w-full bg-gradient-to-r from-[#C0001A] via-[#25D366] to-transparent opacity-30" />
      </motion.div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("dashboard.myModels.title")}</p>
          <Link href="/dashboard/models" className="text-[10px] font-black uppercase tracking-widest text-[#C0001A] hover:underline">
            {t("dashboard.myModels.viewAll")}
          </Link>
        </div>

        {state.models.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-black/10">
            <span className="text-4xl mb-3 opacity-10">◈</span>
            <p className="text-xs font-black uppercase tracking-widest text-black/30">{t("dashboard.myModels.empty")}</p>
            <p className="text-[11px] text-black/25 font-medium mt-1 max-w-xs">{t("dashboard.myModels.emptyDesc")}</p>
            <Link
              href="/dashboard/models"
              className="mt-5 bg-[#C0001A] text-white px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors"
            >
              {t("dashboard.myModels.trainFirst")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {state.models.slice(0, 3).map((model, i) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="bg-white border border-black/8 overflow-hidden group cursor-pointer hover:border-[#C0001A] transition-colors"
              >
                <div className="aspect-[4/3] bg-black/5 relative overflow-hidden">
                  {model.cover ? (
                    <img src={model.cover} alt={model.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="text-3xl opacity-20">◈</div>
                    </div>
                  )}
                  {model.status === "training" && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 p-4">
                      <p className="text-white text-[10px] font-black uppercase tracking-widest">{t("dashboard.myModels.training")}</p>
                      <div className="w-full h-1.5 bg-white/20">
                        <div className="h-full bg-[#C0001A]" style={{ width: `${model.progress}%` }} />
                      </div>
                      <p className="text-white/60 text-[10px] font-bold">{model.progress}{t("models.progress")}</p>
                    </div>
                  )}
                  {model.status === "ready" && (
                    <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-black">{t("dashboard.myModels.ready")}</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-black uppercase tracking-tight text-black">{model.name}</p>
                  <p className="text-[10px] text-black/40 font-medium mt-0.5">{model.imagesGenerated} {t("dashboard.myModels.images")}</p>
                  {model.status === "ready" && (
                    <button
                      onClick={() => setLocation("/dashboard/generate")}
                      className="mt-3 w-full bg-[#C0001A] text-white py-2 text-[9px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
                      {t("dashboard.myModels.useModel")}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/40">{t("dashboard.recent.title")}</p>
          <Link href="/dashboard/history" className="text-[10px] font-black uppercase tracking-widest text-[#C0001A] hover:underline">
            {t("dashboard.recent.viewHistory")}
          </Link>
        </div>

        {state.generations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-black/10">
            <span className="text-4xl mb-3 opacity-10">✦</span>
            <p className="text-xs font-black uppercase tracking-widest text-black/30">{t("dashboard.recent.empty")}</p>
            <p className="text-[11px] text-black/25 font-medium mt-1 max-w-xs">{t("dashboard.recent.emptyDesc")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {state.generations.slice(0, 8).map((gen, i) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                className="aspect-square bg-black/5 overflow-hidden relative group cursor-pointer"
              >
                <img src={gen.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <a
                    href={gen.url}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white text-black text-[9px] font-black uppercase tracking-widest px-3 py-1.5 hover:bg-[#C0001A] hover:text-white transition-colors"
                  >
                    {t("dashboard.recent.download")}
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </DashboardLayout>
  );
}
