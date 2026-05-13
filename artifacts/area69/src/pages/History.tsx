import React, { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import type { Generation } from "@/lib/store";

type Filter = "all" | "image" | "video";

const ITEMS_PER_PAGE = 20;

function timeAgo(ts: number, t: (key: string) => string): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("history.justNow");
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function History() {
  const { state } = useStore();
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [selected, setSelected] = useState<Generation | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const allGenerations = state.generations;

  const modelNames = useMemo(() => {
    return [...new Set(allGenerations.map((g) => g.modelName))];
  }, [allGenerations]);

  const filtered = useMemo(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    return allGenerations
      .filter((g) => filter === "all" || g.type === filter)
      .filter((g) => modelFilter === "all" || g.modelName === modelFilter)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allGenerations, filter, modelFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const counts = useMemo(() => ({
    all:   allGenerations.length,
    image: allGenerations.filter((g) => g.type === "image").length,
    video: allGenerations.filter((g) => g.type === "video").length,
  }), [allGenerations]);

  return (
    <DashboardLayout title={t("history.title")} subtitle={t("history.subtitle")}>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {(["all", "image", "video"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 min-h-[44px] text-xs font-black uppercase tracking-widest transition-colors ${
                filter === f
                  ? "bg-[#C0001A] text-white"
                  : "bg-white border border-black/10 text-black/40 hover:text-black hover:border-black/25"
              }`}
            >
              {f === "all"
                ? `${t("history.all")} (${counts.all})`
                : f === "image"
                ? `${t("history.images")} (${counts.image})`
                : `${t("history.videos")} (${counts.video})`}
            </button>
          ))}
        </div>

        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="ml-auto bg-white border border-black/10 text-xs font-black uppercase tracking-widest text-black/50 px-3 min-h-[44px] outline-none cursor-pointer hover:border-black/25 transition-colors"
        >
          <option value="all">{t("history.allModels")}</option>
          {modelNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-black/5 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-black/25">{t("history.empty")}</p>
          <p className="text-xs text-black/20 font-medium mt-1">{t("history.emptyDesc")}</p>
        </div>
      ) : (
        <>
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            <AnimatePresence>
              {visible.map((gen, i) => (
                <motion.div
                  key={gen.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  className="break-inside-avoid group cursor-pointer relative bg-black/5 overflow-hidden"
                  onClick={() => setSelected(gen)}
                >
                  {gen.type === "image" ? (
                    <img
                      src={gen.url}
                      alt={gen.prompt}
                      className="w-full object-cover block group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-gen.svg";
                      }}
                    />
                  ) : (
                    <video
                      src={gen.url}
                      className="w-full block group-hover:scale-105 transition-transform duration-300"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLVideoElement).play().catch(() => {});
                      }}
                      onMouseLeave={(e) => {
                        const v = e.currentTarget as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                    <p className="text-[10px] text-white/90 font-medium leading-snug line-clamp-2">{gen.prompt}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-white/50 font-bold">{gen.modelName}</span>
                      <span className="text-[9px] text-white/50 font-bold">{timeAgo(gen.createdAt, t)}</span>
                    </div>
                  </div>

                  <div className={`absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    gen.type === "video" ? "bg-[#C0001A] text-white" : "bg-black/40 text-white"
                  }`}>
                    {gen.type === "video" ? t("history.videoTag") : t("history.imageTag")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
                className="border-2 border-black/10 text-black/40 px-8 min-h-[48px] text-xs font-black uppercase tracking-widest hover:border-[#C0001A] hover:text-[#C0001A] transition-colors"
              >
                {t("history.loadMore")} ({filtered.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative max-w-2xl w-full bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              {selected.type === "image" ? (
                <img
                  src={selected.url}
                  alt={selected.prompt}
                  className="w-full max-h-[70vh] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-gen.svg";
                  }}
                />
              ) : (
                <video
                  src={selected.url}
                  className="w-full max-h-[70vh]"
                  autoPlay
                  loop
                  muted={false}
                  controls
                  onError={() => {}}
                />
              )}

              <div className="bg-[#111] px-5 py-4">
                <p className="text-xs text-white/70 font-medium leading-snug">{selected.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ${
                      selected.type === "video" ? "bg-[#C0001A] text-white" : "bg-white/10 text-white/60"
                    }`}>
                      {selected.type === "video" ? t("history.videoTag") : t("history.imageTag")}
                    </span>
                    <span className="text-[10px] text-white/30 font-bold">{selected.modelName}</span>
                    <span className="text-[10px] text-white/30 font-bold">{timeAgo(selected.createdAt, t)}</span>
                  </div>
                  <a
                    href={selected.url}
                    download
                    className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("history.download")}
                  </a>
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 w-7 h-7 bg-black/60 text-white text-xs flex items-center justify-center hover:bg-[#C0001A] transition-colors"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
