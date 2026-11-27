import { useState } from "react";
import { useFlags } from "../api/auth";
import { useMarkSetAside, useSetAside, useSetRate } from "../api/tax";
import type { SetAside } from "../api/types";
import { formatLongDate, formatPostedOn, shortMonthName } from "../lib/dates";
import { centsToDollarsInput, formatCents, parseDollarsToCents, parsePercent } from "../lib/money";
import { goToTransactions } from "../lib/scroll";
import { useUrlFilters } from "../lib/useUrlFilters";
import { ErrorState } from "./ErrorState";
import { Check, Clock, Info, Plus, Tag } from "./icons";

const pct = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

function dueText(s: SetAside): string {
  const d = s.days_until_due;
  if (s.is_current_period === false) {
    const in_ = d > 1 ? `in ${d} days` : d === 1 ? "tomorrow" : d === 0 ? "today" : "past due";
    return `Payment due ${formatPostedOn(s.due_on)} · ${in_}`;
  }
  const when = d > 1 ? `${d} days` : d === 1 ? "1 day" : d === 0 ? "due today" : "past due";
  return `Federal estimated payment due ${formatLongDate(s.due_on)} · ${when}`;
}

function titleText(s: SetAside): string {
  const q = s.quarter.split("-")[1] ?? s.quarter;
  const a = shortMonthName(s.period_start.slice(0, 7));
  const b = shortMonthName(s.period_end.slice(0, 7));
  return `Set aside for taxes · ${q} (${a}–${b})`;
}

