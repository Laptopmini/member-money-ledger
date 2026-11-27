import { addMonths, currentMonth, monthLabel } from "../lib/dates";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ChevronDown, ChevronLeft, ChevronRight } from "./icons";

export function MonthPicker() {
  const { filters, setFilters } = useUrlFilters();
  // Changing month resets an explicit date range, so the list follows the month (ADR 0016).
  const go = (month: string) => setFilters({ month, from: "", to: "" });
  const now = currentMonth();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(now, -i));
  if (!months.includes(filters.month)) months.push(filters.month);
  months.sort().reverse();
  return (
    <nav className="app-header__month month-picker" aria-label="Month">
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm"
        aria-label={`Previous month, ${monthLabel(addMonths(filters.month, -1))}`}
        onClick={() => go(addMonths(filters.month, -1))}
      >
        <ChevronLeft size={20} />
      </button>
      <span className="select-wrap">
        <label className="visually-hidden" htmlFor="month-select">
          Month
        </label>
        <select
          id="month-select"
          className="select"
          value={filters.month}
          onChange={(e) => go(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <ChevronDown />
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm"
        aria-label={`Next month, ${monthLabel(addMonths(filters.month, 1))}`}
        disabled={filters.month >= now}
        onClick={() => go(addMonths(filters.month, 1))}
      >
        <ChevronRight size={20} />
      </button>
    </nav>
  );
}
