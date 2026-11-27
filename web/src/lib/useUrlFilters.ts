import { useCallback, useMemo, useSyncExternalStore } from "react";
import { currentMonth } from "./dates";

export type Filters = {
  month: string;
  category: string[];
  from: string;
  to: string;
  status: "" | "pending" | "posted";
  account: string;
  q: string;
};

const EVENT = "urlfilterschange";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const getSearch = () => window.location.search;

export function parseFilters(search: string, now: Date = new Date()): Filters {
  const sp = new URLSearchParams(search);
  const status = sp.get("status");
  return {
    month: /^\d{4}-\d{2}$/.test(sp.get("month") ?? "")
      ? (sp.get("month") as string)
      : currentMonth(now),
    category: sp.getAll("category").filter(Boolean),
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    status: status === "pending" || status === "posted" ? status : "",
    account: sp.get("account") ?? "",
    q: sp.get("q") ?? "",
  };
}

function write(next: Filters) {
  const sp = new URLSearchParams();
  // Month is only written once the user picks one; otherwise it follows the clock (ADR 0016).
  if (next.month !== currentMonth()) sp.set("month", next.month);
  for (const c of next.category) sp.append("category", c);
  for (const k of ["from", "to", "status", "account", "q"] as const) {
    if (next[k]) sp.set(k, next[k]);
  }
  const qs = sp.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function useUrlFilters() {
  const search = useSyncExternalStore(subscribe, getSearch, () => "");
  const filters = useMemo(() => parseFilters(search), [search]);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    write({ ...parseFilters(getSearch()), ...patch });
  }, []);

  const clearFilters = useCallback(() => {
    const { month } = parseFilters(getSearch());
    write({ month, category: [], from: "", to: "", status: "", account: "", q: "" });
  }, []);

  const hasFilters =
    filters.category.length > 0 ||
    !!(filters.from || filters.to || filters.status || filters.account || filters.q);

  return { filters, setFilters, clearFilters, hasFilters };
}
