import { useState } from "react";
import { useLogin } from "../api/auth";

export function Login({ expired }: { expired: boolean }) {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="login">
      <form
        className="card login__card"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <h1 className="card__title">Sign in to Ledger</h1>
        {expired && (
          <p className="banner banner--info" role="status">
            You were signed out after 15 minutes of inactivity.
          </p>
        )}
        {login.isError && (
          <p className="banner banner--warning" role="alert">
            {login.error.message}
          </p>
        )}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn"
          disabled={login.isPending}
          aria-busy={login.isPending}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">For your security, sessions end after 15 minutes of inactivity.</p>
      </form>
    </main>
  );
}
