import { useCallback, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "ledger-theme";

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, set] = useState<Theme>(getStoredTheme);
  const setTheme = useCallback((t: Theme) => {
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    applyTheme(t);
    set(t);
  }, []);
  return { theme, setTheme };
}
