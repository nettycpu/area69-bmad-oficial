import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";

const PACKS = [
  { id: "p50",  credits: 50,  price: 29,  priceLabel: "R$ 29",  perCredit: "R$ 0,58/crédito" },
  { id: "p150", credits: 150, price: 79,  priceLabel: "R$ 79",  perCredit: "R$ 0,53/crédito" },
  { id: "p300", credits: 300, price: 139, priceLabel: "R$ 139", perCredit: "R$ 0,46/crédito", best: true },
  { id: "p600", credits: 600, price: 249, priceLabel: "R$ 249", perCredit: "R$ 0,42/crédito" },
];

type Step = "select" | "pix" | "done";

function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function generatePixCode(credits: number, price: number, orderId: string): string {
  const amount = price.toFixed(2);
  const txid = `area69-${credits}cred`.slice(0, 25);
  const payload =
    `00020101021226830014br.gov.bcb.pix` +
    `0136${orderId}` +
    `52040000` +
    `5303986` +
    `54${String(amount.length).padStart(2, "0")}${amount}` +
    `5802BR` +
    `5920AREA69 STUDIO LTDA` +
    `6009SAO PAULO` +
    `6219` + String("0515" + txid).padStart(4 + txid.length, "0").slice(0, 4) + txid +
    `6304`;
  return payload + crc16ccitt(payload);
}

