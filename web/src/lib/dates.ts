// Dates are local YYYY-MM-DD strings end to end. Never `new Date("YYYY-MM-DD")` (UTC parse, trap 4).

const pad = (n: number) => String(n).padStart(2, "0");

function parts(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y, m];
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = parts(month);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  return `${ny}-${pad(idx - ny * 12 + 1)}`;
}

export function monthOf(postedOn: string): string {
  return postedOn.slice(0, 7);
}

const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const monthOnly = new Intl.DateTimeFormat("en-US", { month: "long" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function monthLabel(month: string): string {
  const [y, m] = parts(month);
  return monthYear.format(new Date(y, m - 1, 1));
}

export function monthName(month: string): string {
  const [y, m] = parts(month);
  return monthOnly.format(new Date(y, m - 1, 1));
}

export function formatPostedOn(postedOn: string): string {
  const [y, m, d] = postedOn.split("-").map(Number);
  return shortDay.format(new Date(y, m - 1, d));
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = parts(month);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

/** For full timestamps (ISO with time and zone) only; those are safe to parse. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Time only when the timestamp is from today (local), otherwise date and time. */
export function formatClockOrDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const same =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return same ? clock.format(d) : dateTime.format(d);
}
