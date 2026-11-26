import React, { createContext, useContext, useEffect, useState } from "react";

export type TableDensity = "comfort" | "compact";

interface PreferencesState {
  easyRead: boolean;
  density: TableDensity;
  sunlightMode: boolean;
  focusMode: boolean;
  demoMode: boolean;
  soundEnabled: boolean;
  leftHanded: boolean;
  favorites: string[];
  pinCode: string;
}

interface PreferencesContextValue extends PreferencesState {
  setEasyRead: (v: boolean) => void;
  setDensity: (d: TableDensity) => void;
  setSunlightMode: (v: boolean) => void;
  setFocusMode: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setLeftHanded: (v: boolean) => void;
  toggleFavorite: (path: string) => void;
  setPinCode: (pin: string) => void;
}

const STORAGE_KEY = "pumpledger_prefs_v1";

const DEFAULT_PREFS: PreferencesState = {
  easyRead: false,
  density: "comfort",
  sunlightMode: false,
  focusMode: false,
  demoMode: false,
  soundEnabled: true,
  leftHanded: false,
  favorites: ["/dashboard/quick-entry", "/dashboard/vouchers", "/dashboard/day-closing"],
  pinCode: "1234",
};

const PreferencesContext = createContext<PreferencesContextValue>({
  ...DEFAULT_PREFS,
  setEasyRead: () => {},
  setDensity: () => {},
  setSunlightMode: () => {},
  setFocusMode: () => {},
  setDemoMode: () => {},
  setSoundEnabled: () => {},
  setLeftHanded: () => {},
  toggleFavorite: () => {},
  setPinCode: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<PreferencesState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_PREFS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
    const root = document.documentElement;
    root.classList.toggle("easy-read", prefs.easyRead);
    root.classList.toggle("density-compact", prefs.density === "compact");
    root.classList.toggle("sunlight-mode", prefs.sunlightMode);
  }, [prefs]);

  const update = <K extends keyof PreferencesState>(key: K, value: PreferencesState[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFavorite = (path: string) => {
    setPrefs((prev) => {
      const exists = prev.favorites.includes(path);
      return {
        ...prev,
        favorites: exists
          ? prev.favorites.filter((p) => p !== path)
          : [...prev.favorites, path],
      };
    });
  };

  return (
    <PreferencesContext.Provider
      value={{
        ...prefs,
        setEasyRead: (v) => update("easyRead", v),
        setDensity: (d) => update("density", d),
        setSunlightMode: (v) => update("sunlightMode", v),
        setFocusMode: (v) => update("focusMode", v),
        setDemoMode: (v) => update("demoMode", v),
        setSoundEnabled: (v) => update("soundEnabled", v),
        setLeftHanded: (v) => update("leftHanded", v),
        toggleFavorite,
        setPinCode: (p) => update("pinCode", p),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
