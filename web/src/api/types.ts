import type { components } from "./schema";

type S = components["schemas"];

export type Transaction = S["Transaction"];
export type TransactionList = S["TransactionList"];
export type Summary = S["Summary"];
export type CategoryBreakdown = S["CategoryBreakdown"];
export type Category = S["Category"];
export type SyncStatus = S["SyncStatus"];
export type RowKind = S["RowKindEnum"];
export type ErrorEnvelope = S["Error"];
export type TransactionPatch = S["PatchedTransactionPatchRequest"];
export type Flags = S["Flags"];
export type Me = S["Me"];
export type User = S["User"];
export type LoginResponse = S["LoginResponse"];
// Fields added by ADR 0021; optional until the generated types include them.
export type SetAside = Omit<S["SetAside"], "status"> & {
  status: S["SetAside"]["status"] | "needs_review";
  refund_adjustment_cents?: number;
  pending_uncategorized_debit_count?: number;
  is_current_period?: boolean;
  uncategorized_credit_cents?: number;
};
export type SetAsideMark = S["SetAsideMark"];
export type RulePreview = S["RulePreview"];
export type MerchantRuleCreated = S["MerchantRuleCreated"];
