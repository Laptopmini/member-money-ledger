export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">{title}</p>
      <button type="button" className="btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
