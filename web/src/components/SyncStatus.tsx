import { useEffect, useState } from "react";
import { useRefresh, useSyncStatus } from "../api/queries";
import { formatRelative } from "../lib/dates";

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

  return (
    <div className="sync-status">
      <span className="sync-status__text">{text}</span>
      <button
        type="button"
        className="btn btn--small"
        disabled={running}
        aria-busy={running}
        onClick={() => refresh.mutate()}
      >
        {running ? "Syncing…" : "Refresh"}
      </button>
    </div>
  );
}
