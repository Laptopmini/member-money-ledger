import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, jsonResponse, makeClient, renderWithProviders, txn } from "../test/utils";
import { resetSuggestionCaption, TransactionList } from "./TransactionList";

const SYNC = {
  state: "ok",
  stale: false,
  rejected_count: 0,
  last_success_at: null,
  last_attempt_at: null,
};
const FLAGS = {
  "tax-set-aside": false,
  "auth-required": false,
  "merchant-rules": false,
  "category-suggestions": true,
};

function setup(suggestion: () => Response, on = true, rows: unknown[] = [txn()]) {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.startsWith("/api/categories")) return jsonResponse(CATEGORIES);
    if (url.startsWith("/api/sync/status")) return jsonResponse(SYNC);
    if (url.endsWith("/suggestion")) return suggestion();
    if (url.startsWith("/api/transactions/") && init?.method === "PATCH") {
      return jsonResponse(txn({ category: "travel", updated_at: "u2" }));
    }
    if (url.startsWith("/api/transactions")) {
      return jsonResponse({ results: rows, next_cursor: null, synced_at: null });
    }
    return jsonResponse({}, 404);
  });
  const client = makeClient();
  client.setQueryData(["flags"], { ...FLAGS, "category-suggestions": on });
  return { calls, client };
}

afterEach(() => {
  vi.restoreAllMocks();
  resetSuggestionCaption();
});

describe("suggestion chip", () => {
  it("shows the chip and caption for an uncategorized row; Accept recategorizes, never auto-applies", async () => {
    const { calls, client } = setup(() =>
      jsonResponse({ category: "travel", label: "Travel", source: "model", model: "m" }),
    );
    renderWithProviders(<TransactionList />, client);
    expect(await screen.findByText("Suggested: Travel")).toBeInTheDocument();
    expect(
      screen.getByText("Suggestions come from an AI model and can be wrong."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.click(screen.getByRole("button", { name: /Accept suggestion Travel/ }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        category: "travel",
        expected_updated_at: "2026-10-14T22:18:40Z",
      }),
    );
  });

  it("dismiss hides the chip", async () => {
    const { client } = setup(() =>
      jsonResponse({ category: "travel", label: "Travel", source: "rule" }),
    );
    renderWithProviders(<TransactionList />, client);
    await userEvent.click(await screen.findByRole("button", { name: /Dismiss suggestion/ }));
    expect(screen.queryByText("Suggested: Travel")).not.toBeInTheDocument();
  });

  it("shows nothing for a null suggestion, an error, or when the flag is off", async () => {
    for (const [fn, on] of [
      [() => jsonResponse({ category: null }), true],
      [
        () =>
          jsonResponse({ error: { code: "feature_disabled", message: "x", request_id: "r" } }, 404),
        true,
      ],
      [() => jsonResponse({ category: "travel", label: "Travel" }), false],
    ] as const) {
      const { calls, client } = setup(fn, on);
      const { unmount } = renderWithProviders(<TransactionList />, client);
      await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.queryByText(/Suggested:/)).not.toBeInTheDocument();
      if (!on) expect(calls.some((c) => c.url.endsWith("/suggestion"))).toBe(false);
      unmount();
      vi.restoreAllMocks();
    }
  });

  it("only asks for uncategorized rows", async () => {
    const { calls, client } = setup(() => jsonResponse({ category: null }), true, [
      txn({ id: "done", category: "meals", category_label: "Meals" }),
    ]);
    renderWithProviders(<TransactionList />, client);
    await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.some((c) => c.url.endsWith("/suggestion"))).toBe(false);
  });
});
