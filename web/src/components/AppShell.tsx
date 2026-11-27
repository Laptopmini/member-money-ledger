import { AccountMenu } from "./AccountMenu";
import { Banners } from "./Banners";
import { MonthPicker } from "./MonthPicker";
import { SyncStatus } from "./SyncStatus";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <a className="app-header__brand" href="/">
          <span className="app-header__brand-mark" aria-hidden="true">
            <svg className="icon icon--sm" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="3" y="3.5" width="14" height="13" rx="2" />
              <circle cx="10" cy="10" r="2.75" />
              <path d="M5.5 16.5v1M14.5 16.5v1" />
            </svg>
          </span>
          <span>Ledger</span>
        </a>
        <MonthPicker />
        <div className="app-header__actions">
          <SyncStatus />
          <AccountMenu />
        </div>
      </header>
      <div className="app__banners">
        <Banners />
      </div>
      <main id="main" className="app__main" tabIndex={-1}>
        <div className="layout">{children}</div>
      </main>
    </div>
  );
}
