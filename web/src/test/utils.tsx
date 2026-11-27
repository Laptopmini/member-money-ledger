import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "../components/Toasts";

export function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
}

export function renderWithProviders(ui: ReactElement, client = makeClient(), opts?: RenderOptions) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>,
      opts,
    ),
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function txn(over: Record<string, unknown> = {}) {
  return {
    id: "txn_1",
    account_id: "acc_card",
    account_label: "Card",
    posted_on: "2026-10-14",
    amount_cents: 31275,
    direction: "debit",
    signed_cents: -31275,
    currency: "USD",
    merchant: "Delta Air Lines",
    description: "AUS to SFO",
    category: null,
    category_label: "Uncategorized",
    category_known: true,
    status: "posted",
    kind: "spend",
    updated_at: "2026-10-14T22:18:40Z",
    ...over,
  };
}

export const CATEGORIES = {
  results: [
    {
      key: "income",
      label: "Income",
      schedule_c_line: "1",
      deductible_fraction: 0,
      kind: "income",
    },
    {
      key: "software",
      label: "Software & subscriptions",
      schedule_c_line: "18",
      deductible_fraction: 1,
      kind: "expense",
    },
    {
      key: "travel",
      label: "Travel",
      schedule_c_line: "24a",
      deductible_fraction: 1,
      kind: "expense",
    },
  ],
};
