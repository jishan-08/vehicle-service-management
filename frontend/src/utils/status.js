/**
 * Centralized Status System
 * Maps backend enum values to semantic categories, human-readable labels, and UI tone styles.
 */

export const STATUS_TONES = {
  // Positive / Completed states
  COMPLETED: 'teal',
  PAID: 'teal',
  APPROVED: 'teal',
  ACTIVE: 'teal',

  // In-Progress / Action states
  IN_PROGRESS: 'blue',
  IN_SERVICE: 'blue',
  INSPECTION: 'blue',
  VEHICLE_RECEIVED: 'blue',
  SCHEDULED: 'blue',

  // Pending / Caution states
  REQUESTED: 'amber',
  PENDING: 'amber',
  CONFIRMED: 'amber',
  CHECKED_IN: 'amber',
  PARTIALLY_PAID: 'amber',
  DRAFT: 'amber',

  // Warning / Danger states
  CANCELLED: 'coral',
  REJECTED: 'coral',
  OVERDUE: 'coral',
  FAILED: 'coral',

  // Neutral states
  DEFAULT: 'slate',
}

const HUMAN_LABELS = {
  // Appointment & Service statuses
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  VEHICLE_RECEIVED: 'Vehicle received',
  INSPECTION: 'Inspection',
  IN_PROGRESS: 'In progress',
  IN_SERVICE: 'In service',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',

  // Payment statuses
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',

  // Service types
  GENERAL_SERVICE: 'General service',
  OIL_CHANGE: 'Oil change',
  BRAKE_SERVICE: 'Brake service',
  ENGINE_SERVICE: 'Engine service',
  AC_SERVICE: 'AC service',
  TYRE_SERVICE: 'Tyre service',
  BATTERY_SERVICE: 'Battery service',
  ELECTRICAL_SERVICE: 'Electrical service',
  OTHER: 'Other service',

  // Roles
  CUSTOMER: 'Customer',
  STAFF: 'Service staff',
  ADMIN: 'Administrator',
}

export function formatStatusLabel(status, { uppercase = false } = {}) {
  if (!status) return ''
  const key = String(status).toUpperCase()
  const human = HUMAN_LABELS[key] || key.replaceAll('_', ' ')
  return uppercase ? human.toUpperCase() : human
}

export function getStatusTone(status) {
  if (!status) return STATUS_TONES.DEFAULT
  const key = String(status).toUpperCase()
  return STATUS_TONES[key] || STATUS_TONES.DEFAULT
}

export function getStatusClass(status) {
  const tone = getStatusTone(status)
  return `status-badge status-tone-${tone} status-${String(status).toLowerCase().replace(/_/g, '-')}`
}

export function formatServiceType(type) {
  if (!type) return ''
  return HUMAN_LABELS[type] || String(type).replaceAll('_', ' ')
}

export function formatPaymentStatus(status) {
  if (!status) return ''
  return HUMAN_LABELS[status] || String(status).replaceAll('_', ' ')
}
