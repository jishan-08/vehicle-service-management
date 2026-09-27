export default function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'amber',
  planned = false,
  className = '',
}) {
  return (
    <article className={`stat-card tone-${tone} ${planned ? 'is-planned' : ''} ${className}`.trim()}>
      <div className="stat-top">
        <span className="stat-icon" aria-hidden="true">
          {Icon && <Icon size={18} />}
        </span>
        {planned && <span className="planned-pill">Planned</span>}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {detail && <p>{detail}</p>}
    </article>
  )
}