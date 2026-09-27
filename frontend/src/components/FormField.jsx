export default function FormField({
  id,
  label,
  required = false,
  optional = false,
  hint,
  error,
  children,
  className = '',
}) {
  return (
    <div className={`form-field-group ${error ? 'has-error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className="form-label">
          <span>{label}</span>
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
          {optional && <span className="optional-label">Optional</span>}
        </label>
      )}
      <div className="form-control-wrap">
        {children}
      </div>
      {hint && !error && <span className="form-hint" id={id ? `${id}-hint` : undefined}>{hint}</span>}
      {error && <span className="form-error-text" role="alert" id={id ? `${id}-error` : undefined}>{error}</span>}
    </div>
  )
}
