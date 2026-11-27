import { useEffect, useState } from "react";
import { useRefresh, useSyncStatus } from "../api/queries";
import { formatRelative } from "../lib/dates";
import { Refresh } from "./icons";

export function SyncStatus() {
  const { data } = useSyncStatus();
  const refresh = useRefresh();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const running = refresh.isPending || data?.state === "running";
  const down = data?.state === "vendor_down";
  let text = "Checking sync…";
  if (data) {
    if (running) text = "Syncing…";
    else if (down) text = "Bank feed offline";
    else if (data.last_success_at) text = formatRelative(data.last_success_at, now);
    else text = "Not synced yet";
  }
  const stale = !!data?.stale && !down;
  const never = !!data && !data.last_success_at && !down;
  const label = running ? "Refreshing…" : down ? "Try again" : never ? "Sync now" : "Refresh";

  return (
    <>
      <span
        className={`sync-status${down ? " sync-status--down" : ""}${stale ? " sync-status--stale" : ""}${never ? " sync-status--never" : ""}`}
        role="status"
      >
        <span className="sync-status__dot" aria-hidden="true" />
        <span>
          {!running && !down && !never && !!data?.last_success_at && (
            <span className="sync-status__word">Synced </span>
          )}
          {text}
        </span>
      </span>
      <span className="has-tooltip">
        <button
          type="button"
          className={`btn btn--secondary btn--sm btn--icon${running ? " is-busy" : ""}`}
          disabled={running}
          aria-busy={running}
          aria-labelledby="refresh-tip"
          onClick={() => refresh.mutate()}
        >
          <Refresh />
        </button>
        <span id="refresh-tip" className="tooltip tooltip--below" role="tooltip">
          {label}
        </span>
      </span>
    </>
  );
}
