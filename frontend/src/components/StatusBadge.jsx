import { formatStatusLabel, getStatusTone } from '../utils/status'

export default function StatusBadge({
  status,
  label,
  tone,
  icon: Icon,
  className = '',
  uppercase = true,
}) {
  if (!status && !label) return null

  const resolvedTone = tone || getStatusTone(status)
  const displayLabel = label || (status ? (uppercase ? String(status).replaceAll('_', ' ') : formatStatusLabel(status)) : '')
  const statusSlug = status ? String(status).toLowerCase().replace(/_/g, '-') : ''

  return (
    <span
      className={`status-badge status-tone-${resolvedTone} ${statusSlug ? `status-${statusSlug}` : ''} ${className}`.trim()}
    >
      {Icon && <Icon size={12} className="badge-icon" aria-hidden="true" />}
      <span>{displayLabel}</span>
    </span>
  )
}
