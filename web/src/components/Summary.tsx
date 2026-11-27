import { useSummary } from "../api/queries";
import type { CategoryBreakdown } from "../api/types";
import { monthLabel, monthName } from "../lib/dates";
import { formatCents } from "../lib/money";
import { goToTransactions } from "../lib/scroll";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ErrorState } from "./ErrorState";
import { Info, Tag } from "./icons";

const signedPending = (c: number) => `${c < 0 ? "−" : "+"} ${formatCents(Math.abs(c))}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Breakdown({
  rows,
  onPick,
}: {
  rows: CategoryBreakdown[];
  onPick: (category: string | null) => void;
}) {
  const sorted = [...rows].sort((a, b) => b.spend_cents - a.spend_cents);
  const positiveTotal = sorted.reduce((s, r) => s + Math.max(0, r.spend_cents), 0);
  return (
    <ul className="breakdown" aria-label="Spend by category">
      {sorted.map((r) => {
        const key = r.category ?? "uncategorized";
        const neg = r.spend_cents < 0;
        const zero = r.spend_cents === 0;
        const share =
          positiveTotal > 0 && r.spend_cents > 0
            ? Math.round((r.spend_cents / positiveTotal) * 100)
            : 0;
        const cls = [
          "bar-row",
          r.category === null ? "bar-row--uncategorized" : `cat--${r.category}`,
          neg ? "bar-row--negative" : "",
          zero ? "bar-row--zero" : "",
        ].join(" ");
        return (
          <li key={key} className={cls}>
            <button
              type="button"
              className="bar-row__label"
              aria-label={`Show ${r.label} transactions`}
              onClick={() => onPick(r.category)}
            >
              <span className="cat-dot" aria-hidden="true" />
              <span>{r.label}</span>
            </button>
            <span className="bar-row__amount">
              {neg ? "+" : ""}
              {formatCents(Math.abs(r.spend_cents))}
              <span className="bar-row__share">
                {neg ? "net refund" : zero && r.category !== null ? "refunded" : `${share}%`}
              </span>
            </span>
            <span className="bar-row__track" aria-hidden="true">
              <span
                className="bar-row__fill"
                style={{ "--share": `${share}%` } as React.CSSProperties}
              />
            </span>
            <span className="bar-row__count">
              {plural(r.count, "transaction", "transactions")}
              {neg && " · More came back than you spent. Lowers your spend."}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Summary() {
  const { filters, setFilters } = useUrlFilters();
  const q = useSummary(filters.month);

  if (q.isPending) {
    return (
      <section className="card summary" aria-busy="true" aria-label="Summary loading">
        <div className="card__body">
          <span className="skeleton skeleton--option" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </section>
    );
  }
  if (q.isError) {
    return (
      <section className="card summary">
        <div className="card__body">
          <ErrorState title="Couldn't load the summary" onRetry={() => q.refetch()} />
        </div>
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
        <header className="card__header">
          <div>
            <h2 className="card__title">{monthLabel(s.month)}</h2>
          </div>
        </header>
        <div className="card__body">
          <p className="state__title">No transactions in {monthName(s.month)} yet</p>
          {latest && latest !== s.month && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setFilters({ month: latest, from: "", to: "" });
                goToTransactions();
              }}
            >
              Jump to {monthLabel(latest)}
            </button>
          )}
        </div>
      </section>
    );
  }

  const ucc = s.uncategorized_credit_count;
  const showCat = (category: string | null) => {
    setFilters({ category: [category ?? "uncategorized"], from: "", to: "" });
    goToTransactions();
  };
  return (
    <section className="card summary" aria-label={`Summary for ${monthLabel(s.month)}`}>
      <header className="card__header">
        <div>
          <h2 className="card__title">{monthLabel(s.month)}</h2>
          <p className="card__subtitle">
            Posted transactions. Pending ones are shown, not counted.
          </p>
        </div>
      </header>
      <div className="card__body">
        <dl className="stats">
          <div className="stat">
            <dt className="stat__label">Income</dt>
            <dd className="stat__value money money--in">
              {s.income_cents > 0 ? "+" : ""}
              {formatCents(s.income_cents)}
            </dd>
            {s.pending_income_cents !== 0 && (
              <dd className="stat__meta">{signedPending(s.pending_income_cents)} pending</dd>
            )}
          </div>
          <div className="stat">
            <dt className="stat__label">Spend</dt>
            <dd className="stat__value money">
              {s.spend_cents > 0 ? "−" : ""}
              {formatCents(s.spend_cents)}
            </dd>
            {s.pending_cents !== 0 && (
              <dd className="stat__meta">{signedPending(s.pending_cents)} pending</dd>
            )}
          </div>
          <div className="stat stat--net">
            <dt className="stat__label">Net</dt>
            <dd className={`stat__value money${s.net_cents >= 0 ? " money--in" : ""}`}>
              {formatCents(s.net_cents, { signDisplay: "always" })}
            </dd>
            <dd className="stat__meta">Income minus spend</dd>
          </div>
        </dl>

        {s.by_category.length > 0 && (
          <>
            <h3 className="section-title">
              Spend by category <span className="section-title__aside">Share of spend</span>
            </h3>
            <Breakdown rows={s.by_category} onPick={showCat} />
          </>
        )}

        {(ucc > 0 || s.excluded_currency_count > 0) && (
          <ul className="flags">
            {ucc > 0 && (
              <li>
                {ucc} {ucc === 1 ? "credit isn't" : "credits aren't"} categorized (
                {formatCents(s.uncategorized_credit_cents)}), so {ucc === 1 ? "it's" : "they're"}{" "}
                not counted as income.
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
          <div className="nudge">
            <Tag />
            <p className="nudge__text">
              <strong>
                {plural(s.uncategorized_count, "transaction needs", "transactions need")} a
                category.
              </strong>{" "}
              It helps your tax estimate.
            </p>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setFilters({ category: ["uncategorized"], from: "", to: "" });
                goToTransactions();
              }}
            >
              Review it
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
