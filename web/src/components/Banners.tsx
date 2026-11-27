import { useRefresh, useSyncStatus } from "../api/queries";
import { formatClock, formatRelative } from "../lib/dates";

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
    <div className="banners">
      {down && (
        <div className="banner banner--warning" role="status">
          We can't reach your bank feed right now.
          {last ? ` Showing data from ${formatClock(last)}.` : ""} Changes can't be saved until it's
          back.
        </div>
      )}
      {!down && data.stale && last && (
        <div className="banner banner--warning" role="status">
          <span>Last updated {formatRelative(last)}.</span>
          <button
            type="button"
            className="btn btn--small"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            Refresh
          </button>
        </div>
      )}
      {data.rejected_count > 0 && (
        <div className="banner banner--info" role="status">
          {data.rejected_count} {data.rejected_count === 1 ? "transaction" : "transactions"} from
          your bank couldn't be read. We're looking into it.
        </div>
      )}
    </div>
  );
}
