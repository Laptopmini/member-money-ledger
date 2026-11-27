import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderWithProviders } from "../test/utils";
import { SetAsideCard } from "./SetAsideCard";

const FLAGS = {
  "tax-set-aside": true,
  "auth-required": false,
  "merchant-rules": false,
  "category-suggestions": false,
};
const SA = {
  quarter: "2026-Q4",
  period_start: "2026-09-01",
  period_end: "2026-12-31",
  due_on: "2027-01-15",
  days_until_due: 49,
  rate: 0.25,
  income_cents: 850000,
  deductible_cents: 2300,
  profit_cents: 847700,
  estimate_cents: 211925,
  set_aside_cents: 120000,
  gap_cents: 91925,
  status: "behind",
  uncategorized_debit_count: 3,
  uncategorized_debit_cents: 31275,
  potential_reduction_cents: 7819,
  disclaimer: "An estimate, not tax advice.",
};

function mock(sa: object, flags = FLAGS) {
  const posts: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/flags") return jsonResponse(flags);
    if (url.startsWith("/api/tax/set-aside-marks")) {
      posts.push(JSON.parse(String(init?.body)));
      return jsonResponse(
        { quarter: "2026-Q4", amount_cents: 91925, set_aside_cents: 211925, created_at: "x" },
        201,
      );
    }
    if (url.startsWith("/api/tax/set-aside")) return jsonResponse(sa);
    return jsonResponse({}, 404);
  });
  return posts;
}

afterEach(() => vi.restoreAllMocks());

describe("SetAsideCard", () => {
  it("behind: title, due text, estimate, amber pill, progress bar, incentive, footer", async () => {
    mock(SA);
    renderWithProviders(<SetAsideCard />);
    expect(await screen.findByText("Set aside for taxes · Q4 (Sep–Dec)")).toBeInTheDocument();
    expect(
      screen.getByText("Federal estimated payment due Jan 15, 2027 · 49 days"),
    ).toBeInTheDocument();
    expect(screen.getByText("$2,119.25")).toBeInTheDocument();
    expect(screen.getByText(/25% of/)).toBeInTheDocument();
    expect(screen.getByText("$8,477.00")).toBeInTheDocument();
    expect(screen.getByText("$919.25 to go")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "57");
    expect(
      screen.getByText(/Categorize 3 transactions\. Your estimate could drop by up to about/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An estimate, not tax advice\. Meals count at 50%/),
    ).toBeInTheDocument();
  });

  it("incentive line filters to uncategorized across the quarter", async () => {
    mock(SA);
    renderWithProviders(<SetAsideCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Review it" }));
    expect(window.location.search).toContain("category=uncategorized");
    expect(window.location.search).toContain("from=2026-09-01");
    expect(window.location.search).toContain("to=2026-12-31");
  });

  it("on_track shows the green pill and no incentive without uncategorized debits", async () => {
    mock({
      ...SA,
      status: "on_track",
      gap_cents: 0,
      set_aside_cents: 211925,
      uncategorized_debit_count: 0,
    });
    renderWithProviders(<SetAsideCard />);
    expect(await screen.findByText("On track")).toBeInTheDocument();
    expect(screen.queryByText(/Categorize \d/)).not.toBeInTheDocument();
  });

  it("no_income shows the empty state", async () => {
    mock({ ...SA, status: "no_income", estimate_cents: 0, profit_cents: 0, income_cents: 0 });
    renderWithProviders(<SetAsideCard />);
    expect(
      await screen.findByText("Once income arrives we'll estimate what to set aside"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as set aside" })).not.toBeInTheDocument();
  });

  it("mark flow: prefilled gap, sends cents, shows success", async () => {
    const posts = mock(SA);
    renderWithProviders(<SetAsideCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Mark as set aside" }));
    const input = screen.getByLabelText("Amount set aside ($)");
    expect(input).toHaveValue("919.25");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Nice. $919.25 set aside for Q4.")).toBeInTheDocument();
    expect(posts).toEqual([{ quarter: "2026-Q4", amount_cents: 91925 }]);
  });

  it("mark form rejects invalid amounts", async () => {
    mock(SA);
    renderWithProviders(<SetAsideCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Mark as set aside" }));
    const input = screen.getByLabelText("Amount set aside ($)");
    await userEvent.clear(input);
    await userEvent.type(input, "-5");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("renders nothing when the flag is off", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        jsonResponse(
          String(input) === "/api/flags" ? { ...FLAGS, "tax-set-aside": false } : {},
          200,
        ),
      );
    const { container } = renderWithProviders(<SetAsideCard />);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(container.querySelector(".set-aside")).toBeNull();
    expect(spy.mock.calls.some((c) => String(c[0]).startsWith("/api/tax/set-aside"))).toBe(false);
  });

  it("sends today as a local date and handles the new ADR 0021 fields", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/flags") return jsonResponse(FLAGS);
      return jsonResponse({
        ...SA,
        refund_adjustment_cents: 2400,
        pending_uncategorized_debit_count: 2,
        is_current_period: false,
        days_until_due: 5,
        due_on: "2027-01-15",
      });
    });
    renderWithProviders(<SetAsideCard />);
    expect(
      await screen.findByText(/Includes a \$24\.00 refund for an earlier purchase/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(2 more pending\)/)).toBeInTheDocument();
    expect(screen.getByText("Payment due Jan 15 · in 5 days")).toBeInTheDocument();
    const call = spy.mock.calls.find((c) => String(c[0]).startsWith("/api/tax/set-aside"));
    expect(String(call?.[0])).toMatch(/[?&]today=\d{4}-\d{2}-\d{2}/);
  });

  it("needs_review points at uncategorized deposits", async () => {
    mock({
      ...SA,
      status: "needs_review",
      income_cents: 0,
      estimate_cents: 0,
      uncategorized_credit_cents: 500000,
    });
    renderWithProviders(<SetAsideCard />);
    expect(
      await screen.findByText(/We found \$5,000\.00 of deposits without a category/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review deposits" }));
    expect(window.location.search).toContain("category=uncategorized");
  });
});
