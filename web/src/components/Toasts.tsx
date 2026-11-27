import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
};

type Push = (t: Omit<Toast, "id">) => void;
const ToastContext = createContext<Push>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const push = useCallback<Push>(
    (t) => {
      const id = nextId.current++;
      setToasts((l) => [...l, { ...t, id }]);
      // Toasts with an action stay until dismissed so keyboard users are not rushed.
      if (!t.action) setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const view = (t: Toast) => (
    <div key={t.id} className={`toast toast--${t.kind}`}>
      <span className="toast__msg">{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            dismiss(t.id);
            t.action?.run();
          }}
        >
          {t.action.label}
        </button>
      )}
      {t.secondary && (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            dismiss(t.id);
            t.secondary?.run();
          }}
        >
          {t.secondary.label}
        </button>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--small"
        aria-label="Dismiss"
        onClick={() => dismiss(t.id)}
      >
        ×
      </button>
    </div>
  );

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts">
        <div aria-live="polite">{toasts.filter((t) => t.kind === "success").map(view)}</div>
        <div role="alert">{toasts.filter((t) => t.kind === "error").map(view)}</div>
      </div>
    </ToastContext.Provider>
  );
}
