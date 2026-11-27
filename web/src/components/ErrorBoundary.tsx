import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="layout">
        <section className="card" role="alert">
          <h1 className="card__title">Something went wrong</h1>
          <p className="state__hint">
            The page hit a problem. Your data is safe. Reload to try again.
          </p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    );
  }
}
