import { describe, expect, it } from "vitest";
import { addMonths, currentMonth, formatPostedOn, monthLabel, monthOf, monthRange } from "./dates";

describe("dates", () => {
  it("runs in a negative-UTC zone so date-only parsing bugs would show", () => {
    expect(new Date(2026, 9, 1).getTimezoneOffset()).toBeGreaterThan(0);
  });
  it("formatPostedOn does not shift the day (trap 4)", () => {
    expect(formatPostedOn("2026-10-01")).toBe("Oct 1");
    expect(formatPostedOn("2026-12-31")).toBe("Dec 31");
  });
  it("currentMonth uses local parts", () => {
    expect(currentMonth(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(currentMonth(new Date(2027, 0, 1, 0, 0))).toBe("2027-01");
  });
  it("addMonths crosses year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });
  it("monthLabel and monthOf", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthOf("2026-10-14")).toBe("2026-10");
  });
  it("monthRange has the right last day", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(monthRange("2026-04").to).toBe("2026-04-30");
  });
});

describe("formatClockOrDate", () => {
  it("shows only the time for today and the date otherwise", async () => {
    const { formatClockOrDate } = await import("./dates");
    const now = new Date(2026, 10, 27, 15, 0);
    expect(formatClockOrDate(new Date(2026, 10, 27, 10, 42).toISOString(), now)).toBe("10:42 AM");
    expect(formatClockOrDate(new Date(2026, 10, 26, 10, 42).toISOString(), now)).toBe(
      "Nov 26, 10:42 AM",
    );
  });
});
