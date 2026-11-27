import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useToast } from "../components/Toasts";
import { addMonths } from "../lib/dates";
import { type ApiError, apiFetch, buildQuery } from "./client";
import type {
  Category,
  Summary,
  SyncStatus,
  Transaction,
  TransactionList,
  TransactionPatch,
} from "./types";

export type TransactionParams = {
  category: string[];
  from: string;
  to: string;
  status: string;
  account: string;
  q: string;
};

export function useTransactions(params: TransactionParams) {
  return useInfiniteQuery({
    queryKey: ["transactions", params],
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      apiFetch<TransactionList>(
        `/api/transactions${buildQuery({ ...params, limit: "50", cursor: pageParam })}`,
        { signal },
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

const fetchSummary = (month: string, signal?: AbortSignal) =>
  apiFetch<Summary>(`/api/summary${buildQuery({ month })}`, { signal });

export function useSummary(month: string) {
  const qc = useQueryClient();
  useEffect(() => {
    for (const m of [addMonths(month, -1), addMonths(month, 1)]) {
      qc.prefetchQuery({ queryKey: ["summary", m], queryFn: () => fetchSummary(m) });
    }
  }, [month, qc]);
  return useQuery({
    queryKey: ["summary", month],
    queryFn: ({ signal }) => fetchSummary(month, signal),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) =>
      (await apiFetch<{ results: Category[] }>("/api/categories", { signal })).results,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    refetchInterval: 30_000,
    queryFn: ({ signal }) => apiFetch<SyncStatus>("/api/sync/status", { signal }),
  });
}

type Vars = { id: string; category: string; expected_updated_at: string };
type RowFields = Pick<
  Transaction,
  "category" | "category_label" | "category_known" | "kind" | "updated_at"
>;

/** Patch one row, by id, in every cached transactions page (all filters, all pages). */
function patchRow(qc: QueryClient, id: string, fields: Partial<RowFields>) {
  qc.setQueriesData<InfiniteData<TransactionList>>(
    { queryKey: ["transactions"] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          results: p.results.map((r) => (r.id === id ? { ...r, ...fields } : r)),
        })),
      },
  );
}

function findRow(qc: QueryClient, id: string): Transaction | undefined {
  for (const [, data] of qc.getQueriesData<InfiniteData<TransactionList>>({
    queryKey: ["transactions"],
  })) {
    for (const page of data?.pages ?? []) {
      const row = page.results.find((r) => r.id === id);
      if (row) return row;
    }
  }
  return undefined;
}

const pick = (r: Transaction): RowFields => ({
  category: r.category,
  category_label: r.category_label,
  category_known: r.category_known,
  kind: r.kind,
  updated_at: r.updated_at,
});

/**
 * One mutation for the whole list. Each call keeps its own context, so concurrent edits on
 * different rows roll back independently (only that row's fields), and a row's select is
 * disabled while its own request is in flight (`pendingIds`).
 */
export function useRecategorize(opts: { onSaved?: (row: Transaction) => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const onSaved = useRef(opts.onSaved);
  onSaved.current = opts.onSaved;
  const setPending = (id: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const mutation = useMutation<Transaction, ApiError, Vars, { before?: RowFields }>({
    mutationFn: ({ id, category, expected_updated_at }) =>
      apiFetch<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { category, expected_updated_at } satisfies TransactionPatch,
        userActivity: true,
      }),
    onMutate: async ({ id, category }) => {
      setPending(id, true);
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const row = findRow(qc, id);
      const label = qc
        .getQueryData<Category[]>(["categories"])
        ?.find((c) => c.key === category)?.label;
      // kind stays as it was until the server row arrives; we don't guess it.
      patchRow(qc, id, { category, category_label: label ?? category, category_known: true });
      return { before: row && pick(row) };
    },
    onSuccess: (server) => {
      // The response may carry only some fields; never overwrite with undefined.
      const fields = Object.fromEntries(
        Object.entries(pick(server)).filter(([, v]) => v !== undefined),
      );
      patchRow(qc, server.id, fields);
      toast({ kind: "success", message: "Saved to Ledgerly" });
      onSaved.current?.(server);
    },
    onError: (err, vars, ctx) => {
      if (err.code === "vendor_unavailable") qc.invalidateQueries({ queryKey: ["sync-status"] });
      if (err.code === "vendor_unconfirmed") {
        // The change may have been saved: keep the optimistic row and let the refetch decide.
        toast({ kind: "error", message: err.message });
        return;
      }
      if (ctx?.before) patchRow(qc, vars.id, ctx.before);
      if (err.status === 409) {
        toast({
          kind: "error",
          message: "This transaction changed in your bank feed. Review and try again.",
        });
      } else {
        toast({
          kind: "error",
          message: err.message || "Couldn't save the category. Try again.",
          action: { label: "Retry", run: () => mutation.mutate(vars) },
        });
      }
    },
    onSettled: (_data, _err, vars) => {
      setPending(vars.id, false);
      for (const k of ["transactions", "summary", "set-aside"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
  return { recategorize: mutation.mutate, pendingIds };
}

export function useRefresh() {
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation<unknown, ApiError>({
    mutationFn: () => apiFetch("/api/sync", { method: "POST", userActivity: true }),
    onError: (err) =>
      toast({
        kind: "error",
        message: err.message,
        action: { label: "Retry", run: () => mutation.mutate() },
      }),
    onSettled: () => {
      for (const k of ["sync-status", "transactions", "summary", "set-aside"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
  return mutation;
}
