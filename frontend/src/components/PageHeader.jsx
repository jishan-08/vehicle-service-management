export default function PageHeader({ eyebrow, title, description, children, className = '' }) {
  return (
    <section className={`page-heading ${className}`}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </section>
  )
}
