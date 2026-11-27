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
  let text = "Checking sync…";
  if (data) {
    if (running) text = "Syncing…";
    else if (data.last_success_at) text = `Synced ${formatRelative(data.last_success_at, now)}`;
    else text = "Never synced";
  }

  const dot = data?.state === "vendor_down" ? "down" : running ? "running" : "ok";
  const label = running ? "Refreshing…" : data?.state === "vendor_down" ? "Try again" : "Refresh";

  return (
    <div className="sync-status">
      <span className={`sync-dot sync-dot--${dot}`} aria-hidden="true" />
      <span className="sync-status__text" role="status">
        {data?.state === "vendor_down" ? "Bank feed offline" : text}
      </span>
      <button
        type="button"
        className={`btn btn--small btn--icon sync-refresh${running ? " is-busy" : ""}`}
        disabled={running}
        aria-busy={running}
        aria-label={label}
        title={label}
        onClick={() => refresh.mutate()}
      >
        <Refresh />
      </button>
    </div>
  );
}
