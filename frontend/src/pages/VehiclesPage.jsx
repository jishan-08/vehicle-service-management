import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bike,
  Bus,
  Calendar,
  Car,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Filter,
  Fuel,
  Gauge,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  User as UserIcon,
  Wrench,
  Zap,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney, formatNumber } from '../utils/formatters'
import { formatServiceType, formatStatusLabel } from '../utils/status'
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from '../services/vehicleService'
import { listServices } from '../services/serviceService'
import { listAppointments } from '../services/appointmentService'
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

const FUEL_TYPES = [
  { value: 'PETROL', label: 'Petrol', icon: Fuel },
  { value: 'DIESEL', label: 'Diesel', icon: Fuel },
  { value: 'ELECTRIC', label: 'Electric (EV)', icon: Zap },
  { value: 'HYBRID', label: 'Hybrid', icon: Zap },
  { value: 'CNG', label: 'CNG', icon: Fuel },
  { value: 'LPG', label: 'LPG', icon: Fuel },
]

const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Passenger Car', icon: Car },
  { value: 'SUV', label: 'SUV / Crossover', icon: CarFront },
  { value: 'MOTORCYCLE', label: 'Motorcycle / Bike', icon: Bike },
  { value: 'VAN', label: 'Van / MPV', icon: Truck },
  { value: 'TRUCK', label: 'Truck / Commercial', icon: Truck },
  { value: 'BUS', label: 'Bus', icon: Bus },
  { value: 'OTHER', label: 'Other Vehicle', icon: Car },
]

const blankVehicle = {
  registrationNumber: '',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  fuelType: 'PETROL',
  vehicleType: 'CAR',
}

function getVehicleTypeIcon(type) {
  switch (type) {
    case 'MOTORCYCLE':
      return Bike
    case 'TRUCK':
    case 'VAN':
      return Truck
    case 'BUS':
      return Bus
    case 'SUV':
      return CarFront
    default:
      return Car
  }
}

function formatFuelLabel(fuel) {
  const match = FUEL_TYPES.find((f) => f.value === fuel)
  return match ? match.label : fuel ? fuel.charAt(0) + fuel.slice(1).toLowerCase() : 'Petrol'
}

function formatVehicleTypeLabel(type) {
  const match = VEHICLE_TYPES.find((v) => v.value === type)
  return match ? match.label : type ? type.charAt(0) + type.slice(1).toLowerCase() : 'Car'
}

