/** Bring the Transactions section into view and move focus to its heading. */
export function goToTransactions() {
  const section = document.getElementById("transactions");
  const heading = document.getElementById("txns-title");
  if (!section) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  heading?.focus({ preventScroll: true });
}
