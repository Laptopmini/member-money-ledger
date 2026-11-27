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
