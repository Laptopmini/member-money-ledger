import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, request as pwRequest } from "@playwright/test";

export const VENDOR = "http://localhost:8080";
export const REPO_ROOT = path.resolve(process.cwd(), "..");

export function compose(...args: string[]): string {
  return execFileSync("docker", ["compose", ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

export async function waitForVendor(timeoutMs = 60_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(`${VENDOR}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("vendor did not become healthy");
}

/** The freshly built api_prod container may still be migrating; wait until the API answers. */
export async function waitForApp(timeoutMs = 90_000): Promise<void> {
  const base = process.env.E2E_BASE_URL ?? "http://localhost:8081";
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(`${base}/api/flags`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("app did not become ready");
}

/** Trap 11: the vendor is in memory. Restart it and rebuild the mirror from the 5 seed rows. */
export async function resetState(): Promise<void> {
  compose("restart", "vendor");
  await waitForVendor();
  compose("exec", "-T", "api_prod", "python", "manage.py", "reset_mirror", "--sync");
}

export async function openOctober(page: Page): Promise<void> {
  await page.goto("/?month=2026-10");
}

export const EMAIL = process.env.E2E_EMAIL ?? "member@example.com";
export const PASSWORD = process.env.E2E_PASSWORD ?? "demo-password-2026";

export const STATE_FILE = path.join(process.cwd(), "e2e/.auth/state.json");

/**
 * Sign in through the API (csrf, then login) and save the session as storageState. Used by
 * globalSetup; login.spec covers the login UI itself. `auth-required` is on by default.
 */
export async function loginAndSaveState(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8081";
  const request = await pwRequest.newContext({ baseURL });
  await request.get("/api/auth/csrf");
  const state = await request.storageState();
  const token = state.cookies.find((c) => c.name === "csrftoken")?.value ?? "";
  const res = await request.post("/api/auth/login", {
    headers: { "X-CSRFToken": token },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  await request.storageState({ path: STATE_FILE });
  await request.dispose();
}
