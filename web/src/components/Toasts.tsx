import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Alert, Check, X } from "./icons";

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
      {t.kind === "error" ? <Alert className="toast__icon" /> : <Check className="toast__icon" />}
      <div className="toast__body">
        <span>{t.message}</span>
        {(t.action || t.secondary) && (
          <div className="toast__actions">
            {t.action && (
              <button
                type="button"
                className="toast__action toast__action--primary"
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
                className="toast__action"
                onClick={() => {
                  dismiss(t.id);
                  t.secondary?.run();
                }}
              >
                {t.secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="toast__close"
        aria-label="Dismiss"
        onClick={() => dismiss(t.id)}
      >
        <X />
      </button>
    </div>
  );

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region">
        <div aria-live="polite">{toasts.filter((t) => t.kind === "success").map(view)}</div>
        <div role="alert">{toasts.filter((t) => t.kind === "error").map(view)}</div>
      </div>
    </ToastContext.Provider>
  );
}
