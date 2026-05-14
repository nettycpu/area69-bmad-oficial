import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/lib/useStore";
import { useI18n } from "@/lib/I18nContext";

export default function DashboardLayout({ children, title, subtitle }: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { state } = useStore();
  const { t } = useI18n();

  const navItems = [
    { icon: "⊞", label: t("nav.home"),          href: "/dashboard" },
    { icon: "◈", label: t("nav.models"),         href: "/dashboard/models" },
    { icon: "✦", label: t("nav.generateImage"),  href: "/dashboard/generate" },
    { icon: "▷", label: t("nav.generateVideo"),  href: "/dashboard/video" },
    { icon: "⚡", label: t("nav.higgsfield"),    href: "/dashboard/character" },
    { icon: "◷", label: t("nav.history"),        href: "/dashboard/history" },
    { icon: "⚙", label: t("nav.settings"),       href: "/dashboard/settings" },
  ];

  function handleLogout() {
    setLocation("/");
  }

  const CREDIT_BASE = Math.max(500, Math.ceil(Math.max(state.credits, 1) / 500) * 500);
  const creditPercent = Math.min(100, (state.credits / CREDIT_BASE) * 100);

  return (
    <div className="min-h-screen w-full bg-[#f5f4f2] flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[82vw] bg-white border-r border-black/8 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-black/8 flex items-center gap-3">
          <Link href="/">
            <img src="/logo.png" alt="AREA 69" className="h-10 w-10 object-contain cursor-pointer" style={{ mixBlendMode: "multiply" }} />
          </Link>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-black leading-none">AREA 69</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mt-0.5">AI Models Studio</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 transition-all group ${
                  active
                    ? "bg-[#C0001A] text-white"
                    : "text-black/50 hover:bg-black/5 hover:text-black"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-black/8">
          <div className="bg-[#C0001A]/8 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#C0001A] mb-2">{t("sidebar.credits")}</p>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-2xl font-black text-black leading-none">{state.credits}</span>
              <span className="text-xs font-bold text-black/40 mb-0.5">{t("settings.credits")}</span>
            </div>
            <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#C0001A] transition-all duration-500 rounded-full" style={{ width: `${creditPercent}%` }} />
            </div>
            {state.credits === 0 && (
              <p className="text-[11px] text-[#C0001A] font-bold mt-2 uppercase tracking-wide">{t("sidebar.addCredits")}</p>
            )}
          </div>
          <Link href="/dashboard/billing">
            <button className="w-full mt-3 border-2 border-[#C0001A] text-[#C0001A] py-3 text-xs font-black uppercase tracking-widest hover:bg-[#C0001A] hover:text-white transition-colors">
              {t("sidebar.buyCredits")}
            </button>
          </Link>
        </div>

        <div className="px-4 py-4 border-t border-black/8 flex items-center gap-3">
          <Link href="/dashboard/settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 flex-shrink-0 overflow-hidden rounded-sm">
              {state.profile?.avatar ? (
                <img src={state.profile.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#C0001A] flex items-center justify-center text-white text-xs font-black">
                  {(state.profile?.name ?? "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">{state.profile?.name ?? "Usuário"}</p>
              <p className="text-xs text-black/40 truncate">{t("sidebar.noPlan")}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title={t("sidebar.logout")}
            className="w-9 h-9 flex items-center justify-center text-black/30 hover:text-[#C0001A] hover:bg-[#C0001A]/8 transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white border-b border-black/8 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between min-h-[60px]">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-black/50 w-11 h-11 flex items-center justify-center hover:bg-black/5 transition-colors" onClick={() => setSidebarOpen(true)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-black uppercase tracking-tighter text-black leading-none">{title}</h1>
              {subtitle && <p className="text-xs text-black/40 font-medium mt-1">{subtitle}</p>}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 xl:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
