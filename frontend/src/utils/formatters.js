/**
 * Common formatting helpers for UI display across the application.
 */

export function formatMoney(value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '$0.00'
  }
  return `$${Number(value).toFixed(2)}`
}

export function formatCurrency(value) {
  return formatMoney(value)
}

export function formatDate(dateInput, options = {}) {
  if (!dateInput) return '—'
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return String(dateInput)
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date)
}

export function formatShortDate(dateInput) {
  return formatDate(dateInput, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatInitials(name = '') {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('en-US')
}
