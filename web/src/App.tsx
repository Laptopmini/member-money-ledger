import { AppShell } from "./components/AppShell";
import { AuthGate } from "./components/AuthGate";
import { SetAsideCard } from "./components/SetAsideCard";
import { Summary } from "./components/Summary";
import { TransactionList } from "./components/TransactionList";

export function App() {
  return (
    <AuthGate>
      <AppShell>
        <div className="layout__summary">
          <Summary />
        </div>
        <div className="layout__setaside">
          <SetAsideCard />
        </div>
        <div className="layout__txns">
          <TransactionList />
        </div>
      </AppShell>
    </AuthGate>
  );
}
