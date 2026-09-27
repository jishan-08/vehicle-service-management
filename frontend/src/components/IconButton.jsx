export default function IconButton({
  icon: Icon,
  'aria-label': ariaLabel,
  variant = 'default', // 'default' | 'danger' | 'ghost'
  size = 18,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const variantClass = variant === 'danger' ? 'danger-icon' : variant === 'ghost' ? 'ghost-icon' : ''

  return (
    <button
      type="button"
      className={`icon-button ${variantClass} ${className}`.trim()}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={size} aria-hidden="true" />}
    </button>
  )
}
