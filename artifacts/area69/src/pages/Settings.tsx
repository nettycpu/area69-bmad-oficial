import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";
import { api } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

const PLANS = [
  {
    id: "free",
    nameKey: "settings.free",
    price: "R$ 0",
    period: "",
    credits: 0,
    features: ["Sem créditos inclusos", "1 modelo de avatar", "Histórico de 7 dias", "Resolução até 720p"],
  },
  {
    id: "creator",
    nameKey: null,
    name: "Creator",
    price: "R$ 197",
    period: "/mês",
    credits: 300,
    features: ["300 créditos/mês", "5 modelos de avatar", "Histórico de 30 dias", "Resolução até 1080p", "Gerar Vídeo", "Suporte prioritário"],
  },
  {
    id: "studio",
    nameKey: null,
    name: "Studio",
    price: "R$ 497",
    period: "/mês",
    credits: 1000,
    features: ["1.000 créditos/mês", "Modelos ilimitados", "Histórico ilimitado", "Resolução até 4K", "Gerar Vídeo + Áudio", "API Access", "Gerente de conta"],
  },
];

const CREDIT_PACKS = [
  { credits: 50,  price: "R$ 29",  per: "R$ 0,58/credito", highlight: false },
  { credits: 150, price: "R$ 79",  per: "R$ 0,53/credito", highlight: false },
  { credits: 300, price: "R$ 139", per: "R$ 0,46/credito", highlight: true  },
  { credits: 600, price: "R$ 249", per: "R$ 0,42/credito", highlight: false },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-black uppercase tracking-widest text-black/30 mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function Settings() {
  const { state, updateProfile, resetAccount } = useStore();
  const { t, lang, setLang } = useI18n();

  const [name, setName]   = useState(state.profile.name);
  const [email, setEmail] = useState(state.profile.email);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(state.profile.avatar);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPlan] = useState("free");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState<"language" | "notifGen" | "notifPromo" | null>(null);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [buyStep, setBuyStep] = useState<"idle" | "confirm" | "done">("idle");
  // ── Change password state ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew]         = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError]     = useState<string | null>(null);
  const [pwDone, setPwDone]       = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwShowCurrent, setPwShowCurrent]   = useState(false);
  const [pwShowNew, setPwShowNew]           = useState(false);
  const [pwShowConfirm, setPwShowConfirm]   = useState(false);

  useEffect(() => {
    setName(state.profile.name);
    setEmail(state.profile.email);
    setAvatarPreview(state.profile.avatar);
  }, [state.profile.name, state.profile.email, state.profile.avatar]);

  async function handleChangePassword() {
    setPwError(null);
    if (!pwCurrent) {
      setPwError(t("settings.currentPasswordRequired"));
      return;
    }
    if (pwNew.length < 8) {
      setPwError(t("settings.passwordMinLength"));
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t("settings.passwordMismatch"));
      return;
    }
    setPwSaving(true);
    try {
      await api.user.changePassword({ current_password: pwCurrent, new_password: pwNew });
      setPwDone(true);
      setTimeout(() => {
        setPwOpen(false);
        setPwDone(false);
        setPwCurrent(""); setPwNew(""); setPwConfirm("");
      }, 2500);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t("settings.passwordWrong"));
    } finally {
      setPwSaving(false);
    }
  }

  async function persistSettings(
    patch: Parameters<typeof updateProfile>[0],
    savingKey: "language" | "notifGen" | "notifPromo",
    successMessage: string,
  ) {
    setSettingsSaving(savingKey);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await updateProfile(patch);
      setSettingsMessage(successMessage);
      setTimeout(() => setSettingsMessage(null), 2200);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Nao foi possivel salvar as configuracoes.");
    } finally {
      setSettingsSaving(null);
    }
  }

  // ── Delete account state ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const deleteWord = t("settings.deleteConfirmWord");
  const canDelete = deleteInput === deleteWord;

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Foto muito grande. Máximo: 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setAvatarPreview(base64);
      updateProfile({ avatar: base64 }).catch((err) => {
        setAvatarPreview(state.profile.avatar);
        setProfileError(err instanceof Error ? err.message : "Nao foi possivel salvar a foto.");
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile({ name: name.trim(), email: email.trim().toLowerCase() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <>
    <DashboardLayout title={t("settings.title")} subtitle={t("settings.subtitle")}>

      <div className="max-w-2xl space-y-8">

        <Section title={t("settings.profile")}>
          <div className="bg-white border border-black/8 p-5 space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative group flex-shrink-0">
                <div className="w-16 h-16 overflow-hidden cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#C0001A] flex items-center justify-center text-white text-2xl font-black">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                  onClick={() => avatarInputRef.current?.click()}>
                  <span className="text-white text-xs font-black leading-tight text-center px-1">TROCAR<br/>FOTO</span>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="text-sm font-black text-black">{name}</p>
                <p className="text-[11px] text-black/30 font-medium">{email}</p>
                <button onClick={() => avatarInputRef.current?.click()}
                  className="text-[10px] font-black uppercase tracking-widest text-[#C0001A] hover:underline mt-1 block">
                  {avatarPreview ? t("settings.changePhoto") : t("settings.addPhoto")}
                </button>
                {avatarPreview && (
                  <button onClick={() => {
                    setAvatarPreview(null);
                    updateProfile({ avatar: null }).catch((err) => {
                      setAvatarPreview(state.profile.avatar);
                      setProfileError(err instanceof Error ? err.message : "Nao foi possivel remover a foto.");
                    });
                  }}
                    className="text-[10px] font-black uppercase tracking-widest text-black/25 hover:text-black/50 transition-colors mt-0.5 block">
                    {t("settings.removePhoto")}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1.5">{t("settings.name")}</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border border-black/10 px-3 py-3 text-sm font-medium text-black outline-none focus:border-[#C0001A] transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1.5">{t("settings.email")}</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-black/10 px-3 py-3 text-sm font-medium text-black outline-none focus:border-[#C0001A] transition-colors" />
              </div>
            </div>

            {profileError && (
              <p className="text-xs font-bold text-[#C0001A]">{profileError}</p>
            )}

            <button onClick={handleSaveProfile} disabled={!name.trim() || !email.trim() || profileSaving}
              className="bg-[#C0001A] text-white px-5 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {profileSaving ? t("settings.saving") : saved ? t("settings.saved") : t("settings.saveChanges")}
            </button>
          </div>
        </Section>

        <Section title={t("settings.currentPlan")}>
          <div className="bg-white border border-black/8 p-5 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-black uppercase">
                    {PLANS.find((p) => p.id === currentPlan)?.name ?? t("settings.free")}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white bg-black/25 px-1.5 py-0.5">
                    {currentPlan === "free" ? t("settings.free") : t("settings.active")}
                  </span>
                </div>
                <p className="text-[11px] text-black/30 font-medium">
                  {t("settings.remainingCredits", { n: state.credits })}
                </p>
              </div>
              {currentPlan === "free" && (
                <button className="bg-[#C0001A] text-white px-5 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
                  {t("settings.upgrade")}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {PLANS.map((plan) => (
              <div key={plan.id}
                className={`border-2 p-4 transition-colors ${plan.id === currentPlan ? "border-[#C0001A] bg-[#C0001A]/5" : "border-black/8 bg-white"}`}>
                {plan.id === "studio" && (
                  <div className="text-[11px] font-black uppercase tracking-widest text-white bg-[#C0001A] px-2 py-0.5 inline-block mb-2">
                    {t("settings.popular")}
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-widest text-black mb-0.5">
                  {plan.id === "free" ? t("settings.free") : plan.name}
                </p>
                <p className="text-lg font-black text-black leading-none">
                  {plan.price}<span className="text-[11px] font-bold text-black/30">{plan.period}</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className={`text-[10px] mt-0.5 ${plan.id === currentPlan ? "text-[#C0001A]" : "text-black/25"}`}>✓</span>
                      <span className="text-[10px] text-black/50 font-medium leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.id !== currentPlan && (
                  <button className={`w-full mt-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
                    plan.id === "studio" ? "bg-[#C0001A] text-white hover:bg-[#a00015]" : "border border-black/15 text-black/40 hover:border-black/30 hover:text-black"
                  }`}>
                    {plan.id === "free" ? t("settings.currentPlanLabel") : t("settings.subscribe")}
                  </button>
                )}
                {plan.id === currentPlan && (
                  <div className="w-full mt-4 py-3 text-xs font-black uppercase tracking-widest text-center text-[#C0001A]">
                    {t("settings.currentPlanLabel")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {false && (
        <Section title={t("settings.buyCredits")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {CREDIT_PACKS.map((pack) => {
              const isSelected = selectedPack === pack.credits;
              return (
                <motion.button key={pack.credits}
                  onClick={() => { setSelectedPack(isSelected ? null : pack.credits); setBuyStep("idle"); }}
                  whileTap={{ scale: 0.97 }}
                  className={`border-2 p-4 text-left transition-all relative ${
                    isSelected
                      ? "border-[#C0001A] bg-[#C0001A] text-white shadow-lg shadow-[#C0001A]/20"
                      : pack.highlight
                      ? "border-[#C0001A] bg-[#C0001A]/5 hover:bg-[#C0001A]/10"
                      : "border-black/8 bg-white hover:border-[#C0001A] hover:bg-[#C0001A]/3"
                  }`}>
                  {isSelected && <span className="absolute top-2 right-2 text-white text-xs font-black">✓</span>}
                  {!isSelected && pack.highlight && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-white bg-[#C0001A] px-1.5 py-0.5 inline-block mb-2">
                      {t("settings.bestValue")}
                    </div>
                  )}
                  {isSelected && (
                    <div className="text-[9px] font-black uppercase tracking-widest text-white/70 bg-white/20 px-1.5 py-0.5 inline-block mb-2">
                      {t("settings.selected")}
                    </div>
                  )}
                  <p className={`text-lg font-black leading-none ${isSelected ? "text-white" : "text-black"}`}>{pack.credits}</p>
                  <p className={`text-[10px] font-bold mb-2 ${isSelected ? "text-white/60" : "text-black/30"}`}>{t("settings.credits")}</p>
                  <p className={`text-sm font-black ${isSelected ? "text-white" : pack.highlight ? "text-[#C0001A]" : "text-black"}`}>{pack.price}</p>
                  <p className={`text-[9px] font-medium ${isSelected ? "text-white/50" : "text-black/25"}`}>{pack.per}</p>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedPack !== null && buyStep !== "done" && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white border-2 border-[#C0001A] p-5">
                {buyStep === "idle" && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-black">
                        {t("settings.creditsSelected", { n: selectedPack ?? 0 })}
                      </p>
                      <p className="text-[11px] text-black/40 font-medium mt-0.5">
                        {CREDIT_PACKS.find(p => p.credits === selectedPack)?.price} · {CREDIT_PACKS.find(p => p.credits === selectedPack)?.per}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setSelectedPack(null); setBuyStep("idle"); }}
                        className="border border-black/10 text-black/40 px-4 min-h-[44px] text-xs font-black uppercase tracking-widest hover:border-black/25 hover:text-black transition-colors">
                        {t("settings.cancel")}
                      </button>
                      <button onClick={() => setBuyStep("confirm")}
                        className="bg-[#C0001A] text-white px-6 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
                        {t("settings.buyNow")}
                      </button>
                    </div>
                  </div>
                )}

                {buyStep === "confirm" && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-black mb-1">{t("settings.confirmPurchase")}</p>
                    <p className="text-[11px] text-black/40 font-medium mb-4">
                      {t("settings.buyConfirm")} <span className="font-black text-black">{selectedPack} {t("settings.credits")}</span> {t("settings.buyCreditsFor")} <span className="font-black text-black">{CREDIT_PACKS.find(p => p.credits === selectedPack)?.price}</span>. {t("settings.buyImmediate")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            window.location.href = "/dashboard/billing";
                          } catch (e) {
                            console.error("Falha ao adicionar créditos (dev):", e);
                          }
                          setBuyStep("done");
                          setTimeout(() => { setBuyStep("idle"); setSelectedPack(null); }, 3000);
                        }}
                        className="bg-[#C0001A] text-white px-6 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors">
                        {t("settings.confirmPayment")}
                      </button>
                      <button onClick={() => setBuyStep("idle")}
                        className="border border-black/10 text-black/40 px-4 min-h-[44px] text-xs font-black uppercase tracking-widest hover:border-black/25 hover:text-black transition-colors">
                        {t("settings.back")}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {buyStep === "done" && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-black/8 p-5 flex items-center gap-3">
                <span className="w-7 h-7 bg-[#C0001A] text-white text-sm font-black flex items-center justify-center flex-shrink-0">✓</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-black">
                    {t("settings.creditsAdded", { n: selectedPack ?? 0 })}
                  </p>
                  <p className="text-[11px] text-black/40 font-medium mt-0.5">
                    {t("settings.creditsBalance", { n: state.credits })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>
        )}

        <Section title={t("settings.notifications")}>
          <div className="bg-white border border-black/8 divide-y divide-black/5">
            {[
              {
                labelKey: "settings.notifGen",
                descKey: "settings.notifGenDesc",
                value: state.profile.notifyGenerations,
                savingKey: "notifGen" as const,
                patchKey: "notifyGenerations" as const,
              },
              {
                labelKey: "settings.notifPromo",
                descKey: "settings.notifPromoDesc",
                value: state.profile.notifyPromotions,
                savingKey: "notifPromo" as const,
                patchKey: "notifyPromotions" as const,
              },
            ].map((item) => (
              <div key={item.labelKey} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-xs font-black text-black">{t(item.labelKey as Parameters<typeof t>[0])}</p>
                  <p className="text-[11px] text-black/30 font-medium mt-0.5">{t(item.descKey as Parameters<typeof t>[0])}</p>
                </div>
                <button
                  onClick={() =>
                    persistSettings(
                      { [item.patchKey]: !item.value },
                      item.savingKey,
                      t("settings.notificationsSaved"),
                    )
                  }
                  disabled={settingsSaving === item.savingKey}
                  aria-pressed={item.value}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-300 flex-shrink-0 disabled:opacity-60 ${item.value ? "bg-[#C0001A]" : "bg-black/15"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${item.value ? "translate-x-5.5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
          {(settingsMessage || settingsError) && (
            <p className={`mt-2 text-xs font-bold ${settingsError ? "text-[#C0001A]" : "text-green-600"}`}>
              {settingsError ?? settingsMessage}
            </p>
          )}
        </Section>

        <Section title={t("settings.security")}>
          <div className="bg-white border border-black/8 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-black">{t("settings.twoFA")}</p>
                <p className="text-[11px] text-black/30 font-medium mt-0.5">{t("settings.twoFAOff")}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-black/30 border border-black/10 px-2.5 py-1">
                {t("settings.twoFAComingSoon")}
              </span>
            </div>
          </div>
        </Section>

        <Section title={t("settings.language")}>
          <div className="bg-white border border-black/8 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-black">{t("settings.languageLabel")}</p>
                <p className="text-[11px] text-black/30 font-medium mt-0.5">{t("settings.languageDesc")}</p>
              </div>
              <select
                value={lang}
                disabled={settingsSaving === "language"}
                onChange={(e) => {
                  const nextLang = e.target.value as Lang;
                  setLang(nextLang);
                  persistSettings({ language: nextLang }, "language", t("settings.languageSaved"));
                }}
                className="bg-white border border-black/10 text-xs font-black uppercase tracking-widest text-black/50 px-3 py-2.5 outline-none cursor-pointer hover:border-black/25 transition-colors">
                <option value="pt-BR">Português (BR)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title={t("settings.dangerZone")}>
          <div className="bg-white border border-black/8 divide-y divide-black/5">

            {/* ── CHANGE PASSWORD ── */}
            <div>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-xs font-black text-black">{t("settings.changePassword")}</p>
                  <p className="text-[11px] text-black/30 font-medium mt-0.5">{t("settings.changePasswordDesc")}</p>
                </div>
                <button
                  onClick={() => { setPwOpen((v) => !v); setPwError(null); setPwDone(false); }}
                  className={`text-xs font-black uppercase tracking-widest border px-4 py-2.5 transition-colors ${
                    pwOpen
                      ? "border-black/20 bg-black text-white"
                      : "border-black/10 text-black/40 hover:border-black/25 hover:text-black"
                  }`}
                >
                  {t("settings.changePasswordBtn")}
                </button>
              </div>

              <AnimatePresence>
                {pwOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-3 border-t border-black/5">
                      {pwDone ? (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 py-4"
                        >
                          <span className="w-8 h-8 bg-[#C0001A] text-white font-black text-sm flex items-center justify-center flex-shrink-0">✓</span>
                          <div>
                            <p className="text-xs font-black text-black uppercase tracking-widest">{t("settings.passwordChanged")}</p>
                            <p className="text-[11px] text-black/40 font-medium mt-0.5">{t("settings.passwordChangedDesc")}</p>
                          </div>
                        </motion.div>
                      ) : (
                        <>
                          <div className="pt-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1.5">
                              {t("settings.currentPassword")}
                            </label>
                            <div className="relative">
                              <input
                                type={pwShowCurrent ? "text" : "password"}
                                value={pwCurrent}
                                onChange={(e) => { setPwCurrent(e.target.value); setPwError(null); }}
                                placeholder={t("settings.currentPasswordPlaceholder")}
                                className="w-full border border-black/10 px-3 py-2 text-xs font-medium text-black outline-none focus:border-[#C0001A] transition-colors pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setPwShowCurrent((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/25 hover:text-black/50 transition-colors text-[10px]"
                              >
                                {pwShowCurrent ? "🙈" : "👁"}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1.5">
                              {t("settings.newPassword")}
                            </label>
                            <div className="relative">
                              <input
                                type={pwShowNew ? "text" : "password"}
                                value={pwNew}
                                onChange={(e) => { setPwNew(e.target.value); setPwError(null); }}
                                placeholder={t("settings.newPasswordPlaceholder")}
                                className="w-full border border-black/10 px-3 py-2 text-xs font-medium text-black outline-none focus:border-[#C0001A] transition-colors pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setPwShowNew((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/25 hover:text-black/50 transition-colors text-[10px]"
                              >
                                {pwShowNew ? "🙈" : "👁"}
                              </button>
                            </div>
                            {pwNew.length > 0 && (
                              <div className="flex gap-0.5 mt-1.5">
                                {[1,2,3,4].map((i) => (
                                  <div key={i} className={`h-1 flex-1 transition-colors ${
                                    pwNew.length === 0 ? "bg-black/10" :
                                    pwNew.length < 6  ? (i <= 1 ? "bg-red-400" : "bg-black/10") :
                                    pwNew.length < 8  ? (i <= 2 ? "bg-orange-400" : "bg-black/10") :
                                    pwNew.length < 12 ? (i <= 3 ? "bg-yellow-400" : "bg-black/10") :
                                    "bg-green-400"
                                  }`} />
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-black/30 block mb-1.5">
                              {t("settings.confirmPassword")}
                            </label>
                            <div className="relative">
                              <input
                                type={pwShowConfirm ? "text" : "password"}
                                value={pwConfirm}
                                onChange={(e) => { setPwConfirm(e.target.value); setPwError(null); }}
                                placeholder={t("settings.confirmPasswordPlaceholder")}
                                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                                className={`w-full border px-3 py-2 text-xs font-medium text-black outline-none transition-colors pr-10 ${
                                  pwConfirm.length > 0 && pwNew !== pwConfirm
                                    ? "border-red-400 focus:border-red-400"
                                    : "border-black/10 focus:border-[#C0001A]"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setPwShowConfirm((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/25 hover:text-black/50 transition-colors text-[10px]"
                              >
                                {pwShowConfirm ? "🙈" : "👁"}
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {pwError && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="text-xs font-bold text-[#C0001A] flex items-center gap-1.5"
                              >
                                <span>✕</span> {pwError}
                              </motion.p>
                            )}
                          </AnimatePresence>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleChangePassword}
                              disabled={!pwCurrent || !pwNew || !pwConfirm || pwSaving}
                              className="bg-[#C0001A] text-white px-5 min-h-[44px] text-xs font-black uppercase tracking-widest hover:bg-[#a00015] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              {pwSaving ? t("settings.saving") : t("settings.changePasswordBtn")}
                            </button>
                            <button
                              onClick={() => { setPwOpen(false); setPwError(null); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                              className="border border-black/10 text-black/40 px-4 min-h-[44px] text-xs font-black uppercase tracking-widest hover:border-black/25 hover:text-black transition-colors"
                            >
                              {t("settings.cancel")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── DELETE ACCOUNT ── */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-xs font-black" style={{ color: "#C0001A" }}>{t("settings.deleteAccount")}</p>
                <p className="text-[11px] text-black/30 font-medium mt-0.5">{t("settings.deleteAccountDesc")}</p>
              </div>
              <button
                onClick={() => { setDeleteOpen(true); setDeleteInput(""); }}
                className="text-xs font-black uppercase tracking-widest border border-[#C0001A]/30 text-[#C0001A] px-4 py-2.5 hover:bg-[#C0001A] hover:text-white transition-colors"
              >
                {t("settings.delete")}
              </button>
            </div>
          </div>
        </Section>

      </div>
    </DashboardLayout>

    {/* ── DELETE ACCOUNT MODAL ── */}
    <AnimatePresence>
      {deleteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="bg-white w-full max-w-md shadow-2xl"
          >
            {/* Header */}
            <div className="bg-[#C0001A] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-[11px] font-black uppercase tracking-widest leading-none">{t("settings.deleteConfirmTitle")}</p>
                  <p className="text-white/60 text-[11px] font-medium mt-0.5">{t("settings.deleteAccount")}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-black/60 font-medium leading-relaxed">
                {t("settings.deleteConfirmDesc")}
              </p>

              {/* What will be deleted */}
              <div className="bg-black/3 border border-black/8 p-4 space-y-2">
                {[
                  t("settings.deleteItemModels", { n: state.models.length }),
                  t("settings.deleteItemImages", { n: state.generations.filter(g => g.type === "image").length }),
                  t("settings.deleteItemVideos", { n: state.generations.filter(g => g.type === "video").length }),
                  t("settings.deleteItemCredits", { n: state.credits }),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[#C0001A] text-[10px] font-black">✕</span>
                    <span className="text-[11px] text-black/60 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              {/* Confirmation input */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">
                  {t("settings.deleteConfirmType")}{" "}
                  <span className="text-[#C0001A] font-black">{deleteWord}</span>
                </label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder={t("settings.deleteConfirmPlaceholder")}
                  autoFocus
                  className={`w-full border-2 px-3 py-2.5 text-xs font-black tracking-widest text-black outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-black/25 ${
                    canDelete
                      ? "border-[#C0001A] bg-[#C0001A]/5"
                      : "border-black/15 focus:border-black/30"
                  }`}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <motion.button
                  onClick={resetAccount}
                  disabled={!canDelete}
                  whileTap={canDelete ? { scale: 0.98 } : {}}
                  className="w-full bg-[#C0001A] text-white py-3 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-25 disabled:cursor-not-allowed enabled:hover:bg-[#a00015]"
                >
                  {t("settings.deleteConfirmBtn")}
                </motion.button>
                <button
                  onClick={() => setDeleteOpen(false)}
                  className="w-full border border-black/10 text-black/40 py-3 text-xs font-black uppercase tracking-widest hover:border-black/25 hover:text-black transition-colors"
                >
                  {t("settings.deleteConfirmCancel")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
