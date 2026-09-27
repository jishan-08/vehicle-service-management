import { Search } from 'lucide-react'

export default function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  resultCount,
  resultLabel = 'items',
  children,
  className = '',
}) {
  return (
    <section className={`toolbar surface ${className}`}>
      {onSearchChange !== undefined && (
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder={searchPlaceholder}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}
      {children}
      {resultCount !== undefined && (
        <span className="result-count">
          {resultCount} {resultLabel}
        </span>
      )}
    </section>
  )
}
