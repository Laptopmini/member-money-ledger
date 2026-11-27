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

describe("formatMinor", () => {
  it("uses the currency's own fraction digits", async () => {
    const { formatMinor } = await import("./money");
    expect(formatMinor(1234, "EUR")).toBe("€12.34");
    expect(formatMinor(1234, "JPY")).toBe("¥1,234");
    expect(formatMinor(4599, "USD")).toBe("$45.99");
  });
});
