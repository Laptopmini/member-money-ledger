import { Banners } from "./Banners";
import { MonthPicker } from "./MonthPicker";
import { SyncStatus } from "./SyncStatus";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__title">Ledger</h1>
          <ThemeToggle />
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
