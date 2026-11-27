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

describe("parseDollarsToCents", () => {
  it("parses with string math", async () => {
    const { parseDollarsToCents } = await import("./money");
    expect(parseDollarsToCents("12.3")).toBe(1230);
    expect(parseDollarsToCents("0.07")).toBe(7);
    expect(parseDollarsToCents("1,234.56")).toBe(123456);
    expect(parseDollarsToCents("$903")).toBe(90300);
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("1.15")).toBe(115);
  });
  it("rejects junk", async () => {
    const { parseDollarsToCents } = await import("./money");
    for (const bad of ["abc", "-5", "", ".", "1.234", "1,23.00", "1e3", "5 0"]) {
      expect(parseDollarsToCents(bad)).toBeNull();
    }
  });
  it("round-trips for the prefilled gap", async () => {
    const { centsToDollarsInput, parseDollarsToCents } = await import("./money");
    expect(centsToDollarsInput(90325)).toBe("903.25");
    expect(centsToDollarsInput(7)).toBe("0.07");
    expect(parseDollarsToCents(centsToDollarsInput(90325))).toBe(90325);
  });
  it("parsePercent accepts 0..60", async () => {
    const { parsePercent } = await import("./money");
    expect(parsePercent("25")).toBe(25);
    expect(parsePercent("7.5%")).toBe(7.5);
    expect(parsePercent("61")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
    expect(parsePercent("x")).toBeNull();
  });
});
