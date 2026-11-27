import { AppShell } from "./components/AppShell";
import { SetAsideCard } from "./components/SetAsideCard";
import { Summary } from "./components/Summary";
import { TransactionList } from "./components/TransactionList";

/** Stage 4 seam: wrap children with the login/session gate here. */
function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

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
