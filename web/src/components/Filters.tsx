import { useEffect, useState } from "react";
import { useCategories } from "../api/queries";
import { useUrlFilters } from "../lib/useUrlFilters";

export function Filters({ count, hasMore }: { count: number | null; hasMore: boolean }) {
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters();
  const categories = useCategories();
  const [q, setQ] = useState(filters.q);

  // Keep the box in sync with the URL (Clear filters, back button).
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => setFilters({ q }), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, setFilters]);

  const toggle = (key: string) =>
    setFilters({
      category: filters.category.includes(key)
        ? filters.category.filter((c) => c !== key)
        : [...filters.category, key],
    });

  const options = [{ key: "uncategorized", label: "Uncategorized" }, ...(categories.data ?? [])];
  const known = new Set(options.map((o) => o.key));
  for (const c of filters.category) if (!known.has(c)) options.push({ key: c, label: c });

  return (
    <search aria-label="Filter transactions">
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="f-q">Search</label>
          <input
            id="f-q"
            type="search"
            value={q}
            placeholder="Merchant or description"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <details className="field multi">
          <summary>
            Category{filters.category.length > 0 ? ` (${filters.category.length})` : ""}
          </summary>
          <fieldset className="multi__list">
            <legend className="visually-hidden">Categories</legend>
            {options.map((o) => (
              <label key={o.key} className="multi__item">
                <input
                  type="checkbox"
                  checked={filters.category.includes(o.key)}
                  onChange={() => toggle(o.key)}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        </details>

        <div className="field">
          <label htmlFor="f-from">From</label>
          <input
            id="f-from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ from: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-to">To</label>
          <input
            id="f-to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ to: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select
            id="f-status"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as "" | "pending" | "posted" })}
          >
            <option value="">All</option>
            <option value="posted">Posted</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-account">Account</label>
          <select
            id="f-account"
            value={filters.account}
            onChange={(e) => setFilters({ account: e.target.value })}
          >
            <option value="">All</option>
            <option value="acc_checking">Checking</option>
            <option value="acc_card">Card</option>
          </select>
        </div>

        <div className="filters__foot">
          <span className="filters__count" aria-live="polite">
            {count === null
              ? ""
              : `${count}${hasMore ? "+" : ""} ${count === 1 && !hasMore ? "transaction" : "transactions"}`}
          </span>
          {hasFilters && (
            <button type="button" className="btn btn--ghost btn--small" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </form>
    </search>
  );
}
