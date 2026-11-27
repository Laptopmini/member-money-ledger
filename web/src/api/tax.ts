import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/Toasts";
import { localToday } from "../lib/dates";
import { type ApiError, apiFetch, buildQuery } from "./client";
import type { SetAside, SetAsideMark } from "./types";

export function useSetAside(quarter?: string, enabled = true) {
  return useQuery({
    enabled,
    // Same prefix as the recategorize invalidation: ["set-aside"].
    queryKey: ["set-aside", quarter ?? "current"],
    queryFn: ({ signal }) =>
      apiFetch<SetAside>(`/api/tax/set-aside${buildQuery({ quarter, today: localToday() })}`, {
        signal,
      }),
  });
}

export function useSetRate() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<{ rate: number }, ApiError, number>({
    mutationFn: (rate) =>
      apiFetch("/api/tax/settings", { method: "PUT", body: { rate }, userActivity: true }),
    onError: (e) => toast({ kind: "error", message: e.message }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["set-aside"] }),
  });
}

export function useMarkSetAside() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<
    SetAsideMark,
    ApiError,
    { quarter: string; amount_cents: number; reason?: string }
  >({
    mutationFn: (body) =>
      apiFetch("/api/tax/set-aside-marks", { method: "POST", body, userActivity: true }),
    onError: (e) => toast({ kind: "error", message: e.message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["set-aside"] }),
  });
}
