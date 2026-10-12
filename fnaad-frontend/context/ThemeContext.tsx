import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";

const BRAND_ACCENT = "#C9A24B";

const THEME_MODE_KEY = "theme_mode";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    accent: string;
    accentText: string;
  };
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const savedMode = (await AsyncStorage.getItem(THEME_MODE_KEY)) as ThemeMode | null;
      if (savedMode) setModeState(savedMode);
      setLoaded(true);
    })();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_MODE_KEY, newMode);
  };

  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  const colors =
    mode === "dark"
      ? {
          background: "#0B0A0C",
          surface: "#1A1720",
          text: "#F0ECE4",
          textMuted: "#9C979E",
          border: "#2A272C",
          accent: BRAND_ACCENT,
          accentText: "#1A1508",
        }
      : {
          background: "#F7F5F2",
          surface: "#FFFFFF",
          text: "#1A1720",
          textMuted: "#6B6670",
          border: "#DDD8D0",
          accent: BRAND_ACCENT,
          accentText: "#1A1508",
        };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
