import { addMonths, monthLabel } from "../lib/dates";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ChevronLeft, ChevronRight } from "./icons";

export function MonthPicker() {
  const { filters, setFilters } = useUrlFilters();
  // Changing month resets an explicit date range, so the list follows the month (ADR 0016).
  const go = (month: string) => setFilters({ month, from: "", to: "" });
  return (
    <nav className="month-picker" aria-label="Month">
      <button
        type="button"
        className="btn btn--icon"
        aria-label={`Previous month, ${monthLabel(addMonths(filters.month, -1))}`}
        onClick={() => go(addMonths(filters.month, -1))}
      >
        <ChevronLeft />
      </button>
      <span className="month-picker__label" aria-live="polite">
        {monthLabel(filters.month)}
      </span>
      <button
        type="button"
        className="btn btn--icon"
        aria-label={`Next month, ${monthLabel(addMonths(filters.month, 1))}`}
        onClick={() => go(addMonths(filters.month, 1))}
      >
        <ChevronRight />
      </button>
    </nav>
  );
}
