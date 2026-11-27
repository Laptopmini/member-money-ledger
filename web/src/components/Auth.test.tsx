import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { makeQueryClient } from "../lib/queryClient";
import { jsonResponse, renderWithProviders } from "../test/utils";
import { AuthGate } from "./AuthGate";
import { SessionWarning } from "./SessionWarning";

const FLAGS = {
  "tax-set-aside": true,
  "auth-required": true,
  "merchant-rules": false,
  "category-suggestions": false,
};
const err = (code: string, message: string, status: number) =>
  jsonResponse({ error: { code, message, request_id: "r" } }, status);
const ME = {
  user: { email: "member@example.com", name: "Sam" },
  idle_timeout_seconds: 900,
  expires_in_seconds: 900,
};

afterEach(() => vi.restoreAllMocks());

function Probe() {
  useQuery({ queryKey: ["summary", "x"], queryFn: () => apiFetch("/api/summary") });
  return <p>app content</p>;
}

describe("login", () => {
  it("shows the envelope error on bad credentials, then signs in", async () => {
    let signedIn = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/flags") return jsonResponse(FLAGS);
      if (url === "/api/auth/csrf") return jsonResponse({});
      if (url === "/api/auth/me")
        return signedIn ? jsonResponse(ME) : err("not_authenticated", "Please sign in.", 401);
      if (url === "/api/auth/login") {
        const body = JSON.parse(String(init?.body));
        if (body.password !== "right")
          return err("invalid_credentials", "That email or password isn't right.", 400);
        signedIn = true;
        return jsonResponse({ user: ME.user, idle_timeout_seconds: 900 });
      }
      return jsonResponse({}, 404);
    });
    renderWithProviders(<AuthGate>app content</AuthGate>, makeQueryClient());
    await userEvent.type(await screen.findByLabelText("Email"), "member@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("That email or password isn't right.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "right");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("app content")).toBeInTheDocument();
  });

  it("skips the login screen when auth-required is off", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input) === "/api/flags"
        ? jsonResponse({ ...FLAGS, "auth-required": false })
        : jsonResponse({}, 404),
    );
    renderWithProviders(<AuthGate>app content</AuthGate>, makeQueryClient());
    expect(await screen.findByText("app content")).toBeInTheDocument();
  });

  it("sends the member back to login with the expired notice when any query returns 401", async () => {
    let meCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/flags") return jsonResponse(FLAGS);
      if (url === "/api/auth/me") {
        meCalls++;
        return meCalls === 1 ? jsonResponse(ME) : err("session_expired", "x", 401);
      }
      if (url === "/api/summary") return err("session_expired", "x", 401);
      return jsonResponse({}, 404);
    });
    renderWithProviders(
      <AuthGate>
        <Probe />
      </AuthGate>,
      makeQueryClient(),
    );
    expect(
      await screen.findByText("You were signed out after 15 minutes of inactivity."),
    ).toBeInTheDocument();
    expect(screen.queryByText("app content")).not.toBeInTheDocument();
  });
});

describe("SessionWarning", () => {
  it("appears at 120 seconds or less, with a countdown, and is hidden above", () => {
    const { unmount } = renderWithProviders(
      <SessionWarning expiresIn={600} fetchedAt={Date.now()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<SessionWarning expiresIn={120} fetchedAt={Date.now()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/2:00/, { selector: "[aria-hidden]" })).toBeInTheDocument();
  });

  it("Stay signed in sends a request with the activity header", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse(ME));
    renderWithProviders(<SessionWarning expiresIn={90} fetchedAt={Date.now()} />);
    await userEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const call = spy.mock.calls.find((c) => String(c[0]) === "/api/sync/status");
    expect((call?.[1]?.headers as Record<string, string> | undefined)?.["X-User-Activity"]).toBe(
      "1",
    );
  });
});
