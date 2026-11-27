import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("formats integer cents", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(-4599)).toBe("-$45.99");
  });
  it("shows an explicit sign on request", () => {
    expect(formatCents(2400, { signDisplay: "always" })).toBe("+$24.00");
    expect(formatCents(-2400, { signDisplay: "always" })).toBe("-$24.00");
  });
});
