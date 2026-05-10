import React, { useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import { api } from "@/lib/api";

const PACKS = [
  {
    id: "p50",
    credits: 50,
    price: 29,
    priceLabel: "R$ 29",
    perCredit: "R$ 0,58",
    color: "border-zinc-300",
  },
  {
    id: "p150",
    credits: 150,
    price: 79,
    priceLabel: "R$ 79",
    perCredit: "R$ 0,53",
    color: "border-zinc-300",
  },
  {
    id: "p300",
    credits: 300,
    price: 139,
    priceLabel: "R$ 139",
    perCredit: "R$ 0,46",
    popular: true,
    color: "border-[#C0001A]",
  },
  {
    id: "p600",
    credits: 600,
    price: 249,
    priceLabel: "R$ 249",
    perCredit: "R$ 0,42",
    color: "border-zinc-300",
  },
];

export default function Billing() {
  const { state } = useStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(credits: number, packId: string) {
    if (loading) return;
    setLoading(packId);
    setError(null);

    try {
      const { url } = await api.checkout.stripe({ credits });
      window.location.href = url;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao iniciar checkout";
      setError(msg);
      setLoading(null);
    }
  }

  return (
    <DashboardLayout title={t("billing.title")} subtitle={t("billing.subtitle")}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-black uppercase tracking-tighter text-black mb-2">
            {t("billing.title")}
          </h2>
          <p className="text-sm text-black/40 font-medium">
            {t("billing.subtitle")}
          </p>
        </motion.div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 max-w-lg mx-auto"
          >
            <span className="text-red-400 text-sm">⚠</span>
            <p className="text-[10px] text-red-700 font-medium flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-500 text-xs font-black"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Pricing grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {PACKS.map((pack, i) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative bg-white border-2 ${pack.color} ${
                pack.popular ? "shadow-lg shadow-[#C0001A]/10" : ""
              } p-5 flex flex-col`}
            >
              {/* Popular badge */}
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C0001A] text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 whitespace-nowrap">
                  {t("billing.popular")}
                </div>
              )}

              {/* Credits amount */}
              <div className="text-center mb-3">
                <p className="text-3xl font-black text-black leading-none">
                  {pack.credits}
                </p>
                <p className="text-[9px] font-bold text-black/40 uppercase tracking-wide mt-0.5">
                  créditos
                </p>
              </div>

              {/* Price */}
              <div className="text-center mb-5">
                <p className="text-xl font-black text-black">
                  {pack.priceLabel}
                </p>
                <p className="text-[9px] text-black/30 font-medium">
                  {pack.perCredit}
                  {t("billing.perCredit")}
                </p>
              </div>

              {/* Features (compact) */}
              <ul className="flex-1 space-y-1.5 mb-5 text-[9px] text-black/50 font-medium">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#C0001A] text-[8px] mt-0.5 flex-shrink-0">✓</span>
                  Geração de imagens
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#C0001A] text-[8px] mt-0.5 flex-shrink-0">✓</span>
                  Geração de vídeos
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#C0001A] text-[8px] mt-0.5 flex-shrink-0">✓</span>
                  Soul ID training
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#C0001A] text-[8px] mt-0.5 flex-shrink-0">✓</span>
                  Não expiram
                </li>
              </ul>

              {/* Buy button */}
              <button
                onClick={() => handleBuy(pack.credits, pack.id)}
                disabled={loading !== null}
                className={`w-full py-3 text-[11px] font-black uppercase tracking-widest transition-all ${
                  pack.popular
                    ? "bg-[#C0001A] text-white hover:bg-[#a00015]"
                    : "bg-black text-white hover:bg-[#C0001A]"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === pack.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("billing.buying")}
                  </span>
                ) : (
                  t("billing.buy")
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Security notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs">🔒</span>
            <p className="text-[9px] font-black uppercase tracking-widest text-black/30">
              {t("billing.secure")}
            </p>
          </div>
          <p className="text-[9px] text-black/25 font-medium leading-relaxed">
            {t("billing.secureDesc")}
          </p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
