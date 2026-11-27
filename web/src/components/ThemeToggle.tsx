import { type Theme, useTheme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">Theme</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="segmented__item">
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={theme === o.value}
            onChange={() => setTheme(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
