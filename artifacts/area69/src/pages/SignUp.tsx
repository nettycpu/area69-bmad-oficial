import React, { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/I18nContext";
import { setSession, isAuthenticated } from "@/lib/store";
import { api } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const { t, tArr } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  if (isAuthenticated()) return <Redirect to="/dashboard" />;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError(t("signUp.nameMin")); return; }
    if (!EMAIL_RE.test(email.trim())) { setError(t("signUp.emailInvalid")); return; }
    if (password.length < 8) { setError(t("signUp.passwordMin")); return; }
    if (!agreed) return;
    setLoading(true);
    try {
      const res = await api.auth.register({ name: name.trim(), email: email.trim().toLowerCase(), password });
      setSession(res.token);
      setLocation("/dashboard");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : t("signUp.serverError"));
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#C0001A] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
        backgroundSize: "200px"
      }} />
      <div className="absolute -bottom-8 -left-8 w-48 h-60 bg-white/10 rotate-[-12deg] rounded-sm hidden md:block" />
      <div className="absolute -top-4 -right-4 w-36 h-48 bg-white/10 rotate-[8deg] rounded-sm hidden md:block" />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <img src="/logo.png" alt="AREA 69" className="h-16 w-16 object-contain mb-4 invert" />
          </Link>
          <h1 className="text-white text-3xl font-bold uppercase tracking-tighter">{t("signUp.title")}</h1>
          <p className="text-white/60 text-sm mt-1">
            {t("signUp.subtitle")}{" "}
            <span className="font-cursive text-white/90 text-base">{t("signUp.subtitleModel")}</span>
            {" "}{t("signUp.subtitleEnd")}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {tArr("signUp.featurePills").map((p) => (
            <span key={p} className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white/15 border border-white/30 text-white">
              {p}
            </span>
          ))}
        </div>

        <div className="bg-white p-8 shadow-2xl">
          <form onSubmit={handleSignUp} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-black/50">{t("signUp.name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("signUp.namePlaceholder")}
                className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 transition-colors"
                autoComplete="name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-black/50">{t("signUp.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("signUp.emailPlaceholder")}
                className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 transition-colors"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-black/50">{t("signUp.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("signUp.passwordPlaceholder")}
                className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 transition-colors"
                autoComplete="new-password"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-[11px] font-bold text-[#C0001A] bg-[#C0001A]/8 border border-[#C0001A]/20 px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
                aria-label="Aceitar termos de uso e política de privacidade"
              />
              <div
                onClick={() => setAgreed(!agreed)}
                className={`mt-0.5 w-5 h-5 flex-shrink-0 border-2 flex items-center justify-center transition-colors ${agreed ? "bg-[#C0001A] border-[#C0001A]" : "border-black/20 group-hover:border-[#C0001A]"}`}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-black/50 leading-relaxed font-medium">
                {t("signUp.terms")}{" "}
                <a href="#" className="text-[#C0001A] font-bold hover:underline">{t("signUp.termsLink")}</a>
                {" "}{t("signUp.privacyAnd")}{" "}
                <a href="#" className="text-[#C0001A] font-bold hover:underline">{t("signUp.privacyLink")}</a>
              </span>
            </label>

            <button
              type="submit"
              disabled={!agreed || loading}
              className="w-full bg-[#C0001A] text-white py-4 font-bold uppercase tracking-widest text-sm hover:bg-[#a00015] transition-colors mt-1 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {t("signUp.btn")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-black/10 text-center">
            <p className="text-xs text-black/40 font-medium">
              {t("signUp.haveAccount")}{" "}
              <Link href="/sign-in" className="text-[#C0001A] font-bold uppercase tracking-wide hover:underline">
                {t("signUp.signIn")}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/30 text-[10px] font-bold uppercase tracking-widest mt-8">
          © 2025 AREA 69 · AI Models Studio
        </p>
      </motion.div>
    </div>
  );
}
