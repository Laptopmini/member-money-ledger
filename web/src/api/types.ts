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
