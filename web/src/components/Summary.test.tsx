import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderWithProviders } from "../test/utils";
import { Summary } from "./Summary";

const base = {
  month: "2026-10",
  income_cents: 850000,
  spend_cents: 4599,
  net_cents: 845401,
  pending_cents: 31275,
  pending_count: 1,
  pending_income_cents: 0,
  uncategorized_count: 1,
  uncategorized_credit_cents: 0,
  uncategorized_credit_count: 0,
  excluded_currency_count: 0,
  by_category: [
    { category: "meals", label: "Meals", spend_cents: 4599, count: 1 },
    { category: null, label: "Uncategorized", spend_cents: 0, count: 1 },
  ],
  latest_month_with_data: "2026-10",
  synced_at: "2026-11-27T18:40:02Z",
};

afterEach(() => vi.restoreAllMocks());

describe("Summary", () => {
  it("shows the pending note and the uncategorized nudge", async () => {
    window.history.replaceState(null, "", "/?month=2026-10");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse(base));
    renderWithProviders(<Summary />);
    expect(await screen.findByText(/\+ \$312\.75 pending/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "1 transaction needs a category" }));
    expect(window.location.search).toContain("category=uncategorized");
  });

  it("empty month offers a jump to the latest month with data", async () => {
    window.history.replaceState(null, "", "/?month=2026-11");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      jsonResponse(
        String(input).includes("2026-11")
          ? {
              ...base,
              month: "2026-11",
              income_cents: 0,
              spend_cents: 0,
              net_cents: 0,
              pending_cents: 0,
              pending_count: 0,
              uncategorized_count: 0,
              by_category: [],
            }
          : base,
      ),
    );
    renderWithProviders(<Summary />);
    expect(await screen.findByText("No transactions in November yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Jump to October 2026" }));
    await waitFor(() => expect(window.location.search).toContain("month=2026-10"));
  });

  it("is not empty when only pending income or non-USD rows exist, and shows pending income", async () => {
    window.history.replaceState(null, "", "/?month=2026-11");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonResponse({
        ...base,
        month: "2026-11",
        income_cents: 0,
        spend_cents: 0,
        net_cents: 0,
        pending_cents: 0,
        pending_count: 1,
        pending_income_cents: 50000,
        uncategorized_count: 0,
        by_category: [],
      }),
    );
    renderWithProviders(<Summary />);
    expect(await screen.findByText(/\+ \$500\.00 pending/)).toBeInTheDocument();
    expect(screen.queryByText(/No transactions in/)).not.toBeInTheDocument();
  });
});
