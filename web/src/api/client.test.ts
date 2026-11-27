import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, markInteraction } from "./client";

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("apiFetch", () => {
  it("sends the activity header only when asked, and CSRF on unsafe methods", async () => {
    document.cookie = "csrftoken=abc123";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({}));
    markInteraction(Number.NEGATIVE_INFINITY);
    await apiFetch("/api/x");
    await apiFetch("/api/x", { method: "POST", userActivity: true });
    const get = spy.mock.calls[0][1]?.headers as Record<string, string>;
    const post = spy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(get["X-User-Activity"]).toBeUndefined();
    expect(get["X-CSRFToken"]).toBeUndefined();
    expect(post["X-User-Activity"]).toBe("1");
    expect(post["X-CSRFToken"]).toBe("abc123");
  });

  it("sends the activity header only after real input in the last 60s", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({}));
    const header = (i: number) =>
      (spy.mock.calls[i][1]?.headers as Record<string, string> | undefined)?.["X-User-Activity"];
    markInteraction(Date.now() - 120_000);
    await apiFetch("/api/x");
    expect(header(0)).toBeUndefined();
    window.dispatchEvent(new Event("keydown"));
    await apiFetch("/api/x");
    expect(header(1)).toBe("1");
    markInteraction(Date.now() - 61_000);
    await apiFetch("/api/x");
    expect(header(2)).toBeUndefined();
    await apiFetch("/api/x", { method: "PATCH", userActivity: true });
    expect(header(3)).toBe("1");
  });

  it("always sends a JSON content type and body on unsafe methods (API returns 415 otherwise)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({}));
    await apiFetch("/api/sync", { method: "POST", userActivity: true });
    const init = spy.mock.calls[0][1];
    expect((init?.headers as Record<string, string> | undefined)?.["Content-Type"]).toBe(
      "application/json",
    );
    expect(init?.body).toBe("{}");
    await apiFetch("/api/x");
    expect(spy.mock.calls[1][1]?.body).toBeUndefined();
  });

  it("parses the error envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: "stale", message: "m", request_id: "r" } }), {
          status: 409,
        }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 409,
      code: "stale",
      message: "m",
    });
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws bad_response for a 2xx that is not JSON, and treats 204 as null", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ status: 200, code: "bad_response" });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response("{oops", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ code: "bad_response" });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(null, { status: 204 }),
    );
    await expect(apiFetch("/api/x", { method: "POST" })).resolves.toBeNull();
  });
});
