import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney } from '../utils/formatters'
import {
  createService,
  listServices,
  updateService as updateServiceRequest,
  updateServiceStatus,
} from '../services/serviceService'
import { listVehicles } from '../services/vehicleService'
import Modal from '../components/Modal'

const serviceTypes = [
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

const nextStatus = {
  REQUESTED: 'APPROVED',
  APPROVED: 'SCHEDULED',
  SCHEDULED: 'VEHICLE_RECEIVED',
  VEHICLE_RECEIVED: 'INSPECTION',
  INSPECTION: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

export default function ServicesPage() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)

  useEffect(() => {
    let active = true
    const requests = [listServices()]
    if (user.role === 'CUSTOMER') requests.push(listVehicles())

    Promise.all(requests)
      .then((responses) => {
        if (active) {
          setServices(responses[0].data.data.services)
          if (responses[1]) setVehicles(responses[1].data.data.vehicles)
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user.role])

  const filtered = services.filter((service) =>
    `${service.serviceType} ${service.description} ${service.status}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  const advance = async (service) => {
    try {
      const response = await updateServiceStatus(service.id, nextStatus[service.status])
      setServices((items) =>
        items.map((item) =>
          item.id === service.id ? response.data.data.service : item
        )
      )
    } catch (requestError) {
      setError(getApiMessage(requestError))
    }
  }

  const updateServiceNotes = async (service) => {
    try {
      const response = await updateServiceRequest(service.id, {
        serviceNotes: 'Reviewed by operations team',
      })
      setServices((items) =>
        items.map((item) =>
          item.id === service.id ? response.data.data.service : item
        )
      )
    } catch (requestError) {
      setError(getApiMessage(requestError))
    }
  }

  const canAdvance = user.role === 'STAFF' || user.role === 'ADMIN'

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Workshop workflow</span>
          <h1>Services</h1>
          <p>See what is moving, what is next, and what needs attention.</p>
        </div>
        {user.role === 'CUSTOMER' && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setModal(true)}
          >
            <Plus size={17} aria-hidden="true" /> Request service
          </button>
        )}
      </section>

      {error && <div className="alert error-alert" role="alert">{error}</div>}

      <section className="toolbar surface">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search service type or status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button type="button" className="filter-button">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>All statuses</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </section>

      <section className="surface table-surface">
        <div className="table-header">
          <div>
            <span className="eyebrow">Service queue</span>
            <h2>{user.role === 'CUSTOMER' ? 'Your requests' : 'All service jobs'}</h2>
          </div>
          <span className="result-count">{services.length} records</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Loading service queue
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ClipboardList size={23} aria-hidden="true" />
            </div>
            <strong>
              {query
                ? 'No services match that search.'
                : 'No service requests yet.'}
            </strong>
            <span>
              {query
                ? 'Try searching for another status or service type.'
                : 'Your service activity will appear here.'}
            </span>
          </div>
        ) : (
          <div className="service-list">
            {filtered.map((service) => (
              <article className="service-row" key={service.id}>
                <div className="service-main">
                  <span
                    className={`service-symbol status-${service.status.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    <ClipboardList size={18} />
                  </span>
                  <div>
                    <div className="service-title">
                      <strong>{service.serviceType.replaceAll('_', ' ')}</strong>
                      <span className={`status-badge status-${service.status.toLowerCase()}`}>
                        {service.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p>{service.description}</p>
                    <small>
                      Created {formatDate(service.createdAt)}{' '}
                      <span aria-hidden="true">•</span> Priority {service.priority}
                    </small>
                  </div>
                </div>

                <div className="service-meta">
                  <strong>
                    {service.estimatedCost !== undefined && service.estimatedCost !== null
                      ? formatMoney(service.estimatedCost)
                      : 'Estimate pending'}
                  </strong>
                  <span>
                    {service.actualCost !== undefined && service.actualCost !== null
                      ? `Final ${formatMoney(service.actualCost)}`
                      : 'Estimated cost'}
                  </span>
                </div>

                <div className="service-actions">
                  {canAdvance && nextStatus[service.status] && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => advance(service)}
                    >
                      Move to {nextStatus[service.status].replaceAll('_', ' ')}{' '}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                  )}
                  {(user.role === 'STAFF' || user.role === 'ADMIN') && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => updateServiceNotes(service)}
                      aria-label="Update service notes"
                    >
                      <CheckCircle2 size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modal && (
        <ServiceModal
          vehicles={vehicles}
          onClose={() => setModal(false)}
          onSaved={(service) => {
            setServices((items) => [service, ...items])
            setModal(false)
          }}
        />
      )}
    </div>
  )
}

function ServiceModal({ vehicles, onClose, onSaved }) {
  const [form, setForm] = useState({
    vehicle: '',
    serviceType: 'GENERAL_SERVICE',
    description: '',
    priority: 'MEDIUM',
    estimatedCost: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const vehicleId = String(form.vehicle || vehicles[0]?.id || '')

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await createService({
        ...form,
        vehicle: vehicleId,
        estimatedCost: form.estimatedCost === '' ? undefined : Number(form.estimatedCost),
      })
      onSaved(response.data.data.service)
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Request a service"
      description="Tell the workshop what your vehicle needs."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <div className="alert error-alert" role="alert">{error}</div>}

        {vehicles.length === 0 ? (
          <div className="empty-state compact">
            <strong>Add a vehicle first.</strong>
            <span>A service request must be connected to one of your vehicles.</span>
          </div>
        ) : (
          <>
            <label>
              Vehicle
              <select
                value={vehicleId}
                onChange={(event) => setForm({ ...form, vehicle: event.target.value })}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNumber} · {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label>
                Service type
                <select
                  value={form.serviceType}
                  onChange={(event) => setForm({ ...form, serviceType: event.target.value })}
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Priority
                <select
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </label>
            </div>

            <label>
              Description
              <textarea
                rows="4"
                placeholder="What should the workshop know?"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
              />
            </label>

            <label>
              Estimated budget <span className="optional-label">Optional</span>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={form.estimatedCost}
                onChange={(event) => setForm({ ...form, estimatedCost: event.target.value })}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
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