import { type Theme, useTheme } from "../lib/theme";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

/** One compact button that cycles system, light, dark. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small theme-toggle"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]}`}
      onClick={() => setTheme(next)}
    >
      <span aria-hidden="true">{ICON[theme]}</span>
      <span className="theme-toggle__text" aria-hidden="true">
        {LABEL[theme]}
      </span>
    </button>
  );
}
