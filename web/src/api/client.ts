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

// Real user input, not polling, keeps the session alive (trap 18). Interval and focus refetches
// that happen without recent input must not send the header.
const ACTIVITY_WINDOW_MS = 60_000;
let lastInteraction = Number.NEGATIVE_INFINITY;

export function markInteraction(at: number = Date.now()) {
  lastInteraction = at;
}

export function hasRecentInteraction(now: number = Date.now()): boolean {
  return now - lastInteraction <= ACTIVITY_WINDOW_MS;
}

if (typeof window !== "undefined") {
  for (const type of ["pointerdown", "keydown", "wheel"] as const) {
    window.addEventListener(type, () => markInteraction(), { passive: true });
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type FetchOptions = {
  method?: string;
  body?: unknown;
  /** Force the header on (mutations). Otherwise it is sent only after recent real input. */
  userActivity?: boolean;
  signal?: AbortSignal;
};

let csrfInFlight: Promise<void> | null = null;

/** Make sure the csrftoken cookie exists (or force a fresh one). Never throws. */
export function ensureCsrf(force = false): Promise<void> {
  if (!force && readCookie("csrftoken")) return Promise.resolve();
  csrfInFlight ??= fetch("/api/auth/csrf", { credentials: "same-origin" })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      csrfInFlight = null;
    });
  return csrfInFlight;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const unsafe = UNSAFE.has((opts.method ?? "GET").toUpperCase());
  if (unsafe) await ensureCsrf();
  try {
    return await requestOnce<T>(path, opts);
  } catch (e) {
    if (unsafe && e instanceof ApiError && e.status === 403 && e.code === "csrf_failed") {
      await ensureCsrf(true);
      return requestOnce<T>(path, opts);
    }
    throw e;
  }
}

async function requestOnce<T>(path: string, opts: FetchOptions): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  if (UNSAFE.has(method)) {
    // The API answers 415 to unsafe requests without a JSON content type, even with no payload.
    headers["Content-Type"] = "application/json";
    if (body === undefined) body = "{}";
    const token = readCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }
  if (opts.userActivity === true || (opts.userActivity !== false && hasRecentInteraction()))
    headers["X-User-Activity"] = "1";

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network", "We couldn't reach the server. Check your connection.");
  }

  const text = await res.text();
  let data: unknown;
  let parsed = true;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      parsed = false;
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
  if (res.status === 204 || text === "") return null as T;
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (!parsed || !isJson) {
    throw new ApiError(
      res.status,
      "bad_response",
      "We got an unexpected reply. Try again in a moment.",
    );
  }
  return data as T;
}
