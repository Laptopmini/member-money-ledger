import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLogout } from "../api/auth";
import { apiFetch } from "../api/client";

const WARN_AT = 120;

export function clock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Remaining seconds as the server last reported, minus time elapsed since. */
export function remainingSeconds(expiresIn: number, fetchedAt: number, now: number): number {
  return expiresIn - Math.floor((now - fetchedAt) / 1000);
}

export function SessionWarning({ expiresIn, fetchedAt }: { expiresIn: number; fetchedAt: number }) {
  const qc = useQueryClient();
  const logout = useLogout();
  const [now, setNow] = useState(() => Date.now());
  const [staying, setStaying] = useState(false);

  const remaining = remainingSeconds(expiresIn, fetchedAt, now);
  const visible = remaining <= WARN_AT;

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  // Re-evaluate every 30s while hidden; the /me poll refreshes fetchedAt anyway.
  useEffect(() => {
    if (visible) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (remaining <= 0) qc.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [remaining, qc]);

  if (!visible || remaining <= 0) return null;

  // Announce only at 2:00, 1:00 and 0:30, not every second.
  const bucket = remaining <= 30 ? 30 : remaining <= 60 ? 60 : 120;

  const stay = async () => {
    setStaying(true);
    try {
      // /auth/me never extends the session; any other request with the header does.
      await apiFetch("/api/sync/status", { userActivity: true });
      await qc.refetchQueries({ queryKey: ["auth", "me"] });
    } finally {
      setStaying(false);
    }
  };

  return (
    <div className="session-warning" role="dialog" aria-labelledby="sw-title" aria-modal="false">
      <p id="sw-title" className="session-warning__title">
        You'll be signed out in <span aria-hidden="true">{clock(remaining)}</span> for your
        security.
      </p>
      <p className="visually-hidden" aria-live="polite">
        You'll be signed out in {clock(bucket)} for your security.
      </p>
      <div className="session-warning__actions">
        <button type="button" className="btn" disabled={staying} onClick={stay}>
          Stay signed in
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => logout.mutate()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
