import { useEffect, useRef, useState } from "react";
import { type Theme, useTheme } from "../lib/theme";
import { useAuth } from "./AuthGate";
import { ChevronDown, LogOut } from "./icons";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** The member's name opens a menu with the theme control and Sign out. */
export function AccountMenu() {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    const el = wrap.current;
    el?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      el?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const name = auth ? auth.user.name || auth.user.email : "Settings";
  return (
    <div className="account-menu" ref={wrap}>
      <button
        type="button"
        ref={btn}
        className="btn btn--ghost btn--sm account-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-menu__name">{name}</span>
        <ChevronDown />
      </button>
      {open && (
        <div id="account-menu-panel" className="menu">
          {auth && (
            <div className="menu__section">
              <p className="menu__heading">Signed in as</p>
              <p>{auth.user.email}</p>
            </div>
          )}
          <div className="menu__section">
            <p className="menu__heading">Theme</p>
            <fieldset className="segmented">
              <legend className="visually-hidden">Theme</legend>
              {OPTIONS.map((o) => (
                <label key={o.value} className="segmented__option">
                  <input
                    type="radio"
                    name="theme"
                    value={o.value}
                    checked={theme === o.value}
                    onChange={() => setTheme(o.value)}
                  />
                  <span className="segmented__label">{o.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
          {auth && (
            <div className="menu__section">
              <button
                type="button"
                className="menu__item"
                disabled={auth.signingOut}
                onClick={auth.signOut}
              >
                <LogOut /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
