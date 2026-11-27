import { useEffect, useMemo, useRef, useState } from "react";
import { useFlags } from "../api/auth";
import {
  type RowNote,
  useCategories,
  useRecategorize,
  useSuggestion,
  useTransactions,
} from "../api/queries";
import type { Category, Transaction } from "../api/types";
import { formatPostedOn, monthLabel, monthRange } from "../lib/dates";
import { formatMinor } from "../lib/money";
import { goToTransactions } from "../lib/scroll";
import { useUrlFilters } from "../lib/useUrlFilters";
import { useVendorDown, VENDOR_DOWN_REASON } from "./Banners";
import { ErrorState } from "./ErrorState";
import { Filters } from "./Filters";
import { Alert, ChevronDown, Clock, Lightbulb, Plus, Search } from "./icons";
import { TransactionDrawer } from "./TransactionDrawer";

function Badges({ t }: { t: Transaction }) {
  const any =
    t.status === "pending" ||
    t.kind === "refund" ||
    t.kind === "transfer" ||
    t.kind === "income" ||
    t.kind === "excluded_currency";
  if (!any) return null;
  return (
    <span className="txn-row__amount-label">
      {t.status === "pending" && (
        <span
          className="badge badge--pending"
          title="Pending: may change when it posts. Not in totals."
        >
          <Clock /> Pending
        </span>
      )}
      {t.kind === "refund" && <span className="badge badge--refund">Refund</span>}
      {t.kind === "transfer" && (
        <span className="badge badge--transfer">Transfer · not counted</span>
      )}
      {t.kind === "income" && <span className="badge badge--income">Income</span>}
      {t.kind === "excluded_currency" && (
        <span className="badge badge--excluded">{t.currency} · not in totals</span>
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
  const off = disabled || saving;
  const uncategorized = t.category === null;
  return (
    <label
      className={`cat-picker ${uncategorized ? "cat-picker--uncategorized" : known ? `cat--${t.category}` : "cat-picker--other"}${saving ? " is-saving" : ""}${recat.rolledBack.has(t.id) ? " is-rolled-back" : ""}${disabled ? " is-disabled" : ""}`}
      title={disabled ? VENDOR_DOWN_REASON : undefined}
    >
      {uncategorized ? <Plus /> : <span className="cat-dot" aria-hidden="true" />}
      <span className="cat-picker__value">
        {uncategorized ? "Uncategorized" : t.category_label}
      </span>
      <ChevronDown className="cat-picker__chevron" />
      <select
        aria-label={`Category for ${t.merchant}`}
        value={t.category ?? ""}
        disabled={off}
        aria-busy={saving}
        onChange={(e) =>
          recat.recategorize({
            id: t.id,
            category: e.target.value,
            expected_updated_at: t.updated_at,
          })
        }
      >
        {uncategorized && (
          <option value="" disabled>
            Choose category…
          </option>
        )}
        {!uncategorized && !known && <option value={t.category ?? ""}>{t.category_label}</option>}
        {categories.map((c) => (
          <option
            key={c.key}
            value={c.key}
            disabled={c.key === "income" && t.direction === "debit"}
          >
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

let captionShown = false;
/** Test hook: the AI caption shows only the first time a chip appears. */
export const resetSuggestionCaption = () => {
  captionShown = false;
};

function SuggestionChip({ t, enabled, recat }: { t: Transaction; enabled: boolean; recat: Recat }) {
  const q = useSuggestion(t.id, enabled && t.category === null);
  const [dismissed, setDismissed] = useState(false);
  const [withCaption] = useState(() => {
    const first = !captionShown;
    return first;
  });
  const s = q.data;
  const show = !dismissed && t.category === null && !!s?.category;
  useEffect(() => {
    if (show) captionShown = true;
  }, [show]);
  if (!show || !s?.category) return null;
  return (
    <span className="suggestion">
      <span className="suggestion__chip">
        <span>Suggested: {s.label ?? s.category}</span>
        <button
          type="button"
          className="btn btn--small"
          aria-label={`Accept suggestion ${s.label ?? s.category} for ${t.merchant}`}
          disabled={recat.pendingIds.has(t.id)}
          onClick={() =>
            recat.recategorize({
              id: t.id,
              category: s.category as string,
              expected_updated_at: t.updated_at,
            })
          }
        >
          Accept
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          aria-label={`Dismiss suggestion for ${t.merchant}`}
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </span>
      {withCaption && (
        <span className="hint">Suggestions come from an AI model and can be wrong.</span>
      )}
    </span>
  );
}

function Row({
  t,
  categories,
  disabled,
  recat,
  suggestOn,
  eager,
  onOpen,
  selected,
}: {
  t: Transaction;
  categories: Category[];
  disabled: boolean;
  recat: Recat;
  suggestOn: boolean;
  eager: boolean;
  onOpen: (id: string, trigger: HTMLElement) => void;
  selected: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const credit = t.direction === "credit";
  const pending = t.status === "pending";
  return (
    <li
      className={`txn-row${t.kind === "income" ? " txn-row--income" : ""}${pending ? " txn-row--pending" : ""}${selected ? " is-selected" : ""}`}
      data-row-id={t.id}
      onFocus={() => setTouched(true)}
      onMouseEnter={() => setTouched(true)}
    >
      <div className="txn-row__main">
        <button
          type="button"
          className="txn-row__open"
          aria-haspopup="dialog"
          onClick={(e) => onOpen(t.id, e.currentTarget)}
        >
          {t.merchant}
        </button>
        {t.description && <span className="txn-row__desc">{t.description}</span>}
      </div>
      <div className="txn-row__meta">
        <span className="txn-row__date">
          <time dateTime={t.posted_on}>{formatPostedOn(t.posted_on)}</time>
        </span>
        <span className="txn-row__meta-sep" aria-hidden="true">
          ·
        </span>
        <span className="txn-row__account">{t.account_label}</span>
      </div>
      <div className="txn-row__category">
        <CategorySelect t={t} categories={categories} disabled={disabled} recat={recat} />
        <SuggestionChip t={t} enabled={suggestOn && (eager || touched)} recat={recat} />
      </div>
      <div
        className="txn-row__amount"
        title={pending ? "Pending: may change when it posts. Not in totals." : undefined}
      >
        <span className={`money${credit ? " money--in" : ""}`}>
          {credit ? "+" : "−"}
          {formatMinor(t.amount_cents, t.currency)}
          <span className="visually-hidden">{credit ? " credit" : " debit"}</span>
        </span>
        <Badges t={t} />
      </div>
      {recat.notes[t.id] && <RowNoteView id={t.id} note={recat.notes[t.id]} recat={recat} />}
    </li>
  );
}

function RowNoteView({ id, note, recat }: { id: string; note: RowNote; recat: Recat }) {
  if (note.kind === "rule") {
    return (
      <div className="txn-row__note">
        <div className="inline-note inline-note--rule" role="status">
          <p className="inline-note__text">
            <Lightbulb />
            <span>
              Apply <strong>{note.label}</strong> to {note.count} other {note.merchant}{" "}
              {note.count === 1 ? "transaction" : "transactions"}? Future {note.merchant}{" "}
              transactions too.
            </span>
          </p>
          <div className="inline-note__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={note.apply}>
              Apply
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => recat.setNote(id, null)}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="txn-row__note">
      <div className="inline-note inline-note--stale" role="alert">
        <p className="inline-note__text">
          <Alert />
          <span>{note.message}</span>
        </p>
        <div className="inline-note__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => recat.setNote(id, null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function TransactionList() {
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters();
  const categories = useCategories();
  const vendorDown = useVendorDown();
  const suggestionsOn = useFlags().data?.["category-suggestions"] === true;

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
  const [openId, setOpenIdState] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("txn"),
  );
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    const sp = new URLSearchParams(window.location.search);
    if (id) sp.set("txn", id);
    else sp.delete("txn");
    const qs = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const triggerRef = useRef<HTMLElement | null>(null);
  const openDrawer = (id: string, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setOpenId(id);
  };
  const closeDrawer = () => {
    setOpenId(null);
    triggerRef.current?.focus();
  };
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
      <ol className="txn-list" aria-busy="true" aria-label="Loading transactions">
        {[
          ["45%", "40%"],
          ["62%", "40%"],
          ["50%", "40%"],
          ["55%", "40%"],
        ].map(([w1, w2]) => (
          <li key={w1} className="txn-row">
            <div className="txn-row__main">
              <span
                className="skeleton skeleton--text"
                style={{ "--w": w1 } as React.CSSProperties}
              />
              <span
                className="skeleton skeleton--text"
                style={{ "--w": w2 } as React.CSSProperties}
              />
            </div>
            <div className="txn-row__category">
              <span className="skeleton skeleton--chip" />
            </div>
            <div className="txn-row__amount">
              <span
                className="skeleton skeleton--text"
                style={{ "--w": "5em" } as React.CSSProperties}
              />
            </div>
          </li>
        ))}
      </ol>
    );
  } else if (q.isError && rows.length === 0) {
    body = <ErrorState title="Couldn't load transactions" onRetry={() => q.refetch()} />;
  } else if (rows.length === 0) {
    body = hasFilters ? (
      <div className="state" role="status">
        <span className="state__icon">
          <Search size={20} />
        </span>
        <p className="state__title">No transactions match these filters</p>
        <p className="state__text">Try a wider date range or fewer categories.</p>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            clearFilters();
            goToTransactions();
          }}
        >
          Clear filters
        </button>
      </div>
    ) : (
      <div className="state" role="status">
        <span className="state__icon">
          <Clock size={20} />
        </span>
        <p className="state__title">
          {explicit ? "No transactions in this date range" : "No transactions in this month"}
        </p>
        <p className="state__text">
          Your transactions will appear after the first sync. This usually takes a minute after you
          connect your bank.
        </p>
        {explicit && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setFilters({ from: "", to: "" });
              goToTransactions();
            }}
          >
            Reset dates
          </button>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div className="txn-list__head" aria-hidden="true">
          <span>Date</span>
          <span>Merchant</span>
          <span>Account</span>
          <span>Category</span>
          <span className="txn-list__head-amount">Amount</span>
        </div>
        <ol className="txn-list" aria-label="Transactions">
          {rows.map((t, i) => (
            <Row
              key={t.id}
              t={t}
              categories={categories.data ?? []}
              disabled={vendorDown}
              recat={recat}
              suggestOn={suggestionsOn}
              eager={i < 5}
              onOpen={openDrawer}
              selected={openId === t.id}
            />
          ))}
        </ol>
        {(q.isFetchNextPageError || q.isRefetchError) && (
          <div className="alert alert--warning" role="alert">
            <Alert />
            <span>
              {q.isFetchNextPageError
                ? "Couldn't load more transactions."
                : "Couldn't refresh these transactions. Showing what we have."}{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}
              >
                Retry
              </button>
            </span>
          </div>
        )}
        {!q.hasNextPage && (
          <div className="load-more">
            <p className="load-more__end">That's everything for {monthLabel(filters.month)}.</p>
          </div>
        )}
        {q.hasNextPage && (
          <div className="load-more">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={q.isFetchingNextPage}
              aria-busy={q.isFetchingNextPage}
              onClick={() => q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section id="transactions" className="card txns" aria-labelledby="txns-title">
      <header className="card__header">
        <div className="txns__header">
          <h2 id="txns-title" className="card__title" tabIndex={-1}>
            Transactions
          </h2>
          <p className="txns__count" role="status">
            {count === null
              ? ""
              : `${count}${q.hasNextPage ? "+" : ""} ${count === 1 && !q.hasNextPage ? "transaction" : "transactions"} in ${monthLabel(filters.month)}`}
          </p>
        </div>
      </header>
      <div className="visually-hidden" aria-live="polite">
        {announce}
      </div>
      <Filters />
      {openId && (
        <TransactionDrawer
          txn={rows.find((r) => r.id === openId)}
          categories={categories.data ?? []}
          onClose={closeDrawer}
          disabled={vendorDown}
          loading={q.isPending}
          onPick={(key) => {
            const t = rows.find((r) => r.id === openId);
            if (t && key !== t.category)
              recat.recategorize({ id: t.id, category: key, expected_updated_at: t.updated_at });
          }}
        />
      )}
      {vendorDown && <p className="field__hint">{VENDOR_DOWN_REASON}</p>}
      {body}
    </section>
  );
}
