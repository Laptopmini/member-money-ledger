import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

/** Retry 5xx and network errors once; never retry 4xx (the answer won't change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function makeQueryClient() {
  // A 401 from anything but the auth check itself means the session ended: re-check it,
  // which sends the member back to the login screen.
  const on401 = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  };
  const qc: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== "auth") on401(error);
      },
    }),
    mutationCache: new MutationCache({ onError: (error) => on401(error) }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
    },
  });
  return qc;
}
