import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("apiFetch", () => {
  it("sends the activity header only when asked, and CSRF on unsafe methods", async () => {
    document.cookie = "csrftoken=abc123";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
    await apiFetch("/api/x");
    await apiFetch("/api/x", { method: "POST", userActivity: true });
    const get = spy.mock.calls[0][1]?.headers as Record<string, string>;
    const post = spy.mock.calls[1][1]?.headers as Record<string, string>;
    expect(get["X-User-Activity"]).toBeUndefined();
    expect(get["X-CSRFToken"]).toBeUndefined();
    expect(post["X-User-Activity"]).toBe("1");
    expect(post["X-CSRFToken"]).toBe("abc123");
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
});
