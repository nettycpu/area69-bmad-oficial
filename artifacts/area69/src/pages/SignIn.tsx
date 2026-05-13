import React, { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/I18nContext";
import { setSession, isAuthenticated } from "@/lib/store";
import { api } from "@/lib/api";

export default function SignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [, setLocation] = useLocation();

  if (isAuthenticated()) return <Redirect to="/dashboard" />;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotOpen(false);
    if (!email.trim()) { setError(t("signIn.emailRequired")); return; }
    if (!password) { setError(t("signIn.passwordRequired")); return; }
    setLoading(true);
    try {
      const res = await api.auth.login({ email: email.trim().toLowerCase(), password });
      setSession(res.token);
      setLocation("/dashboard");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : t("signIn.invalidCredentials"));
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#C0001A] flex items-center justify-center px-4 relative overflow-hidden">
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
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <img src="/logo.png" alt="AREA 69" className="h-16 w-16 object-contain mb-4 invert" />
          </Link>
          <h1 className="text-white text-3xl font-bold uppercase tracking-tighter">{t("signIn.title")}</h1>
          <p className="text-white/60 text-sm mt-1">{t("signIn.welcome")}</p>
        </div>

        <div className="bg-white p-8 shadow-2xl">
          <form onSubmit={handleSignIn} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-black/50">{t("signIn.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("signIn.emailPlaceholder")}
                className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 transition-colors"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-black/50">{t("signIn.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-2 border-black/10 focus:border-[#C0001A] outline-none px-4 py-3 text-sm font-medium text-black placeholder:text-black/30 transition-colors"
                autoComplete="current-password"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs font-bold text-[#C0001A] bg-[#C0001A]/8 border border-[#C0001A]/20 px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen((v) => !v)}
                className="text-xs font-bold text-[#C0001A] uppercase tracking-widest hover:underline"
              >
                {t("signIn.forgotPassword")}
              </button>
            </div>

            <AnimatePresence>
              {forgotOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-xs text-black/50 font-medium bg-black/4 border border-black/8 px-3 py-2.5 leading-relaxed">
                    {t("signIn.forgotPasswordHint")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C0001A] text-white py-4 font-bold uppercase tracking-widest text-sm hover:bg-[#a00015] transition-colors mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {t("signIn.btn")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-black/10 text-center">
            <p className="text-xs text-black/40 font-medium">
              {t("signIn.noAccount")}{" "}
              <Link href="/sign-up" className="text-[#C0001A] font-bold uppercase tracking-wide hover:underline">
                {t("signIn.createAccount")}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs font-bold uppercase tracking-widest mt-8">
          © 2025 AREA 69 · AI Models Studio
        </p>
      </motion.div>
    </div>
  );
}
