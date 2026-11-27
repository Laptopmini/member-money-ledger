import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
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
type Snapshot = [readonly unknown[], InfiniteData<TransactionList> | undefined][];

function kindFor(row: Transaction, category: string): Transaction["kind"] {
  if (row.kind === "excluded_currency") return row.kind;
  if (category === "transfer") return "transfer";
  if (row.direction === "debit") return "spend";
  return category === "income" ? "income" : "refund";
}

export function useRecategorize() {
  const qc = useQueryClient();
  const toast = useToast();

  const mutation = useMutation<Transaction, ApiError, Vars, { snapshot: Snapshot }>({
    mutationFn: ({ id, category, expected_updated_at }) =>
      apiFetch<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { category, expected_updated_at } satisfies TransactionPatch,
        userActivity: true,
      }),
    onMutate: async ({ id, category }) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshot = qc.getQueriesData<InfiniteData<TransactionList>>({
        queryKey: ["transactions"],
      }) as Snapshot;
      const label = qc
        .getQueryData<Category[]>(["categories"])
        ?.find((c) => c.key === category)?.label;
      qc.setQueriesData<InfiniteData<TransactionList>>(
        { queryKey: ["transactions"] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              results: p.results.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      category,
                      category_label: label ?? category,
                      category_known: true,
                      kind: kindFor(r, category),
                    }
                  : r,
              ),
            })),
          },
      );
      return { snapshot };
    },
    onError: (err, vars, ctx) => {
      if (err.code === "vendor_unconfirmed") {
        // The change may have been saved: keep the optimistic row and let the refetch decide.
        toast({ kind: "error", message: err.message });
        return;
      }
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
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
    onSuccess: () => toast({ kind: "success", message: "Saved to Ledgerly" }),
    onSettled: () => {
      for (const k of ["transactions", "summary", "set-aside"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
  return mutation;
}

export function useRefresh() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<unknown, ApiError>({
    mutationFn: () => apiFetch("/api/sync", { method: "POST", userActivity: true }),
    onError: (err) => toast({ kind: "error", message: err.message }),
    onSettled: () => {
      for (const k of ["sync-status", "transactions", "summary", "set-aside"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
}
