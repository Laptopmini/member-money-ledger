import { useRefresh, useSyncStatus } from "../api/queries";
import { formatClockOrDate, formatRelative } from "../lib/dates";
import { Alert, Info, Refresh } from "./icons";

export function useVendorDown(): boolean {
  return useSyncStatus().data?.state === "vendor_down";
}

export const VENDOR_DOWN_REASON = "Changes can't be saved until your bank feed is back.";

export function Banners() {
  const { data } = useSyncStatus();
  const refresh = useRefresh();
  if (!data) return null;
  const last = data.last_success_at;
  const down = data.state === "vendor_down";

  return (
    <>
      {down && (
        <div className="banner banner--warning" role="status">
          <Alert className="banner__icon" />
          <div className="banner__body">
            <p>
              <span className="banner__title">We can't reach your bank feed right now.</span>
              {last ? ` Showing data from ${formatClockOrDate(last)}.` : ""} Changes can't be saved
              until it's back.
            </p>
          </div>
          <div className="banner__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              <Refresh /> Try again
            </button>
          </div>
        </div>
      )}
      {!down && data.stale && last && (
        <div className="banner banner--info" role="status">
          <Info className="banner__icon" />
          <div className="banner__body">
            <p>Last updated {formatRelative(last)}.</p>
          </div>
          <div className="banner__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={refresh.isPending || data.state === "running"}
              onClick={() => refresh.mutate()}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
      {data.rejected_count > 0 && (
        <div className="banner banner--neutral" role="status">
          <Info className="banner__icon" />
          <div className="banner__body">
            <p>
              {data.rejected_count} {data.rejected_count === 1 ? "transaction" : "transactions"}{" "}
              from your bank couldn't be read. We're looking into it.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
