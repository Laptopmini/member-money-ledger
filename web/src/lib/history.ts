import type { Category } from "../api/types";

export type HistoryEvent = {
  at: string;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
};

const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const ACTORS: Record<string, string> = { you: "You", sync: "Bank feed", rule: "Rule" };

function catOf(v: unknown): string | null | undefined {
  if (v && typeof v === "object" && "category" in v) {
    return (v as { category: string | null }).category;
  }
  return undefined;
}

/** A human sentence for one audit event: "Category changed from Uncategorized to Travel". */
export function historySentence(e: HistoryEvent, categories: Category[]): string {
  const label = (k: string | null | undefined) =>
    k === null ? "Uncategorized" : (categories.find((c) => c.key === k)?.label ?? k ?? "Unknown");
  switch (e.action) {
    case "recategorize":
      return `Category changed from ${label(catOf(e.before))} to ${label(catOf(e.after))}`;
    case "rule_applied":
      return `Category set to ${label(catOf(e.after))} by your rule`;
    case "synced":
      return "Synced from Ledgerly";
    case "replaced":
      return "Updated by your bank feed";
    case "tombstoned":
      return "No longer in your bank feed";
    default:
      return e.action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

export function historyMeta(e: HistoryEvent): string {
  return `${ACTORS[e.actor] ?? e.actor} · ${stamp.format(new Date(e.at))}`;
}
