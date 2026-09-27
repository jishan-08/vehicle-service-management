export default function LoadingState({
  message = 'Loading...',
  surface = false,
  className = '',
}) {
  const content = (
    <div className={`loading-state ${className}`.trim()}>
      <span className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )

  if (surface) {
    return <div className="surface loading-surface">{content}</div>
  }

  return content
}
