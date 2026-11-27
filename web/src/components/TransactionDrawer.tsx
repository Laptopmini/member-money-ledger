import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { useSaveDescription } from "../api/queries";
import type { Category, Transaction } from "../api/types";
import { formatLongDate, formatPostedOn } from "../lib/dates";
import { type HistoryEvent, historyMeta, historySentence } from "../lib/history";
import { formatMinor } from "../lib/money";
import { Clock, Plus, X } from "./icons";

function useHistory(id: string) {
  return useQuery({
    queryKey: ["history", id],
    queryFn: async ({ signal }) =>
      (
        await apiFetch<{ results: HistoryEvent[] }>(
          `/api/transactions/${encodeURIComponent(id)}/history`,
          { signal },
        )
      ).results,
  });
}

const FOCUSABLE =
  'button:not([disabled]), select:not([disabled]), textarea, input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const HINTS: Record<string, string> = {
  meals: "Counts at 50%",
  personal: "Doesn't lower your taxes",
  transfer: "Between your own accounts",
  income: "Money in only",
};

function CategoryGrid({
  txn,
  categories,
  disabled,
  onPick,
}: {
  txn: Transaction;
  categories: Category[];
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  const groups: { label: string; items: Category[] }[] = [
    { label: "Business expenses", items: categories.filter((c) => c.kind === "expense") },
    {
      label: "Not business",
      items: categories.filter((c) => c.kind === "personal" || c.kind === "transfer"),
    },
    { label: "Money in", items: categories.filter((c) => c.kind === "income") },
  ];
  const known = categories.some((c) => c.key === txn.category);
  return (
    <fieldset className="cat-options">
      <legend className="visually-hidden">Category</legend>
      <fieldset className="cat-options__group">
        <legend className="cat-options__legend">Needs a decision</legend>
        <div className="cat-options__grid">
          <label className="cat-option cat-option--uncategorized">
            <input
              type="radio"
              name="drawer-cat"
              value=""
              checked={txn.category === null}
              disabled
              readOnly
            />
            <span className="cat-option__box">
              <Plus />
              <span>Uncategorized</span>
            </span>
          </label>
          {txn.category !== null && !known && (
            <label className="cat-option">
              <input
                type="radio"
                name="drawer-cat"
                value={txn.category}
                checked
                readOnly
                disabled
              />
              <span className="cat-option__box">
                <span>{txn.category_label}</span>
              </span>
            </label>
          )}
        </div>
      </fieldset>
      {groups.map((g) => (
        <fieldset key={g.label} className="cat-options__group">
          <legend className="cat-options__legend">{g.label}</legend>
          <div className="cat-options__grid">
            {g.items.map((c) => (
              <label key={c.key} className={`cat-option cat--${c.key}`}>
                <input
                  type="radio"
                  name="drawer-cat"
                  value={c.key}
                  checked={txn.category === c.key}
                  disabled={disabled || (c.key === "income" && txn.direction === "debit")}
                  onChange={() => onPick(c.key)}
                />
                <span className="cat-option__box">
                  <span className="cat-dot" aria-hidden="true" />
                  <span>{c.label}</span>
                  {HINTS[c.key] && <span className="cat-option__hint">{HINTS[c.key]}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  );
}

function DescriptionField({ txn, disabled }: { txn: Transaction; disabled: boolean }) {
  const save = useSaveDescription();
  const [value, setValue] = useState(txn.description);
  useEffect(() => setValue(txn.description), [txn.description]);
  return (
    <div className="field">
      <label className="field__label" htmlFor="drawer-desc">
        Description
      </label>
      <textarea
        id="drawer-desc"
        className="textarea"
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="drawer__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={disabled || save.isPending || value === txn.description}
          onClick={() =>
            save.mutate({ id: txn.id, description: value, expected_updated_at: txn.updated_at })
          }
        >
          Save description
        </button>
      </div>
    </div>
  );
}

export function TransactionDrawer({
  txn,
  categories,
  onClose,
  onPick,
  disabled,
  loading,
}: {
  txn: Transaction | undefined;
  categories: Category[];
  onClose: () => void;
  onPick: (key: string) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const history = useHistory(txn?.id ?? "");

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !ref.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const credit = txn?.direction === "credit";
  const pending = txn?.status === "pending";
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: key handler implements the dialog focus trap and Escape */}
      <div
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onKeyDown={onKeyDown}
      >
        <header className="drawer__header">
          <div>
            <p className="drawer__eyebrow">
              {txn ? `${formatPostedOn(txn.posted_on)} · ${txn.account_label}` : ""}
            </p>
            <h2 id="drawer-title" className="drawer__title">
              {txn ? txn.merchant : "Transaction"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Close details"
            onClick={onClose}
          >
            <X />
          </button>
          {txn && (
            <div className="drawer__amount-row">
              <span className="drawer__amount money">
                {credit ? "+" : "−"}
                {formatMinor(txn.amount_cents, txn.currency)}
                <span className="visually-hidden">{credit ? " credit" : " debit"}</span>
              </span>
              {pending && (
                <span className="badge badge--pending">
                  <Clock /> Pending
                </span>
              )}
            </div>
          )}
        </header>

        {loading && !txn ? (
          <div className="drawer__body" aria-busy="true">
            <span className="skeleton skeleton--hero" />
            <span className="skeleton skeleton--option" />
            <span className="skeleton skeleton--option" />
          </div>
        ) : !txn ? (
          <div className="drawer__body">
            <div className="state">
              <p className="state__title">This transaction is no longer in your bank feed</p>
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Back to transactions
              </button>
            </div>
          </div>
        ) : (
          <div className="drawer__body">
            <section className="drawer__section">
              <dl className="detail-list">
                <dt>Date</dt>
                <dd>
                  <time dateTime={txn.posted_on}>{formatLongDate(txn.posted_on)}</time>
                </dd>
                <dt>Account</dt>
                <dd>{txn.account_label}</dd>
                <dt>Status</dt>
                <dd>{pending ? "Pending · may change when it posts. Not in totals." : "Posted"}</dd>
                <dt>Direction</dt>
                <dd>{credit ? "Money in" : "Money out"}</dd>
              </dl>
            </section>
            <section className="drawer__section">
              <h3 className="drawer__section-title">Category</h3>
              <CategoryGrid txn={txn} categories={categories} disabled={disabled} onPick={onPick} />
            </section>
            <section className="drawer__section">
              <DescriptionField txn={txn} disabled={disabled} />
            </section>
            <section className="drawer__section" aria-busy={history.isPending}>
              <h3 className="drawer__section-title">History</h3>
              {history.isPending ? (
                <span className="skeleton skeleton--option" />
              ) : history.isError ? (
                <p className="field__hint">Couldn't load the history.</p>
              ) : history.data.length === 0 ? (
                <p className="field__hint">No changes yet.</p>
              ) : (
                <ol className="history">
                  {history.data.map((e) => (
                    <li
                      key={`${e.at}-${e.action}-${e.actor}`}
                      className={`history__item${e.actor === "you" ? " history__item--you" : ""}`}
                    >
                      <span className="history__text">{historySentence(e, categories)}</span>
                      <span className="history__meta">{historyMeta(e)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
