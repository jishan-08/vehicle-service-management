export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''} ${className}`.trim()}>
      {Icon && (
        <div className="empty-icon">
          <Icon size={compact ? 18 : 24} aria-hidden="true" />
        </div>
      )}
      {title && <strong>{title}</strong>}
      {description && <span>{description}</span>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
