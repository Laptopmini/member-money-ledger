import { screen, waitFor, within } from "@testing-library/react";
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

function mockApi(rows: unknown[], patch?: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("/api/categories")) return jsonResponse(CATEGORIES);
    if (url.startsWith("/api/sync/status")) return jsonResponse(SYNC);
    if (url.startsWith("/api/transactions/") && init?.method === "PATCH") {
      return patch ? patch() : jsonResponse({});
    }
    if (url.startsWith("/api/transactions")) {
      return jsonResponse({ results: rows, next_cursor: null, synced_at: null });
    }
    return jsonResponse({}, 404);
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("TransactionList", () => {
  it("renders pending, refund, transfer and uncategorized badges", async () => {
    mockApi([
      txn({ id: "a", status: "pending" }),
      txn({
        id: "b",
        merchant: "Figma",
        direction: "credit",
        amount_cents: 2400,
        category: "software",
        category_label: "Software & subscriptions",
        kind: "refund",
      }),
      txn({
        id: "c",
        merchant: "Card payment",
        category: "transfer",
        category_label: "Transfer",
        kind: "transfer",
      }),
    ]);
    renderWithProviders(<TransactionList />);
    expect(await screen.findByText("Pending", { selector: ".badge" })).toBeInTheDocument();
    expect(screen.getByText("Refund", { selector: ".badge" })).toBeInTheDocument();
    expect(screen.getByText("Transfer · not counted", { selector: ".badge" })).toBeInTheDocument();
    expect(
      screen.getByText("Uncategorized", { selector: ".cat-picker__value" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+$24.00")).toBeInTheDocument();
    expect(screen.getAllByText("Oct 14", { selector: ".txn-row__date time" })).toHaveLength(3);
  });

  it("recategorizes optimistically, sends expected_updated_at and user activity", async () => {
    let release: (r: Response) => void = () => {};
    const calls = mockApi(
      [txn()],
      () =>
        new Promise<Response>((res) => {
          release = res;
        }),
    );
    renderWithProviders(<TransactionList />);
    const select = await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(select, "travel");
    await waitFor(() => expect(select).toHaveValue("travel"));
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(JSON.parse(String(patch?.init?.body))).toEqual({
      category: "travel",
      expected_updated_at: "2026-10-14T22:18:40Z",
    });
    expect((patch?.init?.headers as Record<string, string> | undefined)?.["X-User-Activity"]).toBe(
      "1",
    );
    release(jsonResponse(txn({ category: "travel" })));
  });

  it("rolls back and toasts on 409 stale", async () => {
    mockApi([txn()], () =>
      jsonResponse({ error: { code: "stale", message: "x", request_id: "r" } }, 409),
    );
    renderWithProviders(<TransactionList />);
    const select = await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(select, "travel");
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(/This transaction changed in your bank feed/),
    ).toBeInTheDocument();
    await waitFor(() => expect(select).toHaveValue(""));
  });

  it("rolls back on 502 and shows the envelope message with Retry", async () => {
    mockApi([txn()], () =>
      jsonResponse(
        { error: { code: "vendor_unavailable", message: "Nothing was changed.", request_id: "r" } },
        502,
      ),
    );
    renderWithProviders(<TransactionList />);
    const select = await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
    await screen.findByRole("option", { name: "Travel" });
    await userEvent.selectOptions(select, "travel");
    expect(await screen.findByText("Nothing was changed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    await waitFor(() => expect(select).toHaveValue(""));
  });

  it("does not roll back on vendor_unconfirmed and refetches instead", async () => {
    const calls = mockApi([txn()], () =>
      jsonResponse(
        {
          error: {
            code: "vendor_unconfirmed",
            message: "Your change may have been saved. Refresh to check.",
            request_id: "r",
          },
        },
        502,
      ),
    );
    renderWithProviders(<TransactionList />);
    const select = await screen.findByRole("combobox", { name: "Category for Delta Air Lines" });
    await screen.findByRole("option", { name: "Travel" });
    const before = calls.filter((c) => c.url.startsWith("/api/transactions?")).length;
    await userEvent.selectOptions(select, "travel");
    expect(await screen.findByText(/may have been saved/)).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((c) => c.url.startsWith("/api/transactions?")).length).toBeGreaterThan(
        before,
      ),
    );
  });
});
