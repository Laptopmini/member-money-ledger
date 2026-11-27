import { Alert, RefreshIcon } from "./icons";

export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="state" role="alert">
      <span className="state__icon">
        <Alert size={20} />
      </span>
      <p className="state__title">{title}</p>
      <p className="state__text">Something went wrong on our side. Your data is safe.</p>
      <button type="button" className="btn btn--secondary" onClick={onRetry}>
        <RefreshIcon /> Retry
      </button>
    </div>
  );
}
