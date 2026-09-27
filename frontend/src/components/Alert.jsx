import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

const icons = {
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  success: CheckCircle2,
}

export default function Alert({
  type = 'error',
  message,
  children,
  className = '',
}) {
  const content = message || children
  if (!content) return null

  const Icon = icons[type] || icons.error
  const alertClass = type === 'error' ? 'error-alert' : `${type}-alert`

  return (
    <div
      className={`alert ${alertClass} ${className}`.trim()}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Icon size={18} className="alert-icon" aria-hidden="true" />
      <div className="alert-content">{content}</div>
    </div>
  )
}
