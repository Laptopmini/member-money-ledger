const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdSigned = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "exceptZero",
});

export type SignDisplay = "auto" | "always";

/** Integer cents to "$1,234.56". Division by 100 happens only here, at the edge. */
export function formatCents(cents: number, opts: { signDisplay?: SignDisplay } = {}): string {
  const fmt = opts.signDisplay === "always" ? usdSigned : usd;
  return fmt.format(cents / 100);
}

const minorFormats = new Map<string, Intl.NumberFormat>();

/** Amount in the currency's minor unit (cents, yen, ...) to a localized string. */
export function formatMinor(amount: number, currency: string): string {
  let fmt = minorFormats.get(currency);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      return `${(amount / 100).toFixed(2)} ${currency}`;
    }
    minorFormats.set(currency, fmt);
  }
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(amount / 10 ** digits);
}

/**
 * "1,234.56" -> 123456. String math only (no parseFloat * 100). Returns null for anything
 * that isn't a non-negative amount with at most 2 decimals.
 */
export function parseDollarsToCents(input: string): number | null {
  const m = /^\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)?)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m || (m[1] === "" && m[2] === undefined)) return null;
  const whole = Number((m[1] ?? "").replace(/,/g, "") || "0");
  const frac = Number((m[2] ?? "").padEnd(2, "0") || "0");
  const cents = whole * 100 + frac;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents to an editable dollars string ("90325" -> "903.25"), string math only. */
export function centsToDollarsInput(cents: number): string {
  const c = Math.max(0, Math.trunc(cents));
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}

/** "25" or "7.5" -> 25 / 7.5 when within 0..60 with at most 1 decimal, else null. */
export function parsePercent(input: string): number | null {
  const t = input.trim().replace(/%$/, "");
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 60 ? n : null;
}
