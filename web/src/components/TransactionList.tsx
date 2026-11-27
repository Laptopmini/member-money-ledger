import { useMemo, useState } from "react";
import { useCategories, useRecategorize, useTransactions } from "../api/queries";
import type { Category, Transaction } from "../api/types";
import { formatPostedOn, monthRange } from "../lib/dates";
import { formatMinor } from "../lib/money";
import { useUrlFilters } from "../lib/useUrlFilters";
import { useVendorDown, VENDOR_DOWN_REASON } from "./Banners";
import { ErrorState } from "./ErrorState";
import { Filters } from "./Filters";

function Badges({ t }: { t: Transaction }) {
  return (
    <span className="badges">
      {t.status === "pending" && (
        <span
          className="badge badge--pending"
          title="Pending: may change when it posts. Not in totals."
        >
          Pending
        </span>
      )}
      {t.kind === "refund" && <span className="badge badge--refund">Refund</span>}
      {t.kind === "transfer" && <span className="badge badge--transfer">Transfer</span>}
      {t.kind === "income" && <span className="badge badge--income">Income</span>}
      {t.category === null && <span className="badge badge--uncategorized">Uncategorized</span>}
      {t.kind === "excluded_currency" && (
        <span className="badge badge--other">{t.currency}, not in totals</span>
      )}
    </span>
  );
}

type Recat = ReturnType<typeof useRecategorize>;

function CategorySelect({
  t,
  categories,
  disabled,
  recat,
}: {
  t: Transaction;
  categories: Category[];
  disabled: boolean;
  recat: Recat;
}) {
  const saving = recat.pendingIds.has(t.id);
  const known = categories.some((c) => c.key === t.category);
  return (
    <select
      className="txn-row__select"
      aria-label={`Category for ${t.merchant}`}
      value={t.category ?? ""}
      disabled={disabled || saving}
      aria-busy={saving}
      title={disabled ? VENDOR_DOWN_REASON : undefined}
      onChange={(e) =>
        recat.recategorize({
          id: t.id,
          category: e.target.value,
          expected_updated_at: t.updated_at,
        })
      }
    >
      {t.category === null && (
        <option value="" disabled>
          Choose category…
        </option>
      )}
      {t.category !== null && !known && <option value={t.category}>{t.category_label}</option>}
      {categories.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function Row({
  t,
  categories,
  disabled,
  recat,
}: {
  t: Transaction;
  categories: Category[];
  disabled: boolean;
  recat: Recat;
}) {
  const credit = t.direction === "credit";
  const pending = t.status === "pending";
  return (
    <li className={`txn-row${pending ? " txn-row--pending" : ""}`} data-row-id={t.id}>
      <span className="txn-row__date">{formatPostedOn(t.posted_on)}</span>
      <span className="txn-row__main">
        <span className="txn-row__merchant">{t.merchant}</span>
        {t.description && <span className="txn-row__desc">{t.description}</span>}
        <Badges t={t} />
      </span>
      <span className="txn-row__account">{t.account_label}</span>
      <span className="txn-row__category">
        <CategorySelect t={t} categories={categories} disabled={disabled} recat={recat} />
      </span>
      <span
        className={`txn-row__amount amount ${credit ? "amount--credit" : "amount--debit"}${pending ? " amount--muted" : ""}`}
        title={pending ? "Pending: may change when it posts. Not in totals." : undefined}
      >
        {credit ? "+" : "−"}
        {formatMinor(t.amount_cents, t.currency)}
        <span className="visually-hidden">{credit ? " credit" : " debit"}</span>
      </span>
    </li>
  );
}

export function TransactionList() {
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters();
  const categories = useCategories();
  const vendorDown = useVendorDown();

  const explicit = !!(filters.from || filters.to);
  const range = monthRange(filters.month);
  const params = {
    category: filters.category,
    from: explicit ? filters.from : range.from,
    to: explicit ? filters.to : range.to,
    status: filters.status,
    account: filters.account,
    q: filters.q,
  };
  const q = useTransactions(params);
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.results) ?? [], [q.data]);
  const [announce, setAnnounce] = useState("");
  const recat = useRecategorize({
    onSaved: (saved) => {
      const f = filters.category;
      if (f.length === 0 || f.includes(saved.category ?? "uncategorized")) return;
      // The row is about to leave this filtered list: keep keyboard focus in the list.
      const i = rows.findIndex((r) => r.id === saved.id);
      const next = rows[i + 1] ?? rows[i - 1];
      const target = next
        ? document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(next.id)}"] select`)
        : document.getElementById("txns-title");
      target?.focus();
      setAnnounce("Moved out of this filter");
      setTimeout(() => setAnnounce(""), 4000);
    },
  });
  const count = q.data ? rows.length : null;

  let body: React.ReactNode;
  if (q.isPending) {
    body = (
      <div aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton--row" />
        ))}
      </div>
    );
  } else if (q.isError && rows.length === 0) {
    body = <ErrorState title="Couldn't load transactions" onRetry={() => q.refetch()} />;
  } else if (rows.length === 0) {
    body = hasFilters ? (
      <div className="state">
        <p className="state__title">No transactions match these filters</p>
        <button type="button" className="btn" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    ) : (
      <div className="state">
        <p className="state__title">
          {explicit ? "No transactions in this date range" : "No transactions in this month"}
        </p>
        <p className="state__hint">Your transactions will appear after the first sync.</p>
        <button type="button" className="btn" onClick={() => setFilters({ from: "", to: "" })}>
          Reset dates
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="txn-head" aria-hidden="true">
          <span>Date</span>
          <span>Merchant</span>
          <span>Account</span>
          <span>Category</span>
          <span className="txn-head__amount">Amount</span>
        </div>
        <ul className="txn-list" aria-label="Transactions">
          {rows.map((t) => (
            <Row
              key={t.id}
              t={t}
              categories={categories.data ?? []}
              disabled={vendorDown}
              recat={recat}
            />
          ))}
        </ul>
        {(q.isFetchNextPageError || q.isRefetchError) && (
          <div className="banner banner--warning" role="alert">
            <span>
              {q.isFetchNextPageError
                ? "Couldn't load more transactions."
                : "Couldn't refresh these transactions. Showing what we have."}
            </span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}
            >
              Retry
            </button>
          </div>
        )}
        {q.hasNextPage && (
          <button
            type="button"
            className="btn btn--block"
            disabled={q.isFetchingNextPage}
            aria-busy={q.isFetchingNextPage}
            onClick={() => q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        )}
      </>
    );
  }

  return (
    <section className="card txns" aria-labelledby="txns-title">
      <h2 id="txns-title" className="card__title" tabIndex={-1}>
        Transactions
      </h2>
      <div className="visually-hidden" aria-live="polite">
        {announce}
      </div>
      <Filters count={count} hasMore={!!q.hasNextPage} />
      {vendorDown && <p className="hint">{VENDOR_DOWN_REASON}</p>}
      {body}
    </section>
  );
}
