import { useSummary } from "../api/queries";
import type { CategoryBreakdown } from "../api/types";
import { monthLabel, monthName } from "../lib/dates";
import { formatCents } from "../lib/money";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ErrorState } from "./ErrorState";

function Bars({ rows }: { rows: CategoryBreakdown[] }) {
  const sorted = [...rows].sort((a, b) => b.spend_cents - a.spend_cents);
  const maxAbs = Math.max(1, ...sorted.map((r) => Math.abs(r.spend_cents)));
  const positiveTotal = sorted.reduce((s, r) => s + Math.max(0, r.spend_cents), 0);
  const hasNegative = sorted.some((r) => r.spend_cents < 0);

  return (
    <ul className="bars" aria-label="Spend by category">
      {sorted.map((r, i) => {
        const key = r.category ?? "uncategorized";
        const neg = r.spend_cents < 0;
        const width = (Math.abs(r.spend_cents) / maxAbs) * (hasNegative ? 50 : 100);
        const share =
          positiveTotal > 0 && r.spend_cents > 0
            ? Math.round((r.spend_cents / positiveTotal) * 100)
            : null;
        return (
          <li key={key} className="bars__row">
            <span className="bars__label">{r.label}</span>
            <span
              className={`bars__track${hasNegative ? " bars__track--split" : ""}`}
              aria-hidden="true"
            >
              <span
                className={`bars__bar${r.category === null ? " bars__bar--uncategorized" : ""}${neg ? " bars__bar--negative" : ""}`}
                style={
                  {
                    width: `${width}%`,
                    "--cat": `var(--cat-${(i % 8) + 1})`,
                  } as React.CSSProperties
                }
              />
            </span>
            <span className="bars__amount">
              {formatCents(r.spend_cents)}
              {neg && <span className="bars__note"> net refund</span>}
              {r.spend_cents === 0 && r.category !== null && (
                <span className="bars__note"> · refunded</span>
              )}
              {share !== null && <span className="bars__share"> · {share}%</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const signedPending = (c: number) => `${c < 0 ? "−" : "+"} ${formatCents(Math.abs(c))}`;

export function Summary() {
  const { filters, setFilters } = useUrlFilters();
  const q = useSummary(filters.month);

  if (q.isPending) {
    return (
      <section className="card summary" aria-busy="true" aria-label="Summary loading">
        <div className="skeleton skeleton--lg" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    );
  }
  if (q.isError) {
    return (
      <section className="card summary">
        <ErrorState title="Couldn't load the summary" onRetry={() => q.refetch()} />
      </section>
    );
  }

  const s = q.data;
  const empty =
    s.by_category.length === 0 &&
    s.income_cents === 0 &&
    s.spend_cents === 0 &&
    s.pending_count === 0 &&
    s.pending_cents === 0 &&
    s.pending_income_cents === 0 &&
    s.excluded_currency_count === 0 &&
    s.uncategorized_count === 0;

  if (empty) {
    const latest = s.latest_month_with_data;
    return (
      <section className="card summary">
        <h2 className="card__title">Summary</h2>
        <div className="state">
          <p className="state__title">No transactions in {monthName(s.month)} yet</p>
          {latest && latest !== s.month && (
            <button
              type="button"
              className="btn"
              onClick={() => setFilters({ month: latest, from: "", to: "" })}
            >
              Jump to {monthLabel(latest)}
            </button>
          )}
        </div>
      </section>
    );
  }

  const ucc = s.uncategorized_credit_count;
  return (
    <section className="card summary" aria-label={`Summary for ${monthLabel(s.month)}`}>
      <h2 className="card__title">Summary</h2>
      <dl className="headline">
        <div className="headline__item">
          <dt>Income</dt>
          <dd className="amount amount--credit">
            {formatCents(s.income_cents)}
            {s.pending_income_cents !== 0 && (
              <span className="headline__pending">
                {" "}
                {signedPending(s.pending_income_cents)} pending
              </span>
            )}
          </dd>
        </div>
        <div className="headline__item">
          <dt>Spend</dt>
          <dd className="amount">
            {formatCents(s.spend_cents)}
            {s.pending_cents !== 0 && (
              <span className="headline__pending"> {signedPending(s.pending_cents)} pending</span>
            )}
          </dd>
        </div>
        <div className="headline__item">
          <dt>Net</dt>
          <dd className={`amount ${s.net_cents < 0 ? "amount--debit" : ""}`}>
            {formatCents(s.net_cents, { signDisplay: "always" })}
          </dd>
        </div>
      </dl>

      {s.by_category.length > 0 && <Bars rows={s.by_category} />}

      {(ucc > 0 || s.excluded_currency_count > 0) && (
        <ul className="flags">
          {ucc > 0 && (
            <li>
              {ucc} {ucc === 1 ? "credit isn't" : "credits aren't"} categorized (
              {formatCents(s.uncategorized_credit_cents)}), so {ucc === 1 ? "it's" : "they're"} not
              counted as income.
            </li>
          )}
          {s.excluded_currency_count > 0 && (
            <li>
              {s.excluded_currency_count} non-USD{" "}
              {s.excluded_currency_count === 1 ? "transaction" : "transactions"} excluded from
              totals.
            </li>
          )}
        </ul>
      )}

      {s.uncategorized_count > 0 && (
        <button
          type="button"
          className="btn btn--nudge"
          onClick={() => setFilters({ category: ["uncategorized"], from: "", to: "" })}
        >
          {s.uncategorized_count}{" "}
          {s.uncategorized_count === 1 ? "transaction needs" : "transactions need"} a category
        </button>
      )}
    </section>
  );
}
