import { useEffect, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Clock3, Plus, Search, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
} from '../services/appointmentService'
import { listServices } from '../services/serviceService'
import { listVehicles } from '../services/vehicleService'
import Modal from '../components/Modal'

const statuses = {
  REQUESTED: 'CONFIRMED',
  CONFIRMED: 'CHECKED_IN',
  CHECKED_IN: 'IN_SERVICE',
  IN_SERVICE: 'COMPLETED',
}

const statusClass = (status) => `status-badge status-${status.toLowerCase()}`

export default function AppointmentsPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const canAdvance = user.role === 'STAFF' || user.role === 'ADMIN'

  useEffect(() => {
    let active = true

    Promise.all([listAppointments(), listVehicles(), listServices()])
      .then(([appointmentResponse, vehicleResponse, serviceResponse]) => {
        if (active) {
          setAppointments(appointmentResponse.data.data.appointments)
          setVehicles(vehicleResponse.data.data.vehicles)
          setServices(serviceResponse.data.data.services)
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
  }, [])

  const filtered = appointments.filter((appointment) =>
    `${appointment.appointmentDate} ${appointment.appointmentTime} ${appointment.status} ${appointment.vehicleId} ${appointment.serviceId}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )

  const advance = async (appointment) => {
    try {
      const response = await updateAppointmentStatus(
        appointment.id,
        statuses[appointment.status]
      )
      setAppointments((items) =>
        items.map((item) =>
          item.id === appointment.id ? response.data.data.appointment : item
        )
      )
    } catch (requestError) {
      setError(getApiMessage(requestError))
    }
  }

  const cancel = async (appointment) => {
    try {
      const response = await updateAppointmentStatus(appointment.id, 'CANCELLED')
      setAppointments((items) =>
        items.map((item) =>
          item.id === appointment.id ? response.data.data.appointment : item
        )
      )
    } catch (requestError) {
      setError(getApiMessage(requestError))
    }
  }

  const vehicleName = (id) => {
    const vehicle = vehicles.find((item) => item.id === id)
    return vehicle
      ? `${vehicle.registrationNumber} · ${vehicle.make} ${vehicle.model}`
      : id
  }

  const serviceName = (id) => {
    const service = services.find((item) => item.id === id)
    return service ? service.serviceType.replaceAll('_', ' ') : id
  }

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Schedule control</span>
          <h1>Appointments</h1>
          <p>Plan visits and keep the service center in sync.</p>
        </div>
        {(user.role === 'CUSTOMER' || user.role === 'ADMIN') && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} aria-hidden="true" /> New appointment
          </button>
        )}
      </section>

      {error && <div className="alert error-alert" role="alert">{error}</div>}

      <section className="toolbar surface">
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search date, status, vehicle or service"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="result-count">{appointments.length} appointments</span>
      </section>

      <section className="surface table-surface">
        <div className="table-header">
          <div>
            <span className="eyebrow">Appointment register</span>
            <h2>{user.role === 'CUSTOMER' ? 'Your appointments' : 'All appointments'}</h2>
          </div>
          <CalendarClock size={21} color="#8b9a9d" aria-hidden="true" />
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" /> Loading appointments
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <CalendarClock size={23} aria-hidden="true" />
            </div>
            <strong>
              {query ? 'No appointments match that search.' : 'No appointments yet.'}
            </strong>
            <span>
              {user.role === 'CUSTOMER'
                ? 'Book a visit when your vehicle needs attention.'
                : 'Appointments will appear as customers book service.'}
            </span>
          </div>
        ) : (
          <div className="appointment-list">
            {filtered.map((appointment) => {
              const isSelected = selected?.id === appointment.id
              return (
                <article
                  className={`appointment-row ${isSelected ? 'appointment-selected' : ''}`}
                  key={appointment.id}
                >
                  <button
                    type="button"
                    className="appointment-summary"
                    onClick={() => setSelected(isSelected ? null : appointment)}
                    aria-expanded={isSelected}
                  >
                    <span className="appointment-icon" aria-hidden="true">
                      <Clock3 size={18} />
                    </span>
                    <span className="appointment-time">
                      <strong>{appointment.appointmentDate}</strong>
                      <small>{appointment.appointmentTime}</small>
                    </span>
                    <span className="appointment-entity">
                      <strong>{vehicleName(appointment.vehicleId)}</strong>
                      <small>{serviceName(appointment.serviceId)}</small>
                    </span>
                    <span className={statusClass(appointment.status)}>
                      {appointment.status.replaceAll('_', ' ')}
                    </span>
                    <ChevronDown
                      size={17}
                      className={isSelected ? 'rotate-chevron' : ''}
                      aria-hidden="true"
                    />
                  </button>

                  {isSelected && (
                    <div className="appointment-details">
                      <div>
                        <span className="detail-label">Customer</span>
                        <strong>{appointment.customerId}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Vehicle</span>
                        <strong>{vehicleName(appointment.vehicleId)}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Service</span>
                        <strong>{serviceName(appointment.serviceId)}</strong>
                      </div>
                      <div>
                        <span className="detail-label">Assigned staff</span>
                        <strong>{appointment.assignedStaffId || 'Not assigned'}</strong>
                      </div>

                      <div className="appointment-actions">
                        {canAdvance && statuses[appointment.status] && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => advance(appointment)}
                          >
                            <Check size={15} aria-hidden="true" /> Move to{' '}
                            {statuses[appointment.status].replaceAll('_', ' ')}
                          </button>
                        )}
                        {user.role === 'CUSTOMER' &&
                          ['REQUESTED', 'CONFIRMED'].includes(appointment.status) && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => cancel(appointment)}
                            >
                              <X size={15} aria-hidden="true" /> Cancel appointment
                            </button>
                          )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {createOpen && (
        <AppointmentModal
          vehicles={vehicles}
          services={services}
          onClose={() => setCreateOpen(false)}
          onSaved={(appointment) => {
            setAppointments((items) => [appointment, ...items])
            setCreateOpen(false)
          }}
        />
      )}
    </div>
  )
}

function AppointmentModal({ vehicles, services, onClose, onSaved }) {
  const [form, setForm] = useState({
    vehicle: '',
    service: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const vehicleId = String(form.vehicle || vehicles[0]?.id || '')
  const availableServices = services.filter((service) => service.vehicleId === vehicleId)
  const defaultService = String(form.service || availableServices[0]?.id || '')

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await createAppointment({
        ...form,
        vehicle: vehicleId,
        service: defaultService,
      })
      onSaved(response.data.data.appointment)
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Book an appointment"
      description="The backend validates ownership, service linkage, and schedule conflicts."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {error && <div className="alert error-alert" role="alert">{error}</div>}

        <label>
          Vehicle
          <select
            required
            value={vehicleId}
            onChange={(event) =>
              setForm({ ...form, vehicle: event.target.value, service: '' })
            }
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber} · {vehicle.make} {vehicle.model}
              </option>
            ))}
          </select>
        </label>

        <label>
          Service
          <select
            required
            value={defaultService}
            onChange={(event) => setForm({ ...form, service: event.target.value })}
          >
            <option value="">Select a service</option>
            {availableServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.serviceType.replaceAll('_', ' ')} · {service.status}
              </option>
            ))}
          </select>
        </label>

        <div className="field-grid">
          <label>
            Date
            <input
              required
              type="date"
              value={form.appointmentDate}
              onChange={(event) =>
                setForm({ ...form, appointmentDate: event.target.value })
              }
            />
          </label>
          <label>
            Time
            <input
              required
              type="time"
              value={form.appointmentTime}
              onChange={(event) =>
                setForm({ ...form, appointmentTime: event.target.value })
              }
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            rows="3"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Anything the service team should know?"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={saving || !defaultService}
          >
            {saving ? 'Booking...' : 'Book appointment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}