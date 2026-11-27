import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("never retries 4xx, retries 5xx and network errors once", () => {
    expect(shouldRetry(0, new ApiError(404, "x", "m"))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, "x", "m"))).toBe(false);
    expect(shouldRetry(0, new ApiError(502, "x", "m"))).toBe(true);
    expect(shouldRetry(0, new ApiError(0, "network", "m"))).toBe(true);
    expect(shouldRetry(1, new ApiError(502, "x", "m"))).toBe(false);
  });
});
