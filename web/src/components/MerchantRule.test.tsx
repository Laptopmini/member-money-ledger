import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetRulePrompts } from "../api/queries";
import { CATEGORIES, jsonResponse, makeClient, renderWithProviders, txn } from "../test/utils";
import { TransactionList } from "./TransactionList";

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
  "merchant-rules": true,
  "category-suggestions": false,
};

function setup(opts: { rules?: boolean; previewStatus?: number; count?: number } = {}) {
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
    if (url.startsWith("/api/rules/preview")) {
      if (opts.previewStatus)
        return jsonResponse(
          { error: { code: "feature_disabled", message: "x", request_id: "r" } },
          opts.previewStatus,
        );
      return jsonResponse({
        merchant: "Figma",
        category: "software",
        matching_uncategorized_count: opts.count ?? 4,
      });
    }
    if (url === "/api/rules") return jsonResponse({ rule: {}, applied_count: 4 }, 201);
    if (url.startsWith("/api/transactions/") && init?.method === "PATCH") {
      return jsonResponse(txn({ merchant: "Figma", category: "software", updated_at: "u2" }));
    }
    if (url.startsWith("/api/transactions")) {
      return jsonResponse({
        results: [txn({ merchant: "Figma" })],
        next_cursor: null,
        synced_at: null,
      });
    }
    return jsonResponse({}, 404);
  });
  const client = makeClient();
  client.setQueryData(["flags"], { ...FLAGS, "merchant-rules": opts.rules ?? true });
  return { calls, client };
}

async function recategorize() {
  const el = await screen.findByRole("combobox", { name: "Category for Figma" });
  await screen.findByRole("option", { name: "Software & subscriptions" });
  await userEvent.selectOptions(el, "software");
}

afterEach(() => {
  vi.restoreAllMocks();
  resetRulePrompts();
});

describe("merchant rule prompt", () => {
  it("offers a rule after a successful recategorize, and Apply creates it", async () => {
    const { calls, client } = setup();
    renderWithProviders(<TransactionList />, client);
    await recategorize();
    expect(
      await screen.findByText(
        "Apply Software & subscriptions to 4 other Figma transactions? Future Figma transactions too.",
      ),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.url === "/api/rules/preview?merchant=Figma&category=software")).toBe(
      true,
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Applied to 4 transactions")).toBeInTheDocument();
    expect(calls.find((c) => c.url === "/api/rules" && c.method === "POST")?.body).toEqual({
      merchant: "Figma",
      category: "software",
    });
  });

  it("does nothing when the flag is off, the preview 404s, or nothing matches", async () => {
    for (const o of [{ rules: false }, { previewStatus: 404 }, { count: 0 }]) {
      const { client } = setup(o);
      const { unmount } = renderWithProviders(<TransactionList />, client);
      await recategorize();
      await screen.findByText("Saved to Ledgerly");
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.queryByText(/Apply .* to \d+ other/)).not.toBeInTheDocument();
      unmount();
      vi.restoreAllMocks();
      resetRulePrompts();
    }
  });

  it("Not now dismisses, and the merchant is not offered again this session", async () => {
    const { calls, client } = setup();
    renderWithProviders(<TransactionList />, client);
    await recategorize();
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByText(/Apply .* to 4 other/)).not.toBeInTheDocument());
    const before = calls.filter((c) => c.url.startsWith("/api/rules/preview")).length;
    const el = screen.getByRole("combobox", { name: "Category for Figma" });
    await userEvent.selectOptions(el, "travel");
    await screen.findAllByText("Saved to Ledgerly");
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.filter((c) => c.url.startsWith("/api/rules/preview")).length).toBe(before);
  });
});
