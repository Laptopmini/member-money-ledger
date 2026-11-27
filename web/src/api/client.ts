import type { ErrorEnvelope } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type Query = Record<string, string | string[] | undefined>;

export function buildQuery(params: Query): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    } else {
      sp.set(key, value);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type FetchOptions = {
  method?: string;
  body?: unknown;
  /** Only for user-initiated requests. Background queries must never set it (trap 18). */
  userActivity?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (UNSAFE.has(method)) {
    const token = readCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }
  if (opts.userActivity === true) headers["X-User-Activity"] = "1";

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network", "We couldn't reach the server. Check your connection.");
  }

  let data: unknown;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const env = (data as Partial<ErrorEnvelope> | undefined)?.error;
    throw new ApiError(
      res.status,
      env?.code ?? "unknown",
      env?.message ?? "Something went wrong. Try again in a moment.",
      env?.request_id,
    );
  }
  return data as T;
}
