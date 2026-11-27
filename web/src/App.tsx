import { AppShell } from "./components/AppShell";
import { AuthGate } from "./components/AuthGate";
import { SetAsideCard } from "./components/SetAsideCard";
import { Summary } from "./components/Summary";
import { TransactionList } from "./components/TransactionList";

export function App() {
  return (
    <AuthGate>
      <AppShell>
        <div className="layout__top">
          <Summary />
          <SetAsideCard />
        </div>
        <TransactionList />
      </AppShell>
    </AuthGate>
  );
}
