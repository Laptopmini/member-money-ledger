import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES, jsonResponse, renderWithProviders, txn } from "../test/utils";
import { TransactionList } from "./TransactionList";

const SYNC = {
  state: "ok",
  stale: false,
  rejected_count: 0,
  last_success_at: null,
  last_attempt_at: null,
};

type Patch = { id: string; body: { category: string; expected_updated_at: string } };

/** After the first list load, refetches hang, so the cache only reflects optimistic/onSuccess/rollback. */
function mockApi(rows: unknown[], onPatch: (p: Patch) => Response | Promise<Response>) {
  let hold = false;
  const patches: Patch[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/categories")) return jsonResponse(CATEGORIES);
    if (url.startsWith("/api/sync/status")) return jsonResponse(SYNC);
    if (url.startsWith("/api/transactions/") && init?.method === "PATCH") {
      const p = { id: url.split("/").pop() as string, body: JSON.parse(String(init.body)) };
      patches.push(p);
      return onPatch(p);
    }
    if (url.startsWith("/api/transactions")) {
      if (hold) return new Promise<Response>(() => {});
      hold = true;
      return jsonResponse({ results: rows, next_cursor: null, synced_at: null });
    }
    return jsonResponse({}, 404);
  });
  return patches;
}

const select = (merchant: string) =>
  screen.findByRole("combobox", { name: `Category for ${merchant}` });

afterEach(() => vi.restoreAllMocks());

describe("recategorize concurrency", () => {
  it("second quick change on the same row sends the first response's updated_at", async () => {
    let n = 1;
    const patches = mockApi([txn()], ({ body }) =>
      jsonResponse(
        txn({ category: body.category, kind: "spend", updated_at: `2026-11-27T10:00:0${n++}Z` }),
      ),
    );
    renderWithProviders(<TransactionList />);
    const el = await select("Delta Air Lines");
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(el, "travel");
    await waitFor(() => expect(el).not.toBeDisabled());
    await userEvent.selectOptions(el, "software");
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[0].body.expected_updated_at).toBe("2026-10-14T22:18:40Z");
    expect(patches[1].body.expected_updated_at).toBe("2026-11-27T10:00:01Z");
  });

  it("disables the row's select while its own request is pending", async () => {
    let release: (r: Response) => void = () => {};
    mockApi(
      [txn()],
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    renderWithProviders(<TransactionList />);
    const el = await select("Delta Air Lines");
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(el, "travel");
    await waitFor(() => expect(el).toBeDisabled());
    release(jsonResponse(txn({ category: "travel", updated_at: "x" })));
    await waitFor(() => expect(el).not.toBeDisabled());
  });

  it("rolls back only the failed row; a back-to-back success on another row keeps its category", async () => {
    let failX: (r: Response) => void = () => {};
    mockApi(
      [txn({ id: "x", merchant: "Xco" }), txn({ id: "y", merchant: "Yco" })],
      ({ id, body }) =>
        id === "x"
          ? new Promise<Response>((r) => {
              failX = r;
            })
          : jsonResponse(
              txn({ id: "y", merchant: "Yco", category: body.category, updated_at: "y2" }),
            ),
    );
    renderWithProviders(<TransactionList />);
    const x = await select("Xco");
    const y = await select("Yco");
    await screen.findAllByRole("option", { name: "Travel" });
    await userEvent.selectOptions(x, "travel");
    await userEvent.selectOptions(y, "software");
    await waitFor(() => expect(y).not.toBeDisabled());
    failX(
      jsonResponse(
        { error: { code: "vendor_unavailable", message: "Nothing was changed.", request_id: "r" } },
        502,
      ),
    );
    await screen.findByText("Nothing was changed.");
    await waitFor(() => expect(x).toHaveValue(""));
    expect(y).toHaveValue("software");
  });

  it("keeps the previous kind (no guess) until the server row arrives", async () => {
    let release: (r: Response) => void = () => {};
    mockApi(
      [txn({ direction: "credit", amount_cents: 2400, category: "software", kind: "refund" })],
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    renderWithProviders(<TransactionList />);
    const el = await select("Delta Air Lines");
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(el, "income");
    await waitFor(() => expect(el).toBeDisabled());
    expect(screen.getByText("Refund", { selector: ".badge" })).toBeInTheDocument();
    release(
      jsonResponse(
        txn({ category: "income", kind: "income", direction: "credit", updated_at: "z" }),
      ),
    );
    expect(await screen.findByText("Income", { selector: ".badge" })).toBeInTheDocument();
  });

  it("moves focus and announces when the row leaves a category filter", async () => {
    window.history.replaceState(null, "", "/?category=uncategorized");
    mockApi([txn({ id: "a", merchant: "Aco" }), txn({ id: "b", merchant: "Bco" })], ({ body }) =>
      jsonResponse(txn({ id: "a", merchant: "Aco", category: body.category, updated_at: "a2" })),
    );
    renderWithProviders(<TransactionList />);
    const a = await select("Aco");
    await screen.findAllByRole("option", { name: "Travel" });
    await userEvent.selectOptions(a, "travel");
    expect(await screen.findByText("Moved out of this filter")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category for Bco" })).toHaveFocus();
  });
});

describe("list errors", () => {
  it("shows an inline Retry when Load more fails", async () => {
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/categories")) return jsonResponse(CATEGORIES);
      if (url.startsWith("/api/sync/status")) return jsonResponse(SYNC);
      calls++;
      if (calls === 1) return jsonResponse({ results: [txn()], next_cursor: "c", synced_at: null });
      return jsonResponse({ error: { code: "x", message: "m", request_id: "r" } }, 500);
    });
    renderWithProviders(<TransactionList />);
    await userEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Couldn't load more transactions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
