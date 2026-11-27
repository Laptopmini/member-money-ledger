import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { historySentence } from "../lib/history";
import { CATEGORIES, jsonResponse, renderWithProviders, txn } from "../test/utils";
import { TransactionList } from "./TransactionList";

const SYNC = {
  state: "ok",
  stale: false,
  rejected_count: 0,
  last_success_at: null,
  last_attempt_at: null,
};
const HISTORY = {
  results: [
    {
      at: "2026-11-27T22:14:00Z",
      actor: "you",
      action: "recategorize",
      before: { category: null },
      after: { category: "travel" },
    },
    {
      at: "2026-11-27T18:40:00Z",
      actor: "sync",
      action: "synced",
      before: null,
      after: { status: "pending" },
    },
  ],
};

function mock(history: unknown = HISTORY) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/categories")) return jsonResponse(CATEGORIES);
    if (url.startsWith("/api/sync/status")) return jsonResponse(SYNC);
    if (url.endsWith("/history")) return jsonResponse(history);
    if (url.startsWith("/api/transactions"))
      return jsonResponse({ results: [txn()], next_cursor: null, synced_at: null });
    return jsonResponse({}, 404);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("transaction drawer", () => {
  it("opens as a modal dialog with details and history, traps focus, closes on Escape and restores focus", async () => {
    mock();
    renderWithProviders(<TransactionList />);
    const trigger = await screen.findByRole("button", { name: "Delta Air Lines" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Delta Air Lines" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close details" })).toHaveFocus();
    expect(
      await screen.findByText(/Category changed from Uncategorized to Travel/),
    ).toBeInTheDocument();
    expect(screen.getByText("Synced from Ledgerly")).toBeInTheDocument();
    expect(screen.getAllByText("−$312.75").length).toBeGreaterThan(1);
    // Tab never leaves the dialog.
    for (let i = 0; i < 8; i++) await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("shows 'No changes yet.' for an empty history", async () => {
    mock({ results: [] });
    renderWithProviders(<TransactionList />);
    await userEvent.click(await screen.findByRole("button", { name: "Delta Air Lines" }));
    expect(await screen.findByText("No changes yet.")).toBeInTheDocument();
  });
});

describe("historySentence", () => {
  it("writes human sentences", () => {
    const cats = CATEGORIES.results as never;
    expect(
      historySentence(
        {
          at: "",
          actor: "rule",
          action: "rule_applied",
          before: null,
          after: { category: "software" },
        },
        cats,
      ),
    ).toBe("Category set to Software & subscriptions by your rule");
    expect(
      historySentence(
        { at: "", actor: "sync", action: "tombstoned", before: null, after: null },
        cats,
      ),
    ).toBe("No longer in your bank feed");
    expect(
      historySentence(
        { at: "", actor: "sync", action: "replaced", before: null, after: null },
        cats,
      ),
    ).toBe("Updated by your bank feed");
  });
});
