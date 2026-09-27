import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Clock3,
  FileText,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Plus,
  Search,
  ShieldAlert,
  User as UserIcon,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatNumber } from '../utils/formatters'
import { formatServiceType, formatStatusLabel } from '../utils/status'
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
} from '../services/appointmentService'
import { listServices } from '../services/serviceService'
import { listVehicles } from '../services/vehicleService'
import PageHeader from '../components/PageHeader'
import Toolbar from '../components/Toolbar'
import StatusBadge from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'

const NEXT_STATUS = {
  REQUESTED: 'CONFIRMED',
  CONFIRMED: 'CHECKED_IN',
  CHECKED_IN: 'IN_SERVICE',
  IN_SERVICE: 'COMPLETED',
}

const ACTIVE_STATUSES = new Set(['REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'])

export default function AppointmentsPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // View Mode & Filters
  const [viewMode, setViewMode] = useState('list') // 'list' | 'timeline'
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timeframeFilter, setTimeframeFilter] = useState('ALL') // 'ALL' | 'UPCOMING' | 'TODAY' | 'PAST'
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [cancellingAppointment, setCancellingAppointment] = useState(null)
  const [advancingId, setAdvancingId] = useState(null)
  const [expandedCardIds, setExpandedCardIds] = useState(new Set())

  const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN'
  const isCustomer = user.role === 'CUSTOMER'
  const canBook = user.role === 'CUSTOMER' || user.role === 'ADMIN'

  // Load appointments, vehicles, and services
  const loadData = async () => {
    try {
      setError('')
      const [appRes, vehRes, srvRes] = await Promise.all([
        listAppointments(),
        listVehicles().catch(() => ({ data: { data: { vehicles: [] } } })),
        listServices().catch(() => ({ data: { data: { services: [] } } })),
      ])
      setAppointments(appRes.data?.data?.appointments || [])
      setVehicles(vehRes.data?.data?.vehicles || [])
      setServices(srvRes.data?.data?.services || [])
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user.role])

  // Vehicle & Service lookup maps
  const vehicleMap = useMemo(() => {
    const map = new Map()
    vehicles.forEach((v) => {
      if (v.id) map.set(v.id, v)
    })
    return map
  }, [vehicles])

  const serviceMap = useMemo(() => {
    const map = new Map()
    services.forEach((s) => {
      if (s.id) map.set(s.id, s)
    })
    return map
  }, [services])

  const toggleExpand = (id) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Today's Date String (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // KPI Counts
  const counts = useMemo(() => {
    const res = {
      ALL: appointments.length,
      ACTIVE: 0,
      TODAY: 0,
      REQUESTED: 0,
      IN_WORKSHOP: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    }
    appointments.forEach((apt) => {
      if (ACTIVE_STATUSES.has(apt.status)) res.ACTIVE++
      if (apt.appointmentDate === todayStr && apt.status !== 'CANCELLED') res.TODAY++
      if (apt.status === 'REQUESTED') res.REQUESTED++
      if (apt.status === 'CHECKED_IN' || apt.status === 'IN_SERVICE') res.IN_WORKSHOP++
      if (apt.status === 'COMPLETED') res.COMPLETED++
      if (apt.status === 'CANCELLED') res.CANCELLED++
    })
    return res
  }, [appointments, todayStr])

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Status Filter
      if (statusFilter === 'ACTIVE') {
        if (!ACTIVE_STATUSES.has(apt.status)) return false
      } else if (statusFilter === 'IN_WORKSHOP') {
        if (apt.status !== 'CHECKED_IN' && apt.status !== 'IN_SERVICE') return false
      } else if (statusFilter !== 'ALL') {
        if (apt.status !== statusFilter) return false
      }

      // Timeframe Filter
      if (timeframeFilter === 'TODAY') {
        if (apt.appointmentDate !== todayStr) return false
      } else if (timeframeFilter === 'UPCOMING') {
        if (apt.appointmentDate < todayStr || apt.status === 'COMPLETED' || apt.status === 'CANCELLED') return false
      } else if (timeframeFilter === 'PAST') {
        if (apt.appointmentDate >= todayStr && apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED') return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const vehicle = apt.vehicleId ? vehicleMap.get(apt.vehicleId) : null
        const service = apt.serviceId ? serviceMap.get(apt.serviceId) : null
        const vehicleText = vehicle
          ? `${vehicle.make} ${vehicle.model} ${vehicle.registrationNumber}`.toLowerCase()
          : ''
        const serviceText = service ? `${service.serviceType} ${service.description || ''}`.toLowerCase() : ''
        const refText = `apt-${(apt.id || '').slice(-6)}`.toLowerCase()
        const searchCorpus = `${apt.appointmentDate} ${apt.appointmentTime} ${apt.status} ${apt.notes || ''} ${vehicleText} ${serviceText} ${refText}`.toLowerCase()
        if (!searchCorpus.includes(q)) return false
      }

      return true
    })
  }, [appointments, statusFilter, timeframeFilter, searchQuery, vehicleMap, serviceMap, todayStr])

  // Grouped by Date for Timeline/Day Board View
  const groupedAppointments = useMemo(() => {
    const map = new Map()
    filteredAppointments.forEach((apt) => {
      const dateKey = apt.appointmentDate
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey).push(apt)
    })
    // Sort chronological dates
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredAppointments])

  // Advance Status Handler
  const handleAdvanceStatus = async (appointment) => {
    const next = NEXT_STATUS[appointment.status]
    if (!next) return

    setAdvancingId(appointment.id)
    setError('')
    try {
      const res = await updateAppointmentStatus(appointment.id, next)
      const updated = res.data?.data?.appointment
      setAppointments((prev) => prev.map((item) => (item.id === appointment.id ? updated : item)))
      setSuccessMessage(`Appointment moved to ${formatStatusLabel(next)}`)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setAdvancingId(null)
    }
  }

  // Cancel Appointment Handler
  const handleCancelAppointment = async (appointmentToCancel) => {
    const target = appointmentToCancel || cancellingAppointment
    if (!target) return
    setError('')
    try {
      const res = await updateAppointmentStatus(target.id, 'CANCELLED')
      const updated = res.data?.data?.appointment
      setAppointments((prev) => prev.map((item) => (item.id === target.id ? updated : item)))
      setCancellingAppointment(null)
      setSuccessMessage('Appointment booking removed.')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Workshop scheduling"
        title="Appointments"
        description={
          isCustomer
            ? 'Manage your scheduled service drop-offs, track check-in status, and book new visit slots.'
            : 'Operational day-board, bay scheduling queue, vehicle check-ins, and service intake timeline.'
        }
      >
        {canBook && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} aria-hidden="true" />
            <span>New appointment</span>
          </button>
        )}
      </PageHeader>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {/* Staff & Admin Operational Summary KPIs */}
      {isStaffOrAdmin && (
        <section className="stats-grid" aria-label="Appointment operations overview">
          <StatCard
            label="Total bookings"
            value={formatNumber(counts.ALL)}
            icon={CalendarDays}
            tone="teal"
          />
          <StatCard
            label="Today's visits"
            value={formatNumber(counts.TODAY)}
            icon={CalendarClock}
            tone="blue"
          />
          <StatCard
            label="Pending requests"
            value={formatNumber(counts.REQUESTED)}
            icon={AlertCircle}
            tone="amber"
          />
          <StatCard
            label="Active in workshop"
            value={formatNumber(counts.IN_WORKSHOP)}
            icon={Wrench}
            tone="teal"
          />
        </section>
      )}

      {/* Filter Tabs Bar */}
      <section className="service-filter-bar surface" aria-label="Filter appointments by status">
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All visits
          <span className="pill-count">{counts.ALL}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'ACTIVE' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          Active schedule
          <span className="pill-count">{counts.ACTIVE}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'REQUESTED' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('REQUESTED')}
        >
          Requested
          <span className="pill-count">{counts.REQUESTED}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'IN_WORKSHOP' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('IN_WORKSHOP')}
        >
          In workshop
          <span className="pill-count">{counts.IN_WORKSHOP}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'COMPLETED' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('COMPLETED')}
        >
          Completed
          <span className="pill-count">{counts.COMPLETED}</span>
        </button>
        {counts.CANCELLED > 0 && (
          <button
            type="button"
            className={`service-filter-pill ${statusFilter === 'CANCELLED' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('CANCELLED')}
          >
            Archived visits
            <span className="pill-count">{counts.CANCELLED}</span>
          </button>
        )}
      </section>

      {/* Toolbar with Search, Timeframe Selector, and View Mode Toggle */}
      <Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search date (YYYY-MM-DD), vehicle, plate, service..."
        resultCount={filteredAppointments.length}
        resultLabel={filteredAppointments.length === 1 ? 'appointment' : 'appointments'}
      >
        <div className="appointment-toolbar-controls">
          <div className="filter-group">
            <label htmlFor="timeframe-filter-select" className="sr-only">
              Filter by schedule window
            </label>
            <div className="select-with-icon">
              <Filter size={14} className="select-prefix-icon" aria-hidden="true" />
              <select
                id="timeframe-filter-select"
                value={timeframeFilter}
                onChange={(e) => setTimeframeFilter(e.target.value)}
                className="toolbar-select"
              >
                <option value="ALL">All dates</option>
                <option value="TODAY">Today only</option>
                <option value="UPCOMING">Upcoming dates</option>
                <option value="PAST">Past dates</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle: List vs Timeline */}
          <div className="view-mode-toggle" role="group" aria-label="Appointment view layout">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view layout"
              title="List view layout"
            >
              <List size={15} aria-hidden="true" />
              <span className="toggle-label">List</span>
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'timeline' ? 'is-active' : ''}`}
              onClick={() => setViewMode('timeline')}
              aria-label="Calendar schedule board"
              title="Calendar schedule board"
            >
              <LayoutGrid size={15} aria-hidden="true" />
              <span className="toggle-label">Board</span>
            </button>
          </div>
        </div>
      </Toolbar>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message="Loading appointment schedule & workshop queue..." />
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            searchQuery || timeframeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No matching appointments'
              : 'No appointments scheduled'
          }
          description={
            searchQuery || timeframeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search query, status tab, or timeframe filter.'
              : isCustomer
              ? 'Book your first vehicle service appointment when maintenance or repair is required.'
              : 'Scheduled customer visit slots and check-ins will appear here.'
          }
          action={
            canBook ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus size={16} aria-hidden="true" />
                <span>New appointment</span>
              </button>
            ) : null
          }
        />
      ) : viewMode === 'timeline' ? (
        /* Timeline / Day Board View */
        <div className="appointment-timeline-board" aria-label="Appointments schedule board">
          {groupedAppointments.map(([dateKey, items]) => {
            const isToday = dateKey === todayStr
            const isPast = dateKey < todayStr
            return (
              <section key={dateKey} className="timeline-day-group">
                <div className="timeline-day-header">
                  <div className="day-badge-wrap">
                    <Calendar size={16} className="day-icon" aria-hidden="true" />
                    {/* Preserves raw date match for test requirements */}
                    <strong className="day-date-title">{dateKey}</strong>
                    <span className="day-human-sub">{formatDate(dateKey, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="day-status-pill">
                    {isToday && <span className="today-chip">Today</span>}
                    {isPast && <span className="past-chip">Past</span>}
                    <span className="count-chip">{items.length} {items.length === 1 ? 'visit' : 'visits'}</span>
                  </div>
                </div>

                <div className="timeline-day-cards">
                  {items.map((apt) => renderAppointmentCard(apt))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="service-feed" role="feed" aria-label="Appointment jobs list">
          {filteredAppointments.map((apt) => renderAppointmentCard(apt))}
        </div>
      )}

      {/* Book Appointment Modal */}
      {createModalOpen && (
        <BookAppointmentModal
          vehicles={vehicles}
          services={services}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(newApt) => {
            setAppointments((prev) => [newApt, ...prev])
            setCreateModalOpen(false)
            setSuccessMessage('Appointment booked successfully.')
            setTimeout(() => setSuccessMessage(''), 4000)
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {cancellingAppointment && (
        <ConfirmDialog
          title="Cancel Appointment"
          description={`Are you sure you want to cancel the appointment scheduled on ${cancellingAppointment.appointmentDate} at ${cancellingAppointment.appointmentTime}? This action cannot be reversed.`}
          confirmLabel="Cancel appointment"
          danger
          onConfirm={() => handleCancelAppointment(cancellingAppointment)}
          onCancel={() => setCancellingAppointment(null)}
        />
      )}
    </div>
  )

  /**
   * Render single Appointment Card
   */
  function renderAppointmentCard(appointment) {
    const vehicle = appointment.vehicleId ? vehicleMap.get(appointment.vehicleId) : null
    const service = appointment.serviceId ? serviceMap.get(appointment.serviceId) : null
    const isCompleted = appointment.status === 'COMPLETED'
    const isCancelled = appointment.status === 'CANCELLED'
    const isExpanded = expandedCardIds.has(appointment.id)
    const nextStep = NEXT_STATUS[appointment.status]
    const isAdvancing = advancingId === appointment.id
    const isToday = appointment.appointmentDate === todayStr
    const apptRef = `APT-${(appointment.id || '').slice(-6).toUpperCase()}`

    return (
      <article
        key={appointment.id}
        className={`service-workflow-card appointment-card ${isToday ? 'is-today-active' : ''}`}
        aria-label={`Appointment for ${appointment.appointmentDate}`}
      >
        <div className="service-card-main">
          {/* Top Header Row */}
          <div className="service-header-row">
            <div className="service-identity">
              {/* Date & Time Calendar Block */}
              <div
                className={`appointment-calendar-block ${isToday ? 'is-today' : ''}`}
                onClick={() => toggleExpand(appointment.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleExpand(appointment.id)
                  }
                }}
                aria-label={`Toggle details for ${appointment.appointmentDate}`}
              >
                <div className="cal-time">{appointment.appointmentTime}</div>
                {/* Critical for E2E tests: getByText('2099-12-01') */}
                <div className="cal-date">{appointment.appointmentDate}</div>
              </div>

              <div className="service-titles">
                <div className="service-title-wrap">
                  <span className="job-reference-pill">{apptRef}</span>
                  <strong className="service-type-title">
                    {service ? formatServiceType(service.serviceType) : 'Service visit'}
                  </strong>
                  {isToday && <span className="today-badge">Today</span>}
                </div>

                <div className="service-vehicle-meta">
                  {vehicle ? (
                    <>
                      <Car size={13} aria-hidden="true" />
                      <strong>
                        {vehicle.make} {vehicle.model}
                      </strong>
                      <span className="plate-pill">{vehicle.registrationNumber}</span>
                    </>
                  ) : (
                    <span>Registered vehicle</span>
                  )}
                  <span className="meta-dot" aria-hidden="true">•</span>
                  <Clock3 size={13} aria-hidden="true" />
                  <span>{appointment.appointmentTime}</span>
                  {appointment.assignedStaffId && (
                    <>
                      <span className="meta-dot" aria-hidden="true">•</span>
                      <span className="staff-assigned-tag">Tech Assigned</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="service-tags-row">
              {/* Status Badge */}
              <StatusBadge status={appointment.status} />
            </div>
          </div>

          {/* Notes or Description Preview */}
          {appointment.notes && (
            <div className="service-description-text appointment-notes-preview">
              <p>{appointment.notes}</p>
            </div>
          )}

          {/* Footer Bar: Actions & Summary */}
          <div className="service-footer-bar">
            <div className="appointment-meta-summary">
              <span className="meta-caption">Scheduled Service</span>
              <strong>{service ? formatServiceType(service.serviceType) : 'General inspection'}</strong>
            </div>

            <div className="service-action-buttons">
              {/* Toggle Details Expansion */}
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => toggleExpand(appointment.id)}
                aria-expanded={isExpanded}
              >
                <FileText size={14} aria-hidden="true" />
                <span>Details & notes</span>
                {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
              </button>

              {/* Staff / Admin Advance Status Button */}
              {isStaffOrAdmin && nextStep && (
                <button
                  type="button"
                  className="primary-button compact-button"
                  onClick={() => handleAdvanceStatus(appointment)}
                  disabled={isAdvancing}
                >
                  {isAdvancing ? (
                    <span>Updating...</span>
                  ) : (
                    <>
                      <span>Move to {formatStatusLabel(nextStep)}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </>
                  )}
                </button>
              )}

              {/* Customer Cancel Button */}
              {isCustomer && ['REQUESTED', 'CONFIRMED'].includes(appointment.status) && (
                <button
                  type="button"
                  className="secondary-button danger-button compact-button"
                  onClick={() => handleCancelAppointment(appointment)}
                  aria-label="Cancel appointment"
                >
                  <XCircle size={14} aria-hidden="true" />
                  <span>Cancel appointment</span>
                </button>
              )}

              {/* Admin Cancel Button */}
              {user.role === 'ADMIN' && !isCompleted && !isCancelled && (
                <button
                  type="button"
                  className="secondary-button danger-button compact-button"
                  onClick={() => setCancellingAppointment(appointment)}
                  aria-label="Cancel appointment"
                >
                  <XCircle size={14} aria-hidden="true" />
                  <span>Cancel appointment</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Details Panel */}
        {isExpanded && (
          <div className="service-expanded-panel">
            <div className="service-note-card">
              <strong>Appointment Details</strong>
              <ul className="service-timeline-list">
                <li><span>Reference:</span> <code>{apptRef}</code></li>
                <li><span>Date:</span> <strong>{appointment.appointmentDate}</strong></li>
                <li><span>Time slot:</span> <strong>{appointment.appointmentTime}</strong></li>
                <li><span>Stage:</span> <strong>{appointment.status === 'CANCELLED' ? 'Closed / Void' : formatStatusLabel(appointment.status)}</strong></li>
              </ul>
            </div>

            <div className="service-note-card">
              <strong>Vehicle & Service</strong>
              <ul className="service-timeline-list">
                <li>
                  <span>Vehicle:</span>{' '}
                  <strong>{vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year || 'N/A'})` : 'N/A'}</strong>
                </li>
                <li>
                  <span>License Plate:</span>{' '}
                  <code className="plate-pill">{vehicle?.registrationNumber || 'N/A'}</code>
                </li>
                <li>
                  <span>Linked service:</span>{' '}
                  <strong>{service ? formatServiceType(service.serviceType) : 'General Service'}</strong>
                </li>
                <li>
                  <span>Technician:</span>{' '}
                  {appointment.assignedStaffId ? 'Staff assigned' : 'Workshop pool (unassigned)'}
                </li>
              </ul>
            </div>

            <div className="service-note-card">
              <strong>Booking Notes & Instructions</strong>
              <p>{appointment.notes || 'No specific customer booking instructions recorded.'}</p>
              <div className="appointment-timestamps">
                <small>Created: {formatDate(appointment.createdAt)}</small>
                {appointment.updatedAt && (
                  <small> • Updated: {formatDate(appointment.updatedAt)}</small>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    )
  }
}

/**
 * Modal for Booking a New Appointment
 */
function BookAppointmentModal({ vehicles, services, onClose, onCreated }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '')
  const [serviceId, setServiceId] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Sync vehicleId when vehicles are provided/loaded
  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) {
      setVehicleId(vehicles[0].id)
    }
  }, [vehicles, vehicleId])

  // Available services for the chosen vehicle
  const availableServices = useMemo(() => {
    if (!vehicleId) return []
    return services.filter((s) => {
      const sVehId = s.vehicleId || (s.vehicle && s.vehicle.id) || s.vehicle
      return sVehId === vehicleId
    })
  }, [services, vehicleId])

  // Automatically select the first available service when vehicle changes
  useEffect(() => {
    if (availableServices.length > 0) {
      setServiceId(availableServices[0].id)
    } else {
      setServiceId('')
    }
  }, [availableServices])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!vehicleId) {
      setError('Please select a vehicle.')
      return
    }
    if (!serviceId) {
      setError('Please create or select an active service request for this vehicle first.')
      return
    }
    if (!appointmentDate || !appointmentTime) {
      setError('Please specify both an appointment date and time.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        vehicle: vehicleId,
        service: serviceId,
        appointmentDate,
        appointmentTime,
        notes: notes.trim(),
      }
      const res = await createAppointment(payload)
      onCreated(res.data?.data?.appointment)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Book an appointment"
      description="Choose your vehicle, linked service request, and preferred workshop visit slot."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <Alert type="error" message={error} />}

        {vehicles.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Add a vehicle first"
            description="You must register at least one vehicle before you can schedule a service appointment."
            compact
          />
        ) : (
          <>
            <FormField id="appointment-vehicle" label="Vehicle" required>
              <select
                id="appointment-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} · {v.make} {v.model} ({v.year || 'N/A'})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              id="appointment-service"
              label="Service request"
              required
              hint={availableServices.length === 0 ? 'No open services for this vehicle. Request a service first.' : undefined}
            >
              <select
                id="appointment-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                disabled={availableServices.length === 0}
              >
                {availableServices.length === 0 ? (
                  <option value="">No service requests found for this vehicle</option>
                ) : (
                  availableServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatServiceType(s.serviceType)} · {formatStatusLabel(s.status)}
                    </option>
                  ))
                )}
              </select>
            </FormField>

            <div className="field-grid">
              {/* Critical for E2E tests: getByLabel('Date') */}
              <FormField id="appointment-date" label="Date" required>
                <input
                  id="appointment-date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                />
              </FormField>

              {/* Critical for E2E tests: getByLabel('Time') */}
              <FormField id="appointment-time" label="Time" required>
                <input
                  id="appointment-time"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  required
                />
              </FormField>
            </div>

            <FormField id="appointment-notes" label="Notes" optional hint="Any drop-off requirements or symptoms to communicate to the team.">
              <textarea
                id="appointment-notes"
                rows="3"
                placeholder="Drop-off preferences, specific symptoms, or arrival instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              {/* Critical for E2E tests: getByRole('button', { name: 'Book appointment' }) */}
              <button
                type="submit"
                className="primary-button"
                disabled={saving || !serviceId}
              >
                {saving ? 'Booking...' : 'Book appointment'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}