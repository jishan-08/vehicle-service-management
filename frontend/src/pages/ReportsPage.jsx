import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CarFront,
  ClipboardList,
  DollarSign,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatMoney } from '../utils/formatters'
import {
  getAppointmentSummary,
  getRevenueSummary,
  getServiceSummary,
  getVehicleSummary,
} from '../services/reportService'
import StatCard from '../components/StatCard'

const initialReports = {
  service: null,
  appointment: null,
  revenue: null,
  vehicle: null,
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState(initialReports)
  const [range, setRange] = useState({ startDate: '', endDate: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (params = range) => {
    try {
      setLoading(true)
      setError('')
      const [service, appointment, revenue, vehicle] = await Promise.all([
        getServiceSummary(params),
        getAppointmentSummary(params),
        getRevenueSummary(params),
        getVehicleSummary(params),
      ])
      setReports({
        service: service.data.data,
        appointment: appointment.data.data,
        revenue: revenue.data.data,
        vehicle: vehicle.data.data,
      })
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    Promise.all([
      getServiceSummary(),
      getAppointmentSummary(),
      getRevenueSummary(),
      getVehicleSummary(),
    ])
      .then(([service, appointment, revenue, vehicle]) => {
        if (active) {
          setReports({
            service: service.data.data,
            appointment: appointment.data.data,
            revenue: revenue.data.data,
            vehicle: vehicle.data.data,
          })
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

  const submit = (event) => {
    event.preventDefault()
    load(range)
  }

  const reset = () => {
    const empty = { startDate: '', endDate: '' }
    setRange(empty)
    load(empty)
  }

  const { service, appointment, revenue, vehicle } = reports

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Operational intelligence</span>
          <h1>Reports</h1>
          <p>Actual service, appointment, revenue, and vehicle performance.</p>
        </div>
        <span className="soft-badge">
          <BarChart3 size={14} aria-hidden="true" />{' '}
          {user.role === 'ADMIN' ? 'System view' : 'Operations view'}
        </span>
      </section>

      <form className="toolbar surface report-filter" onSubmit={submit}>
        <CalendarDays size={17} color="#93a1a5" aria-hidden="true" />
        <label>
          From
          <input
            type="date"
            value={range.startDate}
            onChange={(event) =>
              setRange({ ...range, startDate: event.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={range.endDate}
            onChange={(event) =>
              setRange({ ...range, endDate: event.target.value })
            }
          />
        </label>
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Loading...' : 'Apply range'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={reset}
        >
          <RefreshCw size={15} aria-hidden="true" /> Reset
        </button>
      </form>

      {error && <div className="alert error-alert" role="alert">{error}</div>}

      {loading && !service ? (
        <div className="surface loading-state">
          <span className="spinner" aria-hidden="true" /> Loading reports
        </div>
      ) : (
        <>
          <section className="stat-grid">
            <StatCard
              label="Total revenue"
              value={formatMoney(revenue?.totalRevenue)}
              detail={`${revenue?.totalInvoices || 0} non-cancelled invoices`}
              icon={DollarSign}
              tone="amber"
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(revenue?.outstandingAmount)}
              detail={`${revenue?.pendingInvoices || 0} pending invoices`}
              icon={ClipboardList}
              tone="coral"
            />
            <StatCard
              label="Appointments"
              value={appointment?.total || 0}
              detail={`${appointment?.upcoming || 0} upcoming`}
              icon={CalendarDays}
              tone="teal"
            />
            <StatCard
              label="Registered vehicles"
              value={vehicle?.totalRegisteredVehicles || 0}
              detail={`${vehicle?.vehiclesCurrentlyUnderService || 0} currently under service`}
              icon={CarFront}
              tone="slate"
            />
          </section>

          <section className="report-grid">
            <ReportPanel
              title="Service status"
              icon={ClipboardList}
              rows={
                service
                  ? [
                      ['Requested', service.requested],
                      ['Confirmed / scheduled', service.confirmed],
                      ['Checked in / inspection', service.checkedIn],
                      ['In service', service.inService],
                      ['Completed', service.completed],
                      ['Cancelled', service.cancelled],
                    ]
                  : []
              }
            />

            <ReportPanel
              title="Appointment status"
              icon={CalendarDays}
              rows={
                appointment
                  ? Object.entries(appointment.byStatus).map(([key, value]) => [
                      key.replaceAll('_', ' '),
                      value,
                    ])
                  : []
              }
            />

            <ReportPanel
              title="Revenue detail"
              icon={DollarSign}
              rows={
                revenue
                  ? [
                      ['Total revenue', formatMoney(revenue.totalRevenue)],
                      ['Paid revenue', formatMoney(revenue.paidRevenue)],
                      ['Outstanding', formatMoney(revenue.outstandingAmount)],
                      ['Paid invoices', revenue.paidInvoices],
                      ['Pending invoices', revenue.pendingInvoices],
                    ]
                  : []
              }
            />

            <ReportPanel
              title="Vehicle history"
              icon={CarFront}
              rows={
                vehicle
                  ? [
                      ['Registered vehicles', vehicle.totalRegisteredVehicles],
                      ['Currently under service', vehicle.vehiclesCurrentlyUnderService],
                      [
                        'Completed service history',
                        vehicle.vehiclesWithCompletedServiceHistory,
                      ],
                    ]
                  : []
              }
            />
          </section>
        </>
      )}
    </div>
  )
}

function ReportPanel({ title, icon: Icon, rows }) {
  return (
    <article className="surface report-panel">
      <div className="section-heading">
        <h2>
          {Icon && <Icon size={17} aria-hidden="true" />} {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state compact">
          <strong>No records in this range.</strong>
          <span>Try a wider date range.</span>
        </div>
      ) : (
        <div className="report-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}