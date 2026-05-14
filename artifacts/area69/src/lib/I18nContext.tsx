import React, { createContext, useContext, useEffect, useState } from "react";
import { translations, type Lang } from "./i18n";

export const LANG_KEY = "area69_lang";
export const LANG_CHANGE_EVENT = "area69:language-change";

function isLang(value: unknown): value is Lang {
  return value === "pt-BR" || value === "en" || value === "es";
}

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
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: newLang }));
  }

  useEffect(() => {
    function handleLanguageEvent(event: Event) {
      const customEvent = event as CustomEvent<Lang>;
      if (isLang(customEvent.detail)) {
        setLangState(customEvent.detail);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === LANG_KEY && isLang(event.newValue)) {
        setLangState(event.newValue);
      }
    }

    window.addEventListener(LANG_CHANGE_EVENT, handleLanguageEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, handleLanguageEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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
