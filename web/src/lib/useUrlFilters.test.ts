import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { currentMonth } from "./dates";
import { useUrlFilters } from "./useUrlFilters";

describe("useUrlFilters", () => {
  it("defaults month to the current month (ADR 0016)", () => {
    const { result } = renderHook(() => useUrlFilters());
    expect(result.current.filters.month).toBe(currentMonth());
    expect(result.current.hasFilters).toBe(false);
  });

  it("writes filters to the URL and reads them back", () => {
    const { result } = renderHook(() => useUrlFilters());
    act(() =>
      result.current.setFilters({
        category: ["uncategorized", "meals"],
        q: "figma",
        month: "2026-10",
      }),
    );
    expect(window.location.search).toBe(
      "?month=2026-10&category=uncategorized&category=meals&q=figma",
    );
    expect(result.current.filters.category).toEqual(["uncategorized", "meals"]);
    expect(result.current.hasFilters).toBe(true);
    act(() => result.current.clearFilters());
    expect(window.location.search).toBe("?month=2026-10");
  });

  it("follows popstate", () => {
    const { result } = renderHook(() => useUrlFilters());
    act(() => {
      window.history.replaceState(null, "", "/?status=pending&from=2026-10-01");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.filters.status).toBe("pending");
    expect(result.current.filters.from).toBe("2026-10-01");
  });
});

describe("useUrlFilters validation and month pinning", () => {
  it("ignores invalid month and dates", () => {
    window.history.replaceState(null, "", "/?month=2026-13&from=2026-1-1&to=2026-10-32");
    const { result } = renderHook(() => useUrlFilters());
    expect(result.current.filters.month).toBe(currentMonth());
    expect(result.current.filters.from).toBe("");
    expect(result.current.filters.to).toBe("");
  });

  it("keeps month in the URL once the user navigated, even if it is the current month", () => {
    const { result } = renderHook(() => useUrlFilters());
    act(() => result.current.setFilters({ month: currentMonth() }));
    expect(window.location.search).toBe(`?month=${currentMonth()}`);
  });
});
