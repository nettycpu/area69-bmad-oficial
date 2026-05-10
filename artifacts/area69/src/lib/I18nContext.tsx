import React, { createContext, useContext, useState } from "react";
import { translations, type Lang } from "./i18n";

const LANG_KEY = "area69_lang";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  tArr: (path: string) => string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(LANG_KEY) as Lang | null;
    if (stored && (stored === "pt-BR" || stored === "en" || stored === "es")) return stored;
    return "pt-BR";
  });

  function setLang(newLang: Lang) {
    setLangState(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  }

  function t(path: string, params?: Record<string, string | number>): string {
    const keys = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations[lang];
    for (const key of keys) {
      value = value?.[key];
    }
    if (typeof value !== "string") return path;
    if (!params) return value;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
      value
    );
  }

  function tArr(path: string): string[] {
    const keys = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations[lang];
    for (const key of keys) {
      value = value?.[key];
    }
    if (!Array.isArray(value)) return [];
    return value as string[];
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tArr }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
