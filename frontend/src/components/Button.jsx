export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost' | 'text'
  type = 'button',
  disabled = false,
  loading = false,
  loadingText,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  ...props
}) {
  const variantClass = {
    primary: 'primary-button',
    secondary: 'secondary-button',
    danger: 'danger-button',
    ghost: 'ghost-button',
    text: 'text-button',
  }[variant] || 'primary-button'

  return (
    <button
      type={type}
      className={`${variantClass} ${loading ? 'is-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="spinner button-spinner" aria-hidden="true" />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={16} aria-hidden="true" />}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon size={16} aria-hidden="true" />}
    </button>
  )
}
