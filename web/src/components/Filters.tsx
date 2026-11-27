import { useEffect, useRef, useState } from "react";
import { useCategories } from "../api/queries";
import { goToTransactions } from "../lib/scroll";
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

  const [open, setOpen] = useState(false);
  const multiRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!multiRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const toggle = (key: string) =>
    setFilters({
      category: filters.category.includes(key)
        ? filters.category.filter((c) => c !== key)
        : [...filters.category, key],
    });

  const options = [{ key: "uncategorized", label: "Uncategorized" }, ...(categories.data ?? [])];
  const known = new Set(options.map((o) => o.key));
  for (const c of filters.category) if (!known.has(c)) options.push({ key: c, label: c });

  const labelOf = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  const n = filters.category.length;
  const summary =
    n === 0
      ? "Category: All"
      : n === 1
        ? `Category: ${labelOf(filters.category[0])}`
        : `Category: ${n} selected`;

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

        <div className="field multi" ref={multiRef}>
          <span id="f-cat-label">Category</span>
          <button
            type="button"
            id="f-cat"
            ref={btnRef}
            className="multi__button"
            aria-expanded={open}
            aria-controls="f-cat-list"
            aria-labelledby="f-cat-label f-cat"
            onClick={() => setOpen((o) => !o)}
          >
            <span>{summary}</span>
            <span aria-hidden="true">{open ? "▴" : "▾"}</span>
          </button>
          {open && (
            <fieldset id="f-cat-list" className="multi__list">
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
          )}
        </div>

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
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                clearFilters();
                goToTransactions();
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </form>
    </search>
  );
}