function makeOrderId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function Checkout() {
  const { t, tArr } = useI18n();
  const { addCredits } = useStore();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<(typeof PACKS)[0]>(PACKS[2]);
  const [orderId] = useState(makeOrderId);
  const [pixCode, setPixCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(15 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (selected) {
      setPixCode(generatePixCode(selected.credits, selected.price, orderId));
    }
  }, [selected, orderId]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [timerActive]);

  const minutes = String(Math.floor(countdown / 60)).padStart(2, "0");
  const seconds = String(countdown % 60).padStart(2, "0");

  function handleContinue() {
    setStep("pix");
    setTimerActive(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const handleConfirm = useCallback(() => {
    addCredits(selected.credits);
    setStep("done");
    setTimerActive(false);
  }, [addCredits, selected]);

  return (
    <DashboardLayout title={t("checkout.title")} subtitle={t("checkout.subtitle")}>
      <div className="max-w-2xl mx-auto">

        {/* Progress bar */}
        <div className="flex items-center gap-0 mb-8">
          {(["select", "pix", "done"] as Step[]).map((s, i) => {
            const labels = [t("checkout.step1"), t("checkout.step2"), t("checkout.step3")];
            const active = step === s;
            const past = (step === "pix" && s === "select") || (step === "done" && s !== "done");
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 flex items-center justify-center text-[10px] font-black transition-colors ${
                    past ? "bg-[#C0001A] text-white" :
                    active ? "bg-black text-white" :
                    "bg-black/10 text-black/30"
                  }`}>
                    {past ? "✓" : i + 1}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
                    active ? "text-black" : past ? "text-[#C0001A]" : "text-black/25"
                  }`}>{labels[i]}</span>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-px mx-1 mb-5 transition-colors ${past || (step === "done" && i <= 1) ? "bg-[#C0001A]" : "bg-black/10"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: SELECT PACK ── */}
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-5">
                {t("checkout.choosePack")}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
                {PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelected(pack)}
                    className={`relative p-4 text-left border-2 transition-all ${
                      selected.id === pack.id
                        ? "border-[#C0001A] bg-white"
                        : "border-black/10 bg-white hover:border-black/25"
                    }`}
                  >
                    {pack.best && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#C0001A] text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 whitespace-nowrap">
                        {t("checkout.bestValue")}
                      </span>
                    )}
                    <p className={`text-xl font-black leading-none mb-0.5 ${selected.id === pack.id ? "text-[#C0001A]" : "text-black"}`}>
                      {pack.credits}
                    </p>
                    <p className="text-[8px] font-bold text-black/40 uppercase tracking-wide mb-3">{t("checkout.credits")}</p>
                    <p className={`text-base font-black ${selected.id === pack.id ? "text-black" : "text-black/70"}`}>
                      {pack.priceLabel}
                    </p>
                    <p className="text-[7px] text-black/30 font-medium mt-0.5">{pack.perCredit}</p>
                    {selected.id === pack.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-[#C0001A] flex items-center justify-center">
                        <span className="text-white text-[8px] font-black">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Order summary */}
              <div className="bg-white border border-black/8 p-5 mb-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-4">{t("checkout.summary")}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-medium text-black/60">{selected.credits} {t("checkout.credits")}</span>
                  <span className="text-[10px] font-black text-black">{selected.priceLabel}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-black/8">
                  <span className="text-xs font-black text-black uppercase tracking-wide">{t("checkout.total")}</span>
                  <span className="text-xl font-black text-[#C0001A]">{selected.priceLabel}</span>
                </div>
              </div>

              <div className="bg-[#C0001A]/5 border border-[#C0001A]/15 px-4 py-3 flex items-center gap-3 mb-6">
                <span className="text-[#C0001A] text-base flex-shrink-0">⚡</span>
                <p className="text-[9px] text-black/60 font-medium">{t("checkout.pixNote")}</p>
              </div>

              <button
                onClick={handleContinue}
                className="w-full bg-[#C0001A] text-white py-4 text-[11px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors"
              >
                {t("checkout.continueToPix")} →
              </button>
            </motion.div>
          )}

          {/* ── STEP 2: PIX PAYMENT ── */}
          {step === "pix" && (
            <motion.div
              key="pix"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              <div className="bg-white border border-black/8">
                {/* Header */}
                <div className="bg-[#C0001A] px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 flex items-center justify-center">
                      <span className="text-white text-sm font-black">PIX</span>
                    </div>
                    <div>
                      <p className="text-white text-[11px] font-black uppercase tracking-widest leading-none">{t("checkout.pixTitle")}</p>
                      <p className="text-white/70 text-[9px] font-medium mt-0.5">{selected.credits} {t("checkout.credits")} · {selected.priceLabel}</p>
                    </div>
                  </div>
                  <div className={`text-right ${countdown < 120 ? "text-red-200" : "text-white/80"}`}>
                    <p className="text-[8px] font-medium uppercase tracking-wide">{t("checkout.expiresIn")}</p>
                    <p className="text-lg font-black font-mono leading-none">{minutes}:{seconds}</p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-black/40">{t("checkout.scanQR")}</p>
                    <div className="bg-white p-4 border-2 border-black/8 inline-block">
                      <QRCode value={pixCode} size={180} fgColor="#000000" bgColor="#ffffff" />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-black/8" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-black/25">{t("checkout.orCopy")}</span>
                    <div className="flex-1 h-px bg-black/8" />
                  </div>

                  {/* Copy code */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-2">{t("checkout.pixCodeLabel")}</p>
                    <div className="flex gap-0">
                      <div className="flex-1 border border-black/10 bg-[#f5f4f2] px-3 py-2.5 overflow-hidden">
                        <p className="text-[9px] font-mono text-black/50 truncate">{pixCode}</p>
                      </div>
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border border-l-0 transition-colors flex-shrink-0 ${
                          copied
                            ? "bg-[#C0001A] text-white border-[#C0001A]"
                            : "border-black/10 text-black/50 hover:border-black/25 hover:text-black bg-white"
                        }`}
                      >
                        {copied ? t("checkout.copied") : t("checkout.copy")}
                      </button>
                    </div>
                  </div>

                  {/* How to pay */}
                  <div className="bg-black/3 border border-black/8 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">{t("checkout.howToPay")}</p>
                    <ol className="space-y-2">
                      {tArr("checkout.steps").map((step: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="w-4 h-4 bg-[#C0001A] text-white text-[8px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-[9px] text-black/60 font-medium">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Confirm button (simulation) */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
                      <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">⚠</span>
                      <p className="text-[9px] text-amber-700 font-medium leading-snug">{t("checkout.demoNotice")}</p>
                    </div>
                    <button
                      onClick={handleConfirm}
                      className="w-full bg-amber-500 text-white py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-colors"
                    >
                      {t("checkout.demoBtn")} ✓
                    </button>
                    <button
                      onClick={() => { setStep("select"); setTimerActive(false); setCountdown(15 * 60); }}
                      className="w-full border border-black/10 text-black/40 py-2.5 text-[9px] font-black uppercase tracking-widest hover:border-black/25 hover:text-black transition-colors"
                    >
                      ← {t("checkout.backToSelect")}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: DONE ── */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex flex-col items-center text-center py-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
                className="w-16 h-16 bg-[#C0001A] flex items-center justify-center mb-6"
              >
                <span className="text-white text-2xl font-black">✓</span>
              </motion.div>

              <h2 className="text-lg font-black uppercase tracking-tighter text-black mb-2">
                {t("checkout.successTitle")}
              </h2>
              <p className="text-sm text-black/50 font-medium mb-1">
                {t("checkout.successDesc", { n: selected.credits })}
              </p>
              <p className="text-[9px] text-black/30 font-medium mb-8">
                {t("checkout.successOrder")} #{orderId.split("-")[0].toUpperCase()}
              </p>

              <div className="bg-white border border-black/8 px-8 py-5 mb-8 w-full max-w-xs">
                <p className="text-[8px] font-black uppercase tracking-widest text-black/30 mb-2">{t("checkout.creditsAdded")}</p>
                <p className="text-4xl font-black text-[#C0001A] leading-none">+{selected.credits}</p>
                <p className="text-[9px] text-black/40 font-medium mt-1">{t("checkout.credits")}</p>
              </div>

              <button
                onClick={() => setLocation("/dashboard")}
                className="bg-[#C0001A] text-white px-8 py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors"
              >
                {t("checkout.goToDashboard")}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
