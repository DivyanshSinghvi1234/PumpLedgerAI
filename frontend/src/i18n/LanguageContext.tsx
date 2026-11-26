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

// Stores original English text for auto-translated DOM text nodes so switching back to EN restores cleanly.
const originalTextMap = new WeakMap<Text, string>();

function translateTextNode(node: Text, lang: AppLanguage) {
  const parent = node.parentElement;
  if (!parent) return;
  const tag = parent.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "CODE" || tag === "PRE") {
    return;
  }
  if (parent.closest("[data-no-translate='true']")) return;

  if (!originalTextMap.has(node)) {
    originalTextMap.set(node, node.nodeValue ?? "");
  }
  const orig = originalTextMap.get(node) ?? "";
  if (lang === "en") {
    if (node.nodeValue !== orig) node.nodeValue = orig;
    return;
  }

  const trimmed = orig.trim();
  if (!trimmed) return;
  const translated = HI_TRANSLATIONS[trimmed];
  if (translated) {
    const leading = orig.match(/^\s*/)?.[0] ?? "";
    const trailing = orig.match(/\s*$/)?.[0] ?? "";
    const nextVal = `${leading}${translated}${trailing}`;
    if (node.nodeValue !== nextVal) {
      node.nodeValue = nextVal;
    }
  }
}

function walkAndTranslate(root: Node, lang: AppLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    translateTextNode(cur as Text, lang);
  }
}

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

    const root = document.getElementById("root");
    if (!root) return;

    walkAndTranslate(root, lang);

    if (lang === "en") return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(m.target as Text, lang);
        }
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            translateTextNode(n as Text, lang);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            walkAndTranslate(n, lang);
          }
        });
      }
    });

    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
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
