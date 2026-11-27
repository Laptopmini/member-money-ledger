import { AccountMenu } from "./AccountMenu";
import { Banners } from "./Banners";
import { MonthPicker } from "./MonthPicker";
import { SyncStatus } from "./SyncStatus";

export function AppShell({ children }: { children: React.ReactNode }) {
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
          <AccountMenu />
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