function RateEditor({ s, onDone }: { s: SetAside; onDone: () => void }) {
  const setRate = useSetRate();
  const [value, setValue] = useState(String(Math.round(s.rate * 1000) / 10));
  const parsed = parsePercent(value);
  return (
    <form
      className="setaside__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed === null) return;
        setRate.mutate(Number((parsed / 100).toFixed(4)), { onSuccess: onDone });
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="rate-input">
          Tax rate (%)
        </label>
        <input
          id="rate-input"
          className="input"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={parsed === null}
          aria-describedby="rate-help"
        />
        <span id="rate-help" className={parsed === null ? "field__error" : "field__hint"}>
          {parsed === null
            ? "Enter a number from 0 to 60."
            : "Your estimated federal plus self-employment rate."}
        </span>
      </div>
      <div className="inline-form__actions">
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={parsed === null || setRate.isPending}
        >
          Save rate
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MarkForm({ s, onDone }: { s: SetAside; onDone: (cents: number) => void }) {
  const mark = useMarkSetAside();
  const [value, setValue] = useState(centsToDollarsInput(s.gap_cents));
  const cents = parseDollarsToCents(value);
  const valid = cents !== null && cents > 0;
  return (
    <form
      className="setaside__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        mark.mutate(
          { quarter: s.quarter, amount_cents: cents },
          { onSuccess: () => onDone(cents) },
        );
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="mark-amount">
          Amount set aside ($)
        </label>
        <input
          id="mark-amount"
          className="input"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!valid}
          aria-describedby="mark-help"
        />
        <span id="mark-help" className={!valid ? "field__error" : "field__hint"}>
          {valid
            ? "Prefilled with what's left to reach your estimate."
            : "Enter an amount like 903.25."}
        </span>
      </div>
      <div className="inline-form__actions">
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={!valid || mark.isPending}
        >
          Save
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDone(-1)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Card({ s }: { s: SetAside }) {
  const { setFilters } = useUrlFilters();
  const [editingRate, setEditingRate] = useState(false);
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const q = s.quarter.split("-")[1] ?? s.quarter;

  const progress =
    s.estimate_cents > 0
      ? Math.min(100, Math.round((s.set_aside_cents / s.estimate_cents) * 100))
      : 0;

  const review = () => {
    setFilters({ category: ["uncategorized"], from: s.period_start, to: s.period_end });
    goToTransactions();
  };

  return (
    <section className="card setaside" aria-labelledby="sa-title">
      <header className="card__header">
        <div>
          <h2 id="sa-title" className="card__title">
            {titleText(s)}
          </h2>
          <p className="card__subtitle">{dueText(s)}</p>
        </div>
      </header>
      <div className="card__body">
        {s.status === "needs_review" ? (
          <div className="state">
            <p className="state__title">
              {s.uncategorized_credit_cents
                ? `We found ${formatCents(s.uncategorized_credit_cents)} of deposits without a category.`
                : "We found deposits without a category."}{" "}
              Mark income as Income to see your estimate.
            </p>
            <button type="button" className="btn btn--secondary btn--sm" onClick={review}>
              Review deposits
            </button>
          </div>
        ) : s.status === "no_income" ? (
          <div className="state">
            <p className="state__title">Once income arrives we'll estimate what to set aside</p>
          </div>
        ) : (
          <>
            <p className="setaside__eyebrow">Estimated set-aside</p>
            <p className="setaside__amount money">{formatCents(s.estimate_cents)}</p>
            <p className="setaside__formula">
              {pct(s.rate)} of <span className="money">{formatCents(s.profit_cents)}</span> profit ·{" "}
              <button
                type="button"
                className="link-button"
                aria-expanded={editingRate}
                onClick={() => setEditingRate((v) => !v)}
              >
                Edit rate
              </button>
            </p>
            {(s.refund_adjustment_cents ?? 0) > 0 && (
              <p className="setaside__incentive">
                <Info size={20} />
                <span>
                  Includes a {formatCents(s.refund_adjustment_cents ?? 0)} refund for an earlier
                  purchase, which raises this quarter's profit.
                </span>
              </p>
            )}
            {editingRate && <RateEditor s={s} onDone={() => setEditingRate(false)} />}

            <div className="setaside__progress">
              <div className="setaside__progress-row">
                <p className="setaside__progress-text">
                  <strong>{formatCents(s.set_aside_cents)}</strong> of{" "}
                  {formatCents(s.estimate_cents)} set aside
                </p>
                {s.status === "on_track" ? (
                  <span className="pill pill--on-track">
                    <Check /> On track
                  </span>
                ) : (
                  <span className="pill pill--behind">
                    <Clock /> {formatCents(s.gap_cents)} to go
                  </span>
                )}
              </div>
              <div
                className={`progress${s.status === "behind" ? " progress--behind" : ""}`}
                role="progressbar"
                aria-label="Set aside so far"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-valuetext={`${formatCents(s.set_aside_cents)} of ${formatCents(s.estimate_cents)} set aside`}
              >
                <span
                  className="progress__fill"
                  style={{ "--progress": `${progress}%` } as React.CSSProperties}
                />
              </div>
            </div>

            {s.uncategorized_debit_count > 0 && (
              <p className="setaside__incentive">
                <Tag size={20} />
                <span>
                  Categorize {s.uncategorized_debit_count}{" "}
                  {s.uncategorized_debit_count === 1 ? "transaction" : "transactions"}. Your
                  estimate could drop by up to about{" "}
                  <strong className="money">{formatCents(s.potential_reduction_cents)}</strong>.
                  {(s.pending_uncategorized_debit_count ?? 0) > 0 &&
                    ` (${s.pending_uncategorized_debit_count} more pending)`}{" "}
                  <button type="button" className="link-button" onClick={review}>
                    Review it
                  </button>
                </span>
              </p>
            )}

            <div className="setaside__actions">
              {done !== null && done >= 0 ? (
                <p className="alert alert--info" role="status">
                  Nice. {formatCents(done)} set aside for {q}.
                </p>
              ) : marking ? (
                <MarkForm
                  s={s}
                  onDone={(c) => {
                    setMarking(false);
                    setDone(c >= 0 ? c : null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  aria-expanded={marking}
                  onClick={() => setMarking(true)}
                >
                  <Plus /> Mark as set aside
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="card__footer">
        An estimate, not tax advice. Meals count at 50%; personal and transfers don't count.
      </footer>
    </section>
  );
}

export function SetAsideCard() {
  const flags = useFlags();
  const enabled = flags.data?.["tax-set-aside"] === true;
  const q = useSetAside(undefined, enabled);
  if (!enabled) return null;
  if (q.isPending) {
    return (
      <section className="card set-aside" aria-busy="true" aria-label="Set-aside loading">
        <div className="skeleton skeleton--lg" />
        <div className="skeleton" />
      </section>
    );
  }
  if (q.isError) {
    return (
      <section className="card set-aside">
        <ErrorState title="Couldn't estimate" onRetry={() => q.refetch()} />
      </section>
    );
  }
  return <Card s={q.data} />;
}
