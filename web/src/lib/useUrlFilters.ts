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

function validMonth(v: string | null): string | null {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

function validDate(v: string | null): string {
  const m = v ? /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(v) : null;
  return m && v ? v : "";
}

export function parseFilters(search: string, now: Date = new Date()): Filters {
  const sp = new URLSearchParams(search);
  const status = sp.get("status");
  return {
    month: validMonth(sp.get("month")) ?? currentMonth(now),
    category: sp.getAll("category").filter(Boolean),
    from: validDate(sp.get("from")),
    to: validDate(sp.get("to")),
    status: status === "pending" || status === "posted" ? status : "",
    account: sp.get("account") ?? "",
    q: sp.get("q") ?? "",
  };
}

function write(next: Filters, pinMonth = false) {
  const sp = new URLSearchParams();
  // Month is only written once the user picks one; otherwise it follows the clock (ADR 0016).
  if (
    pinMonth ||
    new URLSearchParams(window.location.search).has("month") ||
    next.month !== currentMonth()
  )
    sp.set("month", next.month);
  for (const c of next.category) sp.append("category", c);
  for (const k of ["from", "to", "status", "account", "q"] as const) {
    if (next[k]) sp.set(k, next[k]);
  }
  const open = new URLSearchParams(window.location.search).get("txn");
  if (open) sp.set("txn", open); // keep the drawer deep link
  const qs = sp.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function useUrlFilters() {
  const search = useSyncExternalStore(subscribe, getSearch, () => "");
  const filters = useMemo(() => parseFilters(search), [search]);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    write({ ...parseFilters(getSearch()), ...patch }, "month" in patch);
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
