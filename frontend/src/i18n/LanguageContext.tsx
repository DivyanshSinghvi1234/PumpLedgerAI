import React, { createContext, useContext, useEffect, useState } from "react";
import { HI_TRANSLATIONS, type AppLanguage } from "./translations";

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  t: (text: string) => string;
}

const STORAGE_KEY = "pumpledger_lang";

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
  t: (text: string) => text,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  const setLang = (next: AppLanguage) => setLangState(next);
  const toggleLang = () => setLangState((prev) => (prev === "en" ? "hi" : "en"));

  const t = (text: string): string => {
    if (lang === "en") return text;
    return HI_TRANSLATIONS[text] ?? text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
