import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, apiFetch } from "./client";
import type { Flags, LoginResponse, Me } from "./types";

export function useFlags() {
  return useQuery({
    queryKey: ["flags"],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => apiFetch<Flags>("/api/flags", { signal }),
  });
}

/** Never extends the session (server ignores the header here). Polls only while the tab is visible. */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "me"],
    enabled,
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => apiFetch<Me>("/api/auth/me", { signal }),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<LoginResponse, ApiError, { email: string; password: string }>({
    mutationFn: (body) =>
      apiFetch<LoginResponse>("/api/auth/login", { method: "POST", body, userActivity: true }),
    onSuccess: (res) => {
      qc.setQueryData<Me>(["auth", "me"], {
        user: res.user,
        idle_timeout_seconds: res.idle_timeout_seconds,
        expires_in_seconds: res.idle_timeout_seconds,
      });
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError>({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST", userActivity: true }),
    onSettled: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" && q.queryKey[0] !== "flags" });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
