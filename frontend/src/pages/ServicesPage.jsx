import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney, formatNumber } from '../utils/formatters'
import { formatStatusLabel } from '../utils/status'
import {
  createService,
  listServices,
  updateService as updateServiceRequest,
  updateServiceStatus,
} from '../services/serviceService'
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

const SERVICE_TYPES = [
  'GENERAL_SERVICE',
  'OIL_CHANGE',
  'BRAKE_SERVICE',
  'ENGINE_SERVICE',
  'AC_SERVICE',
  'TYRE_SERVICE',
  'BATTERY_SERVICE',
  'ELECTRICAL_SERVICE',
  'OTHER',
]

const WORKFLOW_STAGES = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'VEHICLE_RECEIVED', label: 'Received' },
  { key: 'INSPECTION', label: 'Inspection' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
]

const NEXT_STATUS = {
  REQUESTED: 'APPROVED',
  APPROVED: 'SCHEDULED',
  SCHEDULED: 'VEHICLE_RECEIVED',
  VEHICLE_RECEIVED: 'INSPECTION',
  INSPECTION: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const ACTIVE_STATUSES = new Set([
  'REQUESTED',
  'APPROVED',
  'SCHEDULED',
  'VEHICLE_RECEIVED',
  'INSPECTION',
  'IN_PROGRESS',
])

export default function ServicesPage() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Drawers
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [editingNotesService, setEditingNotesService] = useState(null)
  const [cancellingService, setCancellingService] = useState(null)
  const [advancingServiceId, setAdvancingServiceId] = useState(null)
  const [expandedCardIds, setExpandedCardIds] = useState(new Set())

  const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN'
  const isAdmin = user.role === 'ADMIN'
  const isCustomer = user.role === 'CUSTOMER'

  // Load services and vehicles
  const loadData = async () => {
    try {
      setError('')
      const [servicesRes, vehiclesRes] = await Promise.all([
        listServices(),
        listVehicles().catch(() => ({ data: { data: { vehicles: [] } } })),
      ])
      setServices(servicesRes.data?.data?.services || [])
      setVehicles(vehiclesRes.data?.data?.vehicles || [])
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user.role])

  // Map vehicle ID -> vehicle object
  const vehicleMap = useMemo(() => {
    const map = new Map()
    vehicles.forEach((v) => {
      if (v.id) map.set(v.id, v)
    })
    return map
  }, [vehicles])

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

  // Calculate status counts
  const counts = useMemo(() => {
    const res = {
      ALL: services.length,
      ACTIVE: 0,
      REQUESTED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    }
    services.forEach((s) => {
      if (ACTIVE_STATUSES.has(s.status)) res.ACTIVE++
      if (s.status === 'REQUESTED') res.REQUESTED++
      if (s.status === 'IN_PROGRESS' || s.status === 'INSPECTION' || s.status === 'VEHICLE_RECEIVED') {
        res.IN_PROGRESS++
      }
      if (s.status === 'COMPLETED') res.COMPLETED++
      if (s.status === 'CANCELLED') res.CANCELLED++
    })
    return res
  }, [services])

  // Filtered list
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // Status filter
      if (statusFilter === 'ACTIVE') {
        if (!ACTIVE_STATUSES.has(s.status)) return false
      } else if (statusFilter === 'IN_PROGRESS') {
        if (s.status !== 'IN_PROGRESS' && s.status !== 'INSPECTION' && s.status !== 'VEHICLE_RECEIVED') {
          return false
        }
      } else if (statusFilter !== 'ALL') {
        if (s.status !== statusFilter) return false
      }

      // Priority filter
      if (priorityFilter !== 'ALL') {
        if (s.priority !== priorityFilter) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const vehicle = s.vehicleId ? vehicleMap.get(s.vehicleId) : null
        const vehicleText = vehicle
          ? `${vehicle.make} ${vehicle.model} ${vehicle.registrationNumber}`.toLowerCase()
          : ''
        const searchCorpus = `${s.serviceType} ${s.description} ${s.status} ${s.priority} ${s.serviceNotes || ''} ${s.inspectionNotes || ''} ${vehicleText}`.toLowerCase()
        if (!searchCorpus.includes(q)) return false
      }

      return true
    })
  }, [services, statusFilter, priorityFilter, searchQuery, vehicleMap])

  // Advance status handler
  const handleAdvanceStatus = async (service) => {
    const next = NEXT_STATUS[service.status]
    if (!next) return

    setAdvancingServiceId(service.id)
    setError('')
    try {
      const res = await updateServiceStatus(service.id, next)
      const updated = res.data?.data?.service
      setServices((prev) => prev.map((item) => (item.id === service.id ? updated : item)))
      setSuccessMessage(`Service advanced to ${formatStatusLabel(next)}`)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setAdvancingServiceId(null)
    }
  }

  // Cancel status handler (Admin only)
  const handleCancelService = async () => {
    if (!cancellingService) return
    setError('')
    try {
      const res = await updateServiceStatus(cancellingService.id, 'CANCELLED')
      const updated = res.data?.data?.service
      setServices((prev) => prev.map((item) => (item.id === cancellingService.id ? updated : item)))
      setCancellingService(null)
      setSuccessMessage('Service job cancelled.')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  // Save notes & costs handler
  const handleSaveNotes = async (serviceId, payload) => {
    setError('')
    try {
      const res = await updateServiceRequest(serviceId, payload)
      const updated = res.data?.data?.service
      setServices((prev) => prev.map((item) => (item.id === serviceId ? updated : item)))
      setEditingNotesService(null)
      setSuccessMessage('Service details updated successfully.')
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Workshop operations"
        title="Services"
        description={
          isCustomer
            ? 'Track active repairs, view stage timelines, inspection notes, and cost breakdowns.'
            : 'Manage workshop queue, track service progression, update notes, and fulfill client requests.'
        }
      >
        {isCustomer && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setRequestModalOpen(true)}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Request service</span>
          </button>
        )}
      </PageHeader>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {/* Summary KPI Cards for Staff / Admin */}
      {isStaffOrAdmin && (
        <section className="stats-grid" aria-label="Services overview">
          <StatCard
            label="Total service jobs"
            value={formatNumber(counts.ALL)}
            icon={Wrench}
            tone="teal"
          />
          <StatCard
            label="Active in workshop"
            value={formatNumber(counts.IN_PROGRESS)}
            icon={Clock}
            tone="blue"
          />
          <StatCard
            label="Pending requests"
            value={formatNumber(counts.REQUESTED)}
            icon={AlertCircle}
            tone="amber"
          />
          <StatCard
            label="Completed jobs"
            value={formatNumber(counts.COMPLETED)}
            icon={CheckCircle2}
            tone="teal"
          />
        </section>
      )}

      {/* Filter Tabs Bar */}
      <section className="service-filter-bar surface" aria-label="Filter service by status">
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All jobs
          <span className="pill-count">{counts.ALL}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${statusFilter === 'ACTIVE' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          Active workflow
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
          className={`service-filter-pill ${statusFilter === 'IN_PROGRESS' ? 'is-active' : ''}`}
          onClick={() => setStatusFilter('IN_PROGRESS')}
        >
          In workshop
          <span className="pill-count">{counts.IN_PROGRESS}</span>
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
            Cancelled
            <span className="pill-count">{counts.CANCELLED}</span>
          </button>
        )}
      </section>

      {/* Toolbar with Search and Priority Selector */}
      <Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search service type, description, or vehicle..."
        resultCount={filteredServices.length}
        resultLabel={filteredServices.length === 1 ? 'service job' : 'service jobs'}
      >
        <div className="filter-group">
          <label htmlFor="priority-filter-select" className="sr-only">
            Filter by priority
          </label>
          <div className="select-with-icon">
            <Filter size={14} className="select-prefix-icon" aria-hidden="true" />
            <select
              id="priority-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="toolbar-select"
            >
              <option value="ALL">All priorities</option>
              <option value="URGENT">Urgent only</option>
              <option value="HIGH">High priority</option>
              <option value="MEDIUM">Medium priority</option>
              <option value="LOW">Low priority</option>
            </select>
          </div>
        </div>
      </Toolbar>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message="Loading service records & operations queue..." />
      ) : filteredServices.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={searchQuery || priorityFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No matching services' : 'No service requests yet'}
          description={
            searchQuery || priorityFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search query, status tab, or priority filter.'
              : isCustomer
              ? 'Schedule your first maintenance or repair request to get started.'
              : 'Service requests and active workshop jobs will appear here.'
          }
          action={
            isCustomer ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setRequestModalOpen(true)}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Request service</span>
              </button>
            ) : null
          }
        />
      ) : (
        <div className="service-feed" role="feed" aria-label="Service jobs list">
          {filteredServices.map((service) => {
            const vehicle = service.vehicleId ? vehicleMap.get(service.vehicleId) : null
            const isUrgent = service.priority === 'URGENT'
            const isHigh = service.priority === 'HIGH'
            const isCancelled = service.status === 'CANCELLED'
            const isCompleted = service.status === 'COMPLETED'
            const isExpanded = expandedCardIds.has(service.id)
            const nextStep = NEXT_STATUS[service.status]
            const isAdvancing = advancingServiceId === service.id
            const jobRef = `SRV-${(service.id || '').slice(-6).toUpperCase()}`

            // Stepper progress index
            const currentStageIndex = WORKFLOW_STAGES.findIndex((st) => st.key === service.status)
            const progressPercent = isCompleted
              ? 100
              : currentStageIndex >= 0
              ? Math.round(((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100)
              : 0

            return (
              <article
                key={service.id}
                className={`service-workflow-card ${isUrgent ? 'is-urgent' : isHigh ? 'is-high' : ''}`}
                aria-label={`Service job ${service.serviceType}`}
              >
                <div className="service-card-main">
                  {/* Top Header Row */}
                  <div className="service-header-row">
                    <div className="service-identity">
                      <div className="service-symbol-badge" aria-hidden="true">
                        <Wrench size={18} />
                      </div>
                      <div className="service-titles">
                        <div className="service-title-wrap">
                          <span className="job-reference-pill">{jobRef}</span>
                          {/* Required by E2E test to match: GENERAL SERVICE, OIL CHANGE, etc. */}
                          <strong className="service-type-title">
                            {service.serviceType ? service.serviceType.replaceAll('_', ' ') : 'GENERAL SERVICE'}
                          </strong>
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
                          <span>Requested {formatDate(service.createdAt)}</span>
                          {service.assignedStaffId && (
                            <>
                              <span className="meta-dot" aria-hidden="true">•</span>
                              <span className="staff-assigned-tag">Tech Assigned</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="service-tags-row">
                      {/* Priority Tag */}
                      <span className={`priority-tag priority-${service.priority?.toLowerCase() || 'medium'}`}>
                        {service.priority}
                      </span>
                      {/* Status Badge */}
                      <StatusBadge status={service.status} />
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="service-description-text">
                    <p>{service.description}</p>
                  </div>

                  {/* Stage Progress Stepper (Desktop full track + Mobile compact bar) */}
                  {!isCancelled ? (
                    <div className="service-stepper-wrap" aria-label="Service progress timeline">
                      {/* Desktop 7-Stage Stepper */}
                      <div className="service-stage-stepper" aria-hidden="true">
                        {WORKFLOW_STAGES.map((stage, idx) => {
                          const isDone = isCompleted || currentStageIndex > idx
                          const isCurrent = !isCompleted && currentStageIndex === idx
                          return (
                            <div
                              key={stage.key}
                              className={`service-stepper-node ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                            >
                              <div className="service-stepper-dot">
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span className="service-stepper-label">{stage.label}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Mobile Stage Progression Bar */}
                      <div className="service-mobile-stepper">
                        <div className="mobile-stepper-header">
                          <span className="mobile-stepper-label">
                            {isCompleted
                              ? 'All 7 stages complete'
                              : `Stage ${currentStageIndex + 1} of 7: ${formatStatusLabel(service.status)}`}
                          </span>
                          <span className="mobile-stepper-percent">{progressPercent}%</span>
                        </div>
                        <div className="mobile-stepper-track">
                          <div
                            className="mobile-stepper-fill"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="service-cancelled-alert">
                      <ShieldAlert size={15} aria-hidden="true" />
                      <span>This service job was cancelled and closed.</span>
                    </div>
                  )}

                  {/* Footer Row: Financials + Action Controls */}
                  <div className="service-footer-bar">
                    <div className="service-financial-meta">
                      <div>
                        <span className="meta-caption">Estimate</span>
                        <strong>
                          {service.estimatedCost !== null && service.estimatedCost !== undefined
                            ? formatMoney(service.estimatedCost)
                            : 'Pending quote'}
                        </strong>
                      </div>
                      <span className="meta-separator" aria-hidden="true">/</span>
                      <div>
                        <span className="meta-caption">Final Cost</span>
                        <strong>
                          {service.actualCost !== null && service.actualCost !== undefined
                            ? formatMoney(service.actualCost)
                            : isCompleted
                            ? 'Free / Included'
                            : 'Pending completion'}
                        </strong>
                      </div>
                      {service.completedAt && (
                        <>
                          <span className="meta-separator" aria-hidden="true">•</span>
                          <div>
                            <span className="meta-caption">Completed</span>
                            <strong>{formatDate(service.completedAt)}</strong>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="service-action-buttons">
                      {/* Toggle Notes Expansion */}
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => toggleExpand(service.id)}
                        aria-expanded={isExpanded}
                      >
                        <FileText size={14} aria-hidden="true" />
                        <span>Notes & details</span>
                        {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                      </button>

                      {/* Staff/Admin Edit Notes Button */}
                      {isStaffOrAdmin && (
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => setEditingNotesService(service)}
                          aria-label="Edit notes and pricing"
                        >
                          <FileText size={14} aria-hidden="true" />
                          <span>Edit notes/cost</span>
                        </button>
                      )}

                      {/* Advance Workflow Status Button */}
                      {isStaffOrAdmin && nextStep && (
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={() => handleAdvanceStatus(service)}
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

                      {/* Admin Cancel Button */}
                      {isAdmin && !isCompleted && !isCancelled && (
                        <button
                          type="button"
                          className="secondary-button danger-button compact-button"
                          onClick={() => setCancellingService(service)}
                          aria-label="Cancel service request"
                        >
                          <XCircle size={14} aria-hidden="true" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="service-expanded-panel">
                    <div className="service-note-card">
                      <strong>Inspection notes</strong>
                      <p>
                        {service.inspectionNotes || 'No inspection notes recorded yet by the mechanic.'}
                      </p>
                    </div>
                    <div className="service-note-card">
                      <strong>Service operations notes</strong>
                      <p>
                        {service.serviceNotes || 'No operations log notes recorded yet.'}
                      </p>
                    </div>
                    <div className="service-note-card">
                      <strong>Job details & timeline</strong>
                      <ul className="service-timeline-list">
                        <li><span>Job Ref:</span> <code>{jobRef}</code></li>
                        <li><span>Submitted:</span> {formatDate(service.createdAt)}</li>
                        <li><span>Last updated:</span> {formatDate(service.updatedAt)}</li>
                        <li>
                          <span>Assigned technician:</span>{' '}
                          {service.assignedStaffId ? 'Staff assigned' : 'Workshop pool (unassigned)'}
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Customer Service Request Modal */}
      {requestModalOpen && (
        <CustomerServiceRequestModal
          vehicles={vehicles}
          onClose={() => setRequestModalOpen(false)}
          onCreated={(newService) => {
            setServices((prev) => [newService, ...prev])
            setRequestModalOpen(false)
            setSuccessMessage('Service request submitted successfully.')
            setTimeout(() => setSuccessMessage(''), 4000)
          }}
        />
      )}

      {/* Staff/Admin Edit Notes & Costs Modal */}
      {editingNotesService && (
        <EditServiceNotesModal
          service={editingNotesService}
          onClose={() => setEditingNotesService(null)}
          onSave={(payload) => handleSaveNotes(editingNotesService.id, payload)}
        />
      )}

      {/* Admin Cancel Confirm Dialog */}
      {cancellingService && (
        <ConfirmDialog
          title="Cancel Service Job"
          description={`Are you sure you want to cancel this ${cancellingService.serviceType.replaceAll('_', ' ')} request? This action cannot be reversed.`}
          confirmLabel="Cancel service job"
          danger
          onConfirm={handleCancelService}
          onCancel={() => setCancellingService(null)}
        />
      )}
    </div>
  )
}

/**
 * Modal for Customers to request a service
 */
function CustomerServiceRequestModal({ vehicles, onClose, onCreated }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '')
  const [serviceType, setServiceType] = useState('GENERAL_SERVICE')
  const [priority, setPriority] = useState('MEDIUM')
  const [description, setDescription] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) {
      setVehicleId(vehicles[0].id)
    }
  }, [vehicles, vehicleId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!vehicleId) {
      setError('Please select a vehicle or add one to your account first.')
      return
    }
    if (!description.trim()) {
      setError('Please provide a description of the issue or requested maintenance.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        vehicle: vehicleId,
        serviceType,
        priority,
        description: description.trim(),
        estimatedCost: estimatedCost === '' ? undefined : Number(estimatedCost),
      }
      const res = await createService(payload)
      onCreated(res.data?.data?.service)
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Request a service"
      description="Select your vehicle and describe the service or maintenance required."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <Alert type="error" message={error} />}

        {vehicles.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Add a vehicle first"
            description="You must register at least one vehicle to your account before creating a service request."
            compact
          />
        ) : (
          <>
            <FormField id="service-vehicle" label="Vehicle" required>
              <select
                id="service-vehicle"
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

            <div className="field-grid">
              <FormField id="service-type" label="Service type" required>
                <select
                  id="service-type"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  required
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="service-priority" label="Priority" required>
                <select
                  id="service-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                >
                  <option value="LOW">Low (Standard routine)</option>
                  <option value="MEDIUM">Medium (Recommended)</option>
                  <option value="HIGH">High (Performance issue)</option>
                  <option value="URGENT">Urgent (Vehicle breakdown)</option>
                </select>
              </FormField>
            </div>

            {/* Crucial for E2E tests: getByLabel('Description') */}
            <FormField id="service-description" label="Description" required>
              <textarea
                id="service-description"
                rows="4"
                placeholder="Describe any symptoms, maintenance requirements, or specific requests..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </FormField>

            <FormField
              id="service-budget"
              label="Estimated budget"
              optional
              hint="Optional estimated budget you expect for this job."
            >
              <div className="input-prefix-wrap">
                <span className="input-prefix" aria-hidden="true">$</span>
                <input
                  id="service-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </FormField>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              {/* Crucial for E2E tests: getByRole('button', { name: 'Send request' }) */}
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

/**
 * Modal for Staff/Admin to edit notes and cost estimates
 */
function EditServiceNotesModal({ service, onClose, onSave }) {
  const [inspectionNotes, setInspectionNotes] = useState(service.inspectionNotes || '')
  const [serviceNotes, setServiceNotes] = useState(service.serviceNotes || '')
  const [estimatedCost, setEstimatedCost] = useState(
    service.estimatedCost !== null && service.estimatedCost !== undefined ? String(service.estimatedCost) : ''
  )
  const [actualCost, setActualCost] = useState(
    service.actualCost !== null && service.actualCost !== undefined ? String(service.actualCost) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        inspectionNotes: inspectionNotes.trim(),
        serviceNotes: serviceNotes.trim(),
        estimatedCost: estimatedCost === '' ? null : Number(estimatedCost),
        actualCost: actualCost === '' ? null : Number(actualCost),
      }
      await onSave(payload)
    } catch (err) {
      setError(getApiMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Update service notes & pricing"
      description={`Job #SRV-${(service.id || '').slice(-6).toUpperCase()} · ${service.serviceType.replaceAll('_', ' ')}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <Alert type="error" message={error} />}

        <FormField id="modal-inspection-notes" label="Inspection notes" optional>
          <textarea
            id="modal-inspection-notes"
            rows="3"
            placeholder="Mechanic diagnostic observations, tyre tread depth, battery health, etc..."
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
          />
        </FormField>

        <FormField id="modal-service-notes" label="Service operations notes" optional>
          <textarea
            id="modal-service-notes"
            rows="3"
            placeholder="Parts replaced, fluids flushed, alignment results, operations performed..."
            value={serviceNotes}
            onChange={(e) => setServiceNotes(e.target.value)}
          />
        </FormField>

        <div className="field-grid">
          <FormField id="modal-estimated-cost" label="Estimated cost ($)" optional>
            <input
              id="modal-estimated-cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </FormField>

          <FormField id="modal-actual-cost" label="Actual final cost ($)" optional>
            <input
              id="modal-actual-cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
            />
          </FormField>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}