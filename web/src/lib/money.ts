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
