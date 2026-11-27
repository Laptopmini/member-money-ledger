import { useState } from "react";
import { useLogin } from "../api/auth";
import { Alert, Info, Lock } from "./icons";

export function Login({ expired }: { expired: boolean }) {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="login">
      <div className="login__brand">
        <span className="app-header__brand-mark" aria-hidden="true">
          L
        </span>
        <span>Ledger</span>
      </div>
      <form
        className="card login__card"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div>
          <h1 className="login__title">Sign in</h1>
          <p className="login__lede">See where your money goes and what to set aside for taxes.</p>
        </div>
        {expired && (
          <div className="alert alert--info" role="status">
            <Info />
            <p>You were signed out after 15 minutes of inactivity.</p>
          </div>
        )}
        {login.isError && (
          <div className="alert alert--error" role="alert">
            <Alert />
            <p>{login.error.message}</p>
          </div>
        )}
        <div className="login__form">
          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className={`btn btn--primary btn--block${login.isPending ? " is-busy" : ""}`}
            disabled={login.isPending}
            aria-busy={login.isPending}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p className="login__note">
          <Lock />
          <span>For your security, sessions end after 15 minutes of inactivity.</span>
        </p>
      </form>
    </main>
  );
}
