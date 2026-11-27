import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

/** Retry 5xx and network errors once; never retry 4xx (the answer won't change). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
    },
  });
}
