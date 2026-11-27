import { useAuth } from "./AuthGate";
import { Banners } from "./Banners";
import { LogOut } from "./icons";
import { MonthPicker } from "./MonthPicker";
import { SyncStatus } from "./SyncStatus";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__title">
            <span className="app-header__brand-mark" aria-hidden="true">
              L
            </span>
            Ledger
          </h1>
          <ThemeToggle />
          {auth && (
            <div className="account">
              <span className="account__name">{auth.user.name || auth.user.email}</span>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                disabled={auth.signingOut}
                onClick={auth.signOut}
              >
                <LogOut /> Sign out
              </button>
            </div>
          )}
          <div className="app-header__row">
            <MonthPicker />
            <SyncStatus />
          </div>
        </div>
      </header>
      <Banners />
      <main id="main" className="layout" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
