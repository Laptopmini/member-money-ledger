// Starter page. It proves the wiring works: web -> api -> vendor.
// Replace it with your own design.
import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  posted_on: string;
  merchant: string;
  amount_cents: number;
  direction: "debit" | "credit";
  category: string | null;
};

export function App() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then((body) => setRows(body.results))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p>Could not load: {error}</p>;

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Transactions</h1>
      <ul>
        {rows.map((t) => (
          <li key={t.id}>
            {t.posted_on} · {t.merchant} · {t.direction === "debit" ? "-" : "+"}$
            {(t.amount_cents / 100).toFixed(2)} · {t.category ?? "uncategorized"}
          </li>
        ))}
      </ul>
    </main>
  );
}
