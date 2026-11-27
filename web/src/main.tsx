import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { apiFetch } from "./api/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toasts";
import { makeQueryClient } from "./lib/queryClient";
import { applyTheme, getStoredTheme } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/app.css";

applyTheme(getStoredTheme());

const queryClient = makeQueryClient();

// Stage 4: seed the CSRF cookie before any write. Harmless if the endpoint doesn't exist yet.
apiFetch("/api/auth/csrf").catch(() => {});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