export default function VehiclesPage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filters & State
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL' | 'CAR' | 'SUV' | 'MOTORCYCLE' | 'COMMERCIAL' | 'EV_HYBRID'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedVehicleIds, setExpandedVehicleIds] = useState(new Set())

  // Modals
  const [modal, setModal] = useState(null) // { vehicle, editing: boolean }
  const [deletingVehicle, setDeletingVehicle] = useState(null)

  const isCustomer = user.role === 'CUSTOMER'
  const canManage = isCustomer || user.role === 'ADMIN'

  // Load Vehicles, Services, and Appointments
  const loadData = async () => {
    try {
      setError('')
      const [vehRes, srvRes, apptRes] = await Promise.all([
        listVehicles(),
        listServices().catch(() => ({ data: { data: { services: [] } } })),
        listAppointments().catch(() => ({ data: { data: { appointments: [] } } })),
      ])

      setVehicles(vehRes.data?.data?.vehicles || [])
      setServices(srvRes.data?.data?.services || [])
      setAppointments(apptRes.data?.data?.appointments || [])
    } catch (err) {
      setError(getApiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user.role])

  // Map vehicle ID -> Array of linked services
  const vehicleServicesMap = useMemo(() => {
    const map = new Map()
    services.forEach((srv) => {
      const vId = srv.vehicleId || (srv.vehicle && srv.vehicle.id) || srv.vehicle
      if (vId) {
        if (!map.has(vId)) map.set(vId, [])
        map.get(vId).push(srv)
      }
    })
    return map
  }, [services])

  // Map vehicle ID -> Array of linked appointments
  const vehicleAppointmentsMap = useMemo(() => {
    const map = new Map()
    appointments.forEach((apt) => {
      const vId = apt.vehicleId || (apt.vehicle && apt.vehicle.id) || apt.vehicle
      if (vId) {
        if (!map.has(vId)) map.set(vId, [])
        map.get(vId).push(apt)
      }
    })
    return map
  }, [appointments])

  // Toggle card expansion
  const toggleExpand = (id) => {
    setExpandedVehicleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Fleet Overview KPI Stats
  const stats = useMemo(() => {
    let carsAndSuvs = 0
    let bikesAndCommercial = 0
    let evHybrid = 0
    let activeInService = 0

    vehicles.forEach((v) => {
      if (v.vehicleType === 'CAR' || v.vehicleType === 'SUV') {
        carsAndSuvs++
      } else {
        bikesAndCommercial++
      }

      if (v.fuelType === 'ELECTRIC' || v.fuelType === 'HYBRID') {
        evHybrid++
      }

      // Check if vehicle has active service
      const vServices = vehicleServicesMap.get(v.id) || []
      const hasActive = vServices.some(
        (s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED'
      )
      if (hasActive) activeInService++
    })

    return {
      total: vehicles.length,
      carsAndSuvs,
      bikesAndCommercial,
      evHybrid,
      activeInService,
    }
  }, [vehicles, vehicleServicesMap])

  // Filtered Vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      // Type Filter
      if (typeFilter === 'CAR' && vehicle.vehicleType !== 'CAR') return false
      if (typeFilter === 'SUV' && vehicle.vehicleType !== 'SUV') return false
      if (typeFilter === 'MOTORCYCLE' && vehicle.vehicleType !== 'MOTORCYCLE') return false
      if (typeFilter === 'COMMERCIAL' && !['TRUCK', 'VAN', 'BUS'].includes(vehicle.vehicleType)) return false
      if (typeFilter === 'EV_HYBRID' && !['ELECTRIC', 'HYBRID'].includes(vehicle.fuelType)) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const searchCorpus = `${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model} ${vehicle.year} ${vehicle.fuelType} ${vehicle.vehicleType}`.toLowerCase()
        if (!searchCorpus.includes(q)) return false
      }

      return true
    })
  }, [vehicles, typeFilter, searchQuery])

  // Delete Handler
  const handleDelete = async () => {
    if (!deletingVehicle) return
    setError('')
    try {
      await deleteVehicle(deletingVehicle.id)
      setVehicles((prev) => prev.filter((item) => item.id !== deletingVehicle.id))
      setSuccessMessage(`Vehicle ${deletingVehicle.registrationNumber} removed successfully.`)
      setDeletingVehicle(null)
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  return (
    <div className="content-page vehicles-page-container">
      {/* Page Header */}
      <PageHeader
        title="Vehicles"
        eyebrow="Garage registry"
        description="Every vehicle in your fleet with full maintenance logs and active service status."
      >
        {isCustomer && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setModal({ vehicle: blankVehicle, editing: false })}
            aria-label="Add vehicle"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add vehicle</span>
          </button>
        )}
      </PageHeader>

      {/* Alerts */}
      {error && <Alert type="danger" message={error} onClose={() => setError('')} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {/* Fleet KPI Metric Cards */}
      <section className="stats-grid" aria-label="Fleet overview metrics">
        <StatCard
          label="Registered Fleet"
          value={formatNumber(stats.total)}
          icon={Car}
          tone="navy"
        />
        <StatCard
          label="Cars & SUVs"
          value={formatNumber(stats.carsAndSuvs)}
          icon={CarFront}
          tone="blue"
        />
        <StatCard
          label="Bikes & Commercial"
          value={formatNumber(stats.bikesAndCommercial)}
          icon={Truck}
          tone="amber"
        />
        <StatCard
          label="Active in Service"
          value={formatNumber(stats.activeInService)}
          icon={Wrench}
          tone={stats.activeInService > 0 ? 'teal' : 'slate'}
        />
      </section>

      {/* Filter Category Pills */}
      <section className="service-filter-bar surface" aria-label="Filter vehicles by category">
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('ALL')}
        >
          All fleet
          <span className="pill-count">{vehicles.length}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'CAR' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('CAR')}
        >
          Cars
          <span className="pill-count">{vehicles.filter((v) => v.vehicleType === 'CAR').length}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'SUV' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('SUV')}
        >
          SUVs
          <span className="pill-count">{vehicles.filter((v) => v.vehicleType === 'SUV').length}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'MOTORCYCLE' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('MOTORCYCLE')}
        >
          Motorcycles
          <span className="pill-count">{vehicles.filter((v) => v.vehicleType === 'MOTORCYCLE').length}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'COMMERCIAL' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('COMMERCIAL')}
        >
          Commercial / Vans
          <span className="pill-count">{vehicles.filter((v) => ['TRUCK', 'VAN', 'BUS'].includes(v.vehicleType)).length}</span>
        </button>
        <button
          type="button"
          className={`service-filter-pill ${typeFilter === 'EV_HYBRID' ? 'is-active' : ''}`}
          onClick={() => setTypeFilter('EV_HYBRID')}
        >
          Electric & Hybrid
          <span className="pill-count">{stats.evHybrid}</span>
        </button>
      </section>

      {/* Toolbar Search */}
      <Toolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search registration plate, make, model, or year..."
        resultCount={filteredVehicles.length}
        resultLabel={filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'}
      />

      {/* Vehicles Main Feed / Grid */}
      {loading ? (
        <LoadingState message="Loading registered vehicles and service history..." />
      ) : filteredVehicles.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title={searchQuery ? 'No vehicles match that search' : 'Your garage is ready for its first vehicle'}
          description={
            searchQuery
              ? 'Try searching with a different registration plate or vehicle model.'
              : isCustomer
              ? 'Add your vehicle to begin booking maintenance appointments and tracking repair history.'
              : 'Registered customer vehicles will appear here.'
          }
          action={
            isCustomer && !searchQuery ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setModal({ vehicle: blankVehicle, editing: false })}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Register vehicle</span>
              </button>
            ) : null
          }
        />
      ) : (
        <div className="service-feed vehicle-card-feed" role="feed" aria-label="Vehicles list">
          {filteredVehicles.map((vehicle) => renderVehicleCard(vehicle))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <VehicleModal
          initial={modal.vehicle}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={(savedVehicle) => {
            setVehicles((prev) =>
              modal.editing
                ? prev.map((item) => (item.id === savedVehicle.id ? savedVehicle : item))
                : [savedVehicle, ...prev]
            )
            setModal(null)
            setSuccessMessage(
              modal.editing
                ? `Vehicle ${savedVehicle.registrationNumber} updated successfully.`
                : `Vehicle ${savedVehicle.registrationNumber} added to garage.`
            )
            setTimeout(() => setSuccessMessage(''), 4000)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingVehicle && (
        <ConfirmDialog
          title="Remove Vehicle"
          description={`Are you sure you want to remove ${deletingVehicle.make} ${deletingVehicle.model} (${deletingVehicle.registrationNumber}) from your garage? This action cannot be undone.`}
          confirmLabel="Remove vehicle"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingVehicle(null)}
        />
      )}
    </div>
  )

  /**
   * Render single Vehicle Card
   */
  function renderVehicleCard(vehicle) {
    const isExpanded = expandedVehicleIds.has(vehicle.id)
    const TypeIcon = getVehicleTypeIcon(vehicle.vehicleType)
    const vServices = vehicleServicesMap.get(vehicle.id) || []
    const vAppointments = vehicleAppointmentsMap.get(vehicle.id) || []
    const activeService = vServices.find((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
    const completedServicesCount = vServices.filter((s) => s.status === 'COMPLETED').length

    return (
      <article
        key={vehicle.id}
        className={`service-workflow-card vehicle-workflow-card ${activeService ? 'has-active-service' : ''}`}
        aria-label={`${vehicle.make} ${vehicle.model} ${vehicle.registrationNumber}`}
      >
        <div className="service-card-main">
          {/* Header Row */}
          <div className="service-header-row">
            <div className="service-identity">
              {/* Vehicle Avatar Icon Block */}
              <div
                className="vehicle-avatar-block"
                onClick={() => toggleExpand(vehicle.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleExpand(vehicle.id)
                  }
                }}
                aria-label={`Toggle details for ${vehicle.make} ${vehicle.model}`}
              >
                <TypeIcon className="vehicle-icon" size={22} aria-hidden="true" />
              </div>

              <div className="service-titles">
                <div className="service-title-wrap">
                  {/* License Plate Pill */}
                  <span className="registration-tag plate-pill">{vehicle.registrationNumber}</span>
                  {/* Vehicle Heading - critical for E2E: "Toyota Corolla" */}
                  <strong className="service-type-title vehicle-heading-text">
                    {vehicle.make} {vehicle.model}
                  </strong>
                  <span className="vehicle-year-chip">{vehicle.year}</span>
                </div>

                <div className="service-vehicle-meta">
                  <span className="spec-meta-chip">
                    <Fuel size={12} aria-hidden="true" />
                    {formatFuelLabel(vehicle.fuelType)}
                  </span>
                  <span className="meta-dot" aria-hidden="true">•</span>
                  <span>{formatVehicleTypeLabel(vehicle.vehicleType)}</span>
                  <span className="meta-dot" aria-hidden="true">•</span>
                  <span>Added {formatDate(vehicle.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Status & Service Indicator Badges */}
            <div className="vehicle-card-status-badges">
              {activeService ? (
                <div className="active-service-pill">
                  <Wrench size={13} className="spin-icon-subtle" aria-hidden="true" />
                  <span>In Service: {formatStatusLabel(activeService.status)}</span>
                </div>
              ) : (
                <div className="garage-ready-pill">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>Ready for road</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="vehicle-quick-metrics-bar">
            <div className="v-metric-col">
              <span className="v-metric-caption">Service visits</span>
              <strong>{vServices.length} {vServices.length === 1 ? 'record' : 'records'}</strong>
            </div>
            <div className="v-metric-col">
              <span className="v-metric-caption">Completed jobs</span>
              <strong className="completed-val">{completedServicesCount} completed</strong>
            </div>
            <div className="v-metric-col">
              <span className="v-metric-caption">Booked appointments</span>
              <strong>{vAppointments.length} scheduled</strong>
            </div>
            <div className="v-metric-col">
              <span className="v-metric-caption">Active status</span>
              <strong className={activeService ? 'in-workshop-val' : 'ready-val'}>
                {activeService ? formatStatusLabel(activeService.status) : 'Standby'}
              </strong>
            </div>
          </div>

          {/* Footer Bar: Actions */}
          <div className="service-footer-bar">
            <div className="vehicle-footer-summary">
              <span className="meta-caption">Service History</span>
              <strong>
                {vServices.length > 0
                  ? `Last serviced ${formatDate(vServices[0].createdAt)}`
                  : 'No service history yet'}
              </strong>
            </div>

            <div className="service-action-buttons">
              {/* Toggle Details Expansion */}
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => toggleExpand(vehicle.id)}
                aria-expanded={isExpanded}
              >
                <FileText size={14} aria-hidden="true" />
                <span>Service history & specs</span>
                {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
              </button>

              {/* Edit Vehicle (Customer only) */}
              {isCustomer && (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => setModal({ vehicle, editing: true })}
                  aria-label={`Edit ${vehicle.registrationNumber}`}
                >
                  <Edit3 size={14} aria-hidden="true" />
                  <span>Edit</span>
                </button>
              )}

              {/* Delete Vehicle (Customer only) */}
              {isCustomer && (
                <button
                  type="button"
                  className="secondary-button danger-button compact-button"
                  onClick={() => setDeletingVehicle(vehicle)}
                  aria-label={`Delete ${vehicle.registrationNumber}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Specifications & Service History Drawer */}
        {isExpanded && (
          <div className="service-expanded-panel vehicle-expanded-panel">
            {/* Technical Specs Card */}
            <div className="service-note-card vehicle-specs-card">
              <strong>Technical Specifications</strong>
              <ul className="service-timeline-list">
                <li><span>Make:</span> <strong>{vehicle.make}</strong></li>
                <li><span>Model:</span> <strong>{vehicle.model}</strong></li>
                <li><span>Model year:</span> <strong>{vehicle.year}</strong></li>
                <li><span>License plate:</span> <code className="plate-pill">{vehicle.registrationNumber}</code></li>
                <li><span>Fuel system:</span> <strong>{formatFuelLabel(vehicle.fuelType)}</strong></li>
                <li><span>Body type:</span> <strong>{formatVehicleTypeLabel(vehicle.vehicleType)}</strong></li>
                <li><span>Registered:</span> {formatDate(vehicle.createdAt)}</li>
              </ul>
            </div>

            {/* Linked Service History Timeline */}
            <div className="service-note-card vehicle-history-card">
              <strong>Service History Timeline</strong>
              {vServices.length === 0 ? (
                <p className="empty-sub">No maintenance or repair jobs recorded for this vehicle yet.</p>
              ) : (
                <ul className="vehicle-service-history-list">
                  {vServices.map((srv) => (
                    <li key={srv.id} className="history-item-row">
                      <div className="history-header">
                        <div className="history-title-wrap">
                          <strong className="history-type">
                            {srv.serviceType ? formatServiceType(srv.serviceType) : 'General service'}
                          </strong>
                          <span className="history-date">{formatDate(srv.createdAt)}</span>
                        </div>
                        <StatusBadge status={srv.status} />
                      </div>
                      <p className="history-desc">{srv.description}</p>
                      <div className="history-meta-row">
                        <span>Priority: <strong>{srv.priority}</strong></span>
                        {srv.actualCost !== null && srv.actualCost !== undefined && (
                          <span>Cost: <strong>{formatMoney(srv.actualCost)}</strong></span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Scheduled Appointments Card */}
            <div className="service-note-card vehicle-appointments-card">
              <strong>Scheduled Visits</strong>
              {vAppointments.length === 0 ? (
                <p className="empty-sub">No upcoming or past appointment bookings found.</p>
              ) : (
                <ul className="vehicle-appointments-list">
                  {vAppointments.map((apt) => (
                    <li key={apt.id} className="apt-item-row">
                      <div className="apt-header">
                        <span className="apt-date">
                          <Calendar size={12} aria-hidden="true" />
                          {apt.appointmentDate} at {apt.appointmentTime}
                        </span>
                        <StatusBadge status={apt.status} />
                      </div>
                      {apt.notes && <p className="apt-notes">{apt.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </article>
    )
  }
}

/**
 * Accessible Create / Edit Vehicle Modal
 */
function VehicleModal({ initial, editing, onClose, onSaved }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    // Basic client validations
    if (!form.registrationNumber.trim()) {
      setError('Registration number is required.')
      setSaving(false)
      return
    }
    if (!form.make.trim()) {
      setError('Vehicle make is required.')
      setSaving(false)
      return
    }
    if (!form.model.trim()) {
      setError('Vehicle model is required.')
      setSaving(false)
      return
    }
    const numericYear = Number(form.year)
    const maxYear = new Date().getFullYear() + 1
    if (!numericYear || numericYear < 1886 || numericYear > maxYear) {
      setError(`Year must be a whole number between 1886 and ${maxYear}.`)
      setSaving(false)
      return
    }

    try {
      const payload = {
        registrationNumber: form.registrationNumber.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: numericYear,
        fuelType: form.fuelType,
        vehicleType: form.vehicleType,
      }

      const response = editing
        ? await updateVehicle(initial.id, payload)
        : await createVehicle(payload)

      onSaved(response.data?.data?.vehicle)
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit vehicle' : 'Add a vehicle'}
      description="Keep vehicle specifications accurate for every service and inspection visit."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <Alert type="danger" message={error} />}

        <div className="field-grid">
          {/* Exact label required for Playwright E2E: "Registration number" */}
          <FormField id="vehicle-reg" label="Registration number" required>
            <input
              id="vehicle-reg"
              value={form.registrationNumber}
              onChange={(event) => update('registrationNumber', event.target.value)}
              placeholder="e.g. MH 02 AB 1234"
              className="form-control"
              required
            />
          </FormField>

          {/* Exact label required for Playwright E2E: "Year" */}
          <FormField id="vehicle-year" label="Year" required>
            <input
              id="vehicle-year"
              type="number"
              value={form.year}
              onChange={(event) => update('year', Number(event.target.value))}
              min="1886"
              max={new Date().getFullYear() + 1}
              className="form-control"
              required
            />
          </FormField>

          {/* Exact label required for Playwright E2E: "Make" */}
          <FormField id="vehicle-make" label="Make" required>
            <input
              id="vehicle-make"
              value={form.make}
              onChange={(event) => update('make', event.target.value)}
              placeholder="e.g. Toyota"
              className="form-control"
              required
            />
          </FormField>

          {/* Exact label required for Playwright E2E: "Model" */}
          <FormField id="vehicle-model" label="Model" required>
            <input
              id="vehicle-model"
              value={form.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="e.g. Corolla"
              className="form-control"
              required
            />
          </FormField>

          {/* Fuel type */}
          <FormField id="vehicle-fuel" label="Fuel type">
            <select
              id="vehicle-fuel"
              value={form.fuelType}
              onChange={(event) => update('fuelType', event.target.value)}
              className="form-control"
            >
              {FUEL_TYPES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Vehicle type */}
          <FormField id="vehicle-type" label="Vehicle type">
            <select
              id="vehicle-type"
              value={form.vehicleType}
              onChange={(event) => update('vehicleType', event.target.value)}
              className="form-control"
            >
              {VEHICLE_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          {/* Exact button text required for E2E: "Add vehicle" (when creating) / "Save changes" (when editing) */}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add vehicle'}
          </button>
        </div>
      </form>
    </Modal>
  )
}