import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiFetch } from "../api/client";
import type { Category, Transaction } from "../api/types";
import { formatPostedOn } from "../lib/dates";
import { type HistoryEvent, historyMeta, historySentence } from "../lib/history";
import { formatMinor } from "../lib/money";
import { Clock, X } from "./icons";

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

export function TransactionDrawer({
  txn,
  categories,
  onClose,
  picker,
}: {
  txn: Transaction | undefined;
  categories: Category[];
  onClose: () => void;
  /** The shared category picker (same recategorize mutation as the row). */
  picker: React.ReactNode;
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
        <div className="drawer__header">
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
            className="btn btn--icon btn--small"
            aria-label="Close details"
            onClick={onClose}
          >
            <X />
          </button>
        </div>

        {!txn ? (
          <div className="drawer__body">
            <p className="state__title">This transaction is no longer in your bank feed</p>
            <button type="button" className="btn" onClick={onClose}>
              Back to transactions
            </button>
          </div>
        ) : (
          <div className="drawer__body">
            <p className={`drawer__amount amount ${credit ? "amount--credit" : ""}`}>
              {credit ? "+" : "−"}
              {formatMinor(txn.amount_cents, txn.currency)}
              <span className="visually-hidden">{credit ? " credit" : " debit"}</span>
            </p>
            <dl className="detail-list">
              <div>
                <dt>Date</dt>
                <dd>{formatPostedOn(txn.posted_on)}</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>{txn.account_label}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {txn.status === "pending" ? (
                    <span className="badge badge--pending">
                      <Clock /> Pending
                    </span>
                  ) : (
                    "Posted"
                  )}
                </dd>
              </div>
            </dl>
            <section className="drawer__section">
              <h3 className="drawer__section-title">Category</h3>
              {picker}
            </section>
            {txn.description && (
              <section className="drawer__section">
                <h3 className="drawer__section-title">Description</h3>
                <p>{txn.description}</p>
              </section>
            )}
            <section className="drawer__section" aria-busy={history.isPending}>
              <h3 className="drawer__section-title">History</h3>
              {history.isPending ? (
                <div className="skeleton skeleton--row" />
              ) : history.isError ? (
                <p className="hint">Couldn't load the history.</p>
              ) : history.data.length === 0 ? (
                <p className="hint">No changes yet.</p>
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
