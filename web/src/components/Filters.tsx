import { useEffect, useRef, useState } from "react";
import { useCategories } from "../api/queries";
import { monthRange } from "../lib/dates";
import { goToTransactions } from "../lib/scroll";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ChevronDown, Search, Sliders, X } from "./icons";

export function Filters() {
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters();
  const categories = useCategories();
  const range = monthRange(filters.month);
  const [q, setQ] = useState(filters.q);

  // Keep the box in sync with the URL (Clear filters, back button).
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => setFilters({ q }), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, setFilters]);

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const sheetBtn = useRef<HTMLButtonElement>(null);
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
    n === 0 ? "All categories" : n === 1 ? labelOf(filters.category[0]) : `${n} categories`;

  const searchField = (id: string, placeholder = "Merchant or note") => (
    <span className="input-affix input-affix--prefix">
      <span className="input-affix__prefix" aria-hidden="true">
        <Search />
      </span>
      <input
        id={id}
        className="input"
        type="search"
        value={q}
        placeholder={placeholder}
        onChange={(e) => setQ(e.target.value)}
      />
    </span>
  );

  const fields = (suffix: string) => (
    <>
      <div className="field">
        <label className="field__label" htmlFor={`f-q-${suffix}`}>
          Search
        </label>
        {searchField(`f-q-${suffix}`)}
      </div>

      <div className="field filter-menu" ref={suffix === "d" ? multiRef : undefined}>
        <span className="field__label" id={`f-cat-label-${suffix}`}>
          Category
        </span>
        <button
          type="button"
          id={`f-cat-${suffix}`}
          ref={suffix === "d" ? btnRef : undefined}
          className="btn btn--secondary"
          aria-expanded={open}
          aria-controls={`f-cat-list-${suffix}`}
          aria-labelledby={`f-cat-label-${suffix} f-cat-${suffix}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span>{summary}</span>
          <ChevronDown />
        </button>
        {open && (
          <fieldset id={`f-cat-list-${suffix}`} className="menu menu--left">
            <legend className="visually-hidden">Categories</legend>
            <div className="menu__section">
              {options.map((o) => (
                <label key={o.key} className={`menu__check cat--${o.key}`}>
                  <input
                    type="checkbox"
                    checked={filters.category.includes(o.key)}
                    onChange={() => toggle(o.key)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <fieldset className="field field--fieldset">
        <legend className="field__label">Dates</legend>
        <div className="date-range">
          <label className="visually-hidden" htmlFor={`f-from-${suffix}`}>
            From
          </label>
          <input
            id={`f-from-${suffix}`}
            className="input"
            type="date"
            value={filters.from || range.from}
            onChange={(e) => setFilters({ from: e.target.value })}
          />
          <span className="text-subtle">–</span>
          <label className="visually-hidden" htmlFor={`f-to-${suffix}`}>
            To
          </label>
          <input
            id={`f-to-${suffix}`}
            className="input"
            type="date"
            value={filters.to || range.to}
            onChange={(e) => setFilters({ to: e.target.value })}
          />
        </div>
      </fieldset>

      <fieldset className="field field--fieldset">
        <legend className="field__label">Status</legend>
        <div className="segmented">
          {(
            [
              ["", "All"],
              ["posted", "Posted"],
              ["pending", "Pending"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="segmented__option">
              <input
                type="radio"
                name={`status-${suffix}`}
                checked={filters.status === v}
                onChange={() => setFilters({ status: v })}
              />
              <span className="segmented__label">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={`f-account-${suffix}`}>
          Account
        </label>
        <span className="select-wrap">
          <select
            id={`f-account-${suffix}`}
            className="select"
            value={filters.account}
            onChange={(e) => setFilters({ account: e.target.value })}
          >
            <option value="">All accounts</option>
            <option value="acc_checking">Checking</option>
            <option value="acc_card">Card</option>
          </select>
          <ChevronDown />
        </span>
      </div>
    </>
  );

  return (
    <search aria-label="Filter transactions">
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <div className="filters__mobile">
          {searchField("f-q-m", "Search")}
          <button
            type="button"
            ref={sheetBtn}
            className="btn btn--secondary"
            aria-haspopup="dialog"
            onClick={() => setSheet(true)}
          >
            <Sliders /> Filters
          </button>
        </div>
        <div className="filters__inline">{fields("d")}</div>
        {hasFilters && (
          <div className="filters__chips">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                clearFilters();
                goToTransactions();
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </form>
      {sheet && (
        <>
          <div className="scrim" aria-hidden="true" onClick={() => setSheet(false)} />
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSheet(false);
                sheetBtn.current?.focus();
              }
            }}
          >
            <div className="drawer__header">
              <h2 className="drawer__title">Filters</h2>
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label="Close filters"
                onClick={() => {
                  setSheet(false);
                  sheetBtn.current?.focus();
                }}
              >
                <X />
              </button>
            </div>
            <div className="drawer__body">{fields("s")}</div>
          </div>
        </>
      )}
    </search>
  );
}
