import Alert from './Alert'

export default function ErrorState({ error, onRetry, className = '' }) {
  if (!error) return null

  return (
    <div className={`error-state-wrapper ${className}`.trim()}>
      <Alert type="error" message={error} />
      {onRetry && (
        <button type="button" className="secondary-button retry-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
