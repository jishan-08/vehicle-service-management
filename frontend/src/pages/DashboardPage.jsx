import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CarFront,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  Plus,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatDate, formatMoney, formatShortDate } from '../utils/formatters'
import { formatServiceType, formatStatusLabel, getStatusTone } from '../utils/status'
import { getDashboardSummary } from '../services/dashboardService'
import { listVehicles } from '../services/vehicleService'
import { listServices, updateServiceStatus } from '../services/serviceService'
import { listAppointments, updateAppointmentStatus } from '../services/appointmentService'
import { listBills } from '../services/billService'
import { getRevenueSummary } from '../services/reportService'

import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import Alert from '../components/Alert'

const roleCopy = {
  CUSTOMER: {
    eyebrow: 'Customer workspace',
    title: 'Good to see you.',
    description: 'Your vehicles, active service requests, and visits in real time.',
  },
  STAFF: {
    eyebrow: 'Service operations',
    title: 'Ready for the day.',
    description: 'A focused view of the workshop floor and the work ahead.',
  },
  ADMIN: {
    eyebrow: 'System overview',
    title: 'The operation, at a glance.',
    description: 'Keep the service center moving with a single source of truth.',
  },
}

const SERVICE_STAGES = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
]

const nextServiceStatusMap = {
  REQUESTED: 'APPROVED',
  APPROVED: 'SCHEDULED',
  SCHEDULED: 'VEHICLE_RECEIVED',
  VEHICLE_RECEIVED: 'INSPECTION',
  INSPECTION: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const nextAppointmentStatusMap = {
  REQUESTED: 'CONFIRMED',
  CONFIRMED: 'CHECKED_IN',
  CHECKED_IN: 'IN_SERVICE',
  IN_SERVICE: 'COMPLETED',
}

const resolveVehicle = (vehicleId, vehicleList = []) => {
  if (!vehicleId) return null
  return vehicleList.find((v) => v.id === vehicleId || v._id === vehicleId)
}

const formatVehicleLabel = (vehicleId, vehicleList = []) => {
  const v = resolveVehicle(vehicleId, vehicleList)
  if (v) return `${v.make} ${v.model} (${v.registrationNumber})`
  return 'Registered Vehicle'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [appointments, setAppointments] = useState([])
  const [bills, setBills] = useState([])
  const [revenueData, setRevenueData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const copy = roleCopy[user?.role] || roleCopy.CUSTOMER
  const isCustomer = user?.role === 'CUSTOMER'
  const isStaff = user?.role === 'STAFF'
  const isAdmin = user?.role === 'ADMIN'

  const loadData = async () => {
    let active = true
    try {
      setLoading(true)
      setError('')

      const requests = [getDashboardSummary()]

      if (isCustomer) {
        requests.push(listVehicles(), listServices(), listAppointments(), listBills())
      } else if (isStaff) {
        requests.push(listAppointments(), listServices(), listVehicles())
      } else if (isAdmin) {
        requests.push(listAppointments(), listServices(), listBills(), getRevenueSummary(), listVehicles())
      }

      const results = await Promise.allSettled(requests)

      if (!active) return

      if (results[0].status === 'fulfilled') {
        setSummary(results[0].value.data.data.summary)
      } else {
        setError(getApiMessage(results[0].reason))
      }

      if (isCustomer) {
        if (results[1]?.status === 'fulfilled') setVehicles(results[1].value.data.data.vehicles || [])
        if (results[2]?.status === 'fulfilled') setServices(results[2].value.data.data.services || [])
        if (results[3]?.status === 'fulfilled') setAppointments(results[3].value.data.data.appointments || [])
        if (results[4]?.status === 'fulfilled') setBills(results[4].value.data.data.bills || [])
      } else if (isStaff) {
        if (results[1]?.status === 'fulfilled') setAppointments(results[1].value.data.data.appointments || [])
        if (results[2]?.status === 'fulfilled') setServices(results[2].value.data.data.services || [])
        if (results[3]?.status === 'fulfilled') setVehicles(results[3].value.data.data.vehicles || [])
      } else if (isAdmin) {
        if (results[1]?.status === 'fulfilled') setAppointments(results[1].value.data.data.appointments || [])
        if (results[2]?.status === 'fulfilled') setServices(results[2].value.data.data.services || [])
        if (results[3]?.status === 'fulfilled') setBills(results[3].value.data.data.bills || [])
        if (results[4]?.status === 'fulfilled') setRevenueData(results[4].value.data.data || null)
        if (results[5]?.status === 'fulfilled') setVehicles(results[5].value.data.data.vehicles || [])
      }
    } catch (err) {
      if (active) setError(getApiMessage(err))
    } finally {
      if (active) setLoading(false)
    }

    return () => {
      active = false
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.role])

  // Quick staff status advance on appointment
  const handleAdvanceAppointment = async (appointment) => {
    const next = nextAppointmentStatusMap[appointment.status]
    if (!next) return
    try {
      const res = await updateAppointmentStatus(appointment.id, next)
      setAppointments((items) =>
        items.map((item) => (item.id === appointment.id ? res.data.data.appointment : item))
      )
      loadData()
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  // Quick staff status advance on service
  const handleAdvanceService = async (service) => {
    const next = nextServiceStatusMap[service.status]
    if (!next) return
    try {
      const res = await updateServiceStatus(service.id, next)
      setServices((items) =>
        items.map((item) => (item.id === service.id ? res.data.data.service : item))
      )
      loadData()
    } catch (err) {
      setError(getApiMessage(err))
    }
  }

  return (
    <div className="dashboard-page">
      {/* Header section with role-aware title preserving Playwright selectors */}
      <section className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="date-stamp">
          <span className="status-dot" aria-hidden="true" />
          <span>Operations live</span>
          <small>{formatShortDate(new Date())}</small>
        </div>
      </section>

      {error && <Alert type="error" message={error} />}

      {loading && !summary ? (
        <LoadingState message="Loading dashboard intelligence..." surface />
      ) : (
        <div className="dashboard-layout-stack">
          {/* 1. CUSTOMER DASHBOARD VIEW */}
          {isCustomer && (
            <CustomerDashboardView
              summary={summary}
              vehicles={vehicles}
              services={services}
              appointments={appointments}
              bills={bills}
            />
          )}

          {/* 2. STAFF DASHBOARD VIEW */}
          {isStaff && (
            <StaffDashboardView
              summary={summary}
              appointments={appointments}
              services={services}
              vehicles={vehicles}
              onAdvanceAppointment={handleAdvanceAppointment}
              onAdvanceService={handleAdvanceService}
            />
          )}

          {/* 3. ADMIN DASHBOARD VIEW */}
          {isAdmin && (
            <AdminDashboardView
              summary={summary}
              revenueData={revenueData}
              appointments={appointments}
              services={services}
              bills={bills}
              vehicles={vehicles}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   1. CUSTOMER DASHBOARD VIEW
   ========================================================================= */
function CustomerDashboardView({ summary, vehicles, services, appointments, bills }) {
  const navigate = useNavigate()

  const cards = [
    {
      label: 'My vehicles',
      value: summary?.totalVehicles ?? vehicles.length,
      detail: 'Registered in your garage',
      icon: CarFront,
      tone: 'amber',
    },
    {
      label: 'Active services',
      value:
        summary?.activeServiceRequests ??
        services.filter((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED').length,
      detail: 'Requests in progress',
      icon: ClipboardList,
      tone: 'teal',
    },
    {
      label: 'Upcoming appointments',
      value:
        summary?.upcomingAppointments ??
        appointments.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length,
      detail: 'Scheduled visits',
      icon: CalendarClock,
      tone: 'slate',
    },
    {
      label: 'Amount due',
      value: formatMoney(summary?.totalAmountDue),
      detail: `${summary?.pendingBills ?? bills.filter((b) => b.paymentStatus !== 'PAID').length} pending bill(s)`,
      icon: FileText,
      tone: 'coral',
    },
  ]

  const activeServices = services.filter(
    (s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED'
  )

  const upcomingAppointment = appointments.find(
    (a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
  )

  const recentBills = bills.slice(0, 4)

  return (
    <>
      {/* Top Stat Grid */}
      <section className="stat-grid">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      {/* Main 2-Column Customer Layout */}
      <section className="dashboard-grid-2col">
        {/* Left Column: Active Service Progress & My Vehicles */}
        <div className="dashboard-layout-stack">
          {/* Active Services Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Active Service Progress</h3>
              <Link to="/customer/services" className="header-action">
                View all services <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {activeServices.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No active service requests"
                description="Your vehicles are running smoothly. Need inspection or routine service?"
                action={
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => navigate('/customer/services')}
                  >
                    <Plus size={16} aria-hidden="true" /> Request service
                  </button>
                }
                compact
              />
            ) : (
              <div>
                {activeServices.map((service) => {
                  const currentStageIdx = SERVICE_STAGES.findIndex(
                    (s) => s.key === service.status
                  )
                  const resolvedStageIdx = currentStageIdx >= 0 ? currentStageIdx : 2
                  const vehicleText = formatVehicleLabel(service.vehicle || service.vehicleId, vehicles)

                  return (
                    <div className="active-service-card" key={service.id}>
                      <div className="service-card-top">
                        <div>
                          <h4 className="service-card-title">
                            {formatServiceType(service.serviceType)}
                          </h4>
                          <p className="service-card-desc">
                            {service.description} · <span style={{ color: 'var(--ink-secondary)', fontWeight: 600 }}>{vehicleText}</span>
                          </p>
                        </div>
                        <StatusBadge status={service.status} />
                      </div>

                      {/* Timeline progression track */}
                      <div className="stage-progress-track">
                        {SERVICE_STAGES.map((stage, idx) => {
                          const isDone = idx < resolvedStageIdx
                          const isCurrent = idx === resolvedStageIdx
                          return (
                            <div
                              key={stage.key}
                              className={`stage-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                            >
                              <div className="stage-dot" />
                              <span className="stage-label">{stage.label}</span>
                            </div>
                          )
                        })}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '12px',
                          fontSize: '12px',
                          color: 'var(--muted)',
                        }}
                      >
                        <span>
                          Priority: <strong>{service.priority}</strong>
                        </span>
                        <span>
                          Estimated:{' '}
                          <strong>
                            {service.estimatedCost
                              ? formatMoney(service.estimatedCost)
                              : 'Pending review'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          {/* My Vehicles Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>My Garage</h3>
              <Link to="/customer/vehicles" className="header-action">
                Manage fleet ({vehicles.length}) <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {vehicles.length === 0 ? (
              <EmptyState
                icon={CarFront}
                title="Your garage is ready for its first vehicle"
                description="Add your vehicle to track service history and book appointments."
                action={
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => navigate('/customer/vehicles')}
                  >
                    <Plus size={16} aria-hidden="true" /> Add vehicle
                  </button>
                }
                compact
              />
            ) : (
              <div className="vehicle-mini-grid">
                {vehicles.map((v) => (
                  <div className="vehicle-mini-card" key={v.id}>
                    <CarFront size={20} color="var(--teal)" aria-hidden="true" />
                    <div>
                      <strong>{v.make} {v.model}</strong>
                      <small>{v.registrationNumber} · {v.year}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Right Column: Upcoming Visit & Recent Invoices */}
        <div className="dashboard-layout-stack">
          {/* Next Appointment Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Next Scheduled Visit</h3>
              <Link to="/customer/appointments" className="header-action">
                Appointments <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {upcomingAppointment ? (
              <div className="appointment-spotlight-card">
                <div className="spotlight-header">
                  <span className="spotlight-date-badge">
                    <CalendarClock size={14} aria-hidden="true" />{' '}
                    {upcomingAppointment.appointmentDate}
                  </span>
                  <StatusBadge status={upcomingAppointment.status} />
                </div>
                <div className="spotlight-details">
                  <div className="spotlight-detail-item">
                    <span>Scheduled Time</span>
                    <strong>{upcomingAppointment.appointmentTime}</strong>
                  </div>
                  <div className="spotlight-detail-item">
                    <span>Vehicle</span>
                    <strong>{formatVehicleLabel(upcomingAppointment.vehicleId, vehicles)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming visits scheduled"
                description="Book a slot with our certified technicians whenever you are ready."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate('/customer/appointments')}
                  >
                    <Plus size={15} aria-hidden="true" /> Book appointment
                  </button>
                }
                compact
              />
            )}
          </article>

          {/* Recent Invoices Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Recent Invoices</h3>
              <Link to="/customer/bills" className="header-action">
                All bills <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {recentBills.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No billing statements"
                description="Statements and invoices will be issued upon service completion."
                compact
              />
            ) : (
              <div>
                {recentBills.map((bill) => (
                  <div className="dashboard-list-row" key={bill.id}>
                    <div className="dashboard-list-row-main">
                      <FileText size={16} color="var(--muted)" aria-hidden="true" />
                      <div className="dashboard-list-row-info">
                        <strong>{bill.invoiceNumber}</strong>
                        <small>{formatDate(bill.issuedAt)}</small>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '13px', display: 'block' }}>
                        {formatMoney(bill.totalAmount)}
                      </strong>
                      <StatusBadge
                        status={bill.paymentStatus}
                        label={bill.paymentStatus.replace('_', ' ')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </>
  )
}

/* =========================================================================
   2. STAFF DASHBOARD VIEW (Workshop Operations Floor)
   ========================================================================= */
function StaffDashboardView({
  summary,
  appointments,
  services,
  vehicles,
  onAdvanceAppointment,
  onAdvanceService,
}) {
  const cards = [
    {
      label: "Today's appointments",
      value: summary?.todaysAppointments ?? 0,
      detail: 'Scheduled for today',
      icon: CalendarClock,
      tone: 'amber',
    },
    {
      label: 'Pending appointments',
      value: summary?.pendingAppointments ?? 0,
      detail: 'Awaiting confirmation / arrival',
      icon: ClipboardList,
      tone: 'teal',
    },
    {
      label: 'Vehicles in service',
      value: summary?.vehiclesCurrentlyInService ?? 0,
      detail: 'Active on workshop floor',
      icon: CarFront,
      tone: 'slate',
    },
    {
      label: 'Completed services',
      value: summary?.completedServices ?? 0,
      detail: `${summary?.pendingBills || 0} pending bill(s)`,
      icon: Activity,
      tone: 'coral',
    },
  ]

  const activeServices = services.filter(
    (s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED'
  )

  const activeAppointments = appointments.filter(
    (a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED'
  )

  const workload = summary?.serviceWorkload || {}
  const totalWorkload = Object.values(workload).reduce((a, b) => a + b, 0) || 1

  return (
    <>
      {/* Top Stat Grid */}
      <section className="stat-grid">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      {/* Main 2-Column Staff Operations Layout */}
      <section className="dashboard-grid-2col">
        {/* Left: Active Workshop Jobs Queue */}
        <article className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Workshop Active Queue ({activeServices.length})</h3>
            <Link to="/staff/services" className="header-action">
              Open queue <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {activeServices.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All service jobs are complete"
              description="No active vehicle repairs or maintenance requests currently pending."
              compact
            />
          ) : (
            <div>
              {activeServices.map((service) => {
                const nextStatus = nextServiceStatusMap[service.status]
                const vehicleLabel = formatVehicleLabel(service.vehicle || service.vehicleId, vehicles)
                return (
                  <div className="dashboard-list-row" key={service.id}>
                    <div className="dashboard-list-row-main">
                      <ClipboardList size={18} color="var(--teal)" aria-hidden="true" />
                      <div className="dashboard-list-row-info">
                        <strong>{formatServiceType(service.serviceType)}</strong>
                        <small>{service.description} · {vehicleLabel}</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge status={service.status} />
                      {nextStatus && (
                        <button
                          type="button"
                          className="text-button"
                          style={{ fontSize: '11px', padding: '3px 6px' }}
                          onClick={() => onAdvanceService(service)}
                          aria-label={`Advance ${service.serviceType} to ${nextStatus}`}
                        >
                          {nextStatus.replaceAll('_', ' ')} <ArrowUpRight size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </article>

        {/* Right: Today's Appointments & Workload Distribution */}
        <div className="dashboard-layout-stack">
          {/* Appointments Floor Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Today's Schedule & Arrivals</h3>
              <Link to="/staff/appointments" className="header-action">
                View all <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {activeAppointments.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No appointments scheduled"
                description="Incoming bookings from customers will show up here."
                compact
              />
            ) : (
              <div>
                {activeAppointments.slice(0, 5).map((appointment) => {
                  const nextStatus = nextAppointmentStatusMap[appointment.status]
                  const vehicleLabel = formatVehicleLabel(appointment.vehicleId, vehicles)
                  return (
                    <div className="dashboard-list-row" key={appointment.id}>
                      <div className="dashboard-list-row-main">
                        <Clock3 size={16} color="var(--muted)" aria-hidden="true" />
                        <div className="dashboard-list-row-info">
                          <strong>
                            {appointment.appointmentDate} · {appointment.appointmentTime}
                          </strong>
                          <small>{vehicleLabel}</small>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusBadge status={appointment.status} />
                        {nextStatus && (
                          <button
                            type="button"
                            className="text-button"
                            style={{ fontSize: '11px', padding: '2px 5px' }}
                            onClick={() => onAdvanceAppointment(appointment)}
                          >
                            <Check size={12} aria-hidden="true" /> {nextStatus.replaceAll('_', ' ')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          {/* Stage Workload Distribution Card */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Stage Workload Balance</h3>
              <Link to="/staff/reports" className="header-action">
                Reports <TrendingUp size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="workload-list">
              {['REQUESTED', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS'].map((st) => {
                const count = workload[st] || 0
                const percent = Math.round((count / totalWorkload) * 100)
                const tone = getStatusTone(st)
                return (
                  <div className="workload-item" key={st}>
                    <div className="workload-item-header">
                      <strong>{formatStatusLabel(st)}</strong>
                      <span>
                        {count} jobs ({percent}%)
                      </span>
                    </div>
                    <div className="workload-bar-track">
                      <div
                        className="workload-bar-fill"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: `var(--${tone})`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        </div>
      </section>
    </>
  )
}

/* =========================================================================
   3. ADMIN / SUPER ADMIN DASHBOARD VIEW (Operations & Revenue Intelligence)
   ========================================================================= */
function AdminDashboardView({ summary, revenueData, appointments, services, bills, vehicles }) {
  const cards = [
    {
      label: 'Total revenue',
      value: formatMoney(summary?.totalRevenue || revenueData?.totalRevenue),
      detail: `${formatMoney(summary?.outstandingAmount || revenueData?.outstandingAmount)} outstanding`,
      icon: DollarSign,
      tone: 'amber',
    },
    {
      label: 'Active services',
      value: summary?.activeServices ?? services.filter((s) => s.status !== 'COMPLETED').length,
      detail: `${summary?.completedServices ?? 0} completed lifetime`,
      icon: ClipboardList,
      tone: 'teal',
    },
    {
      label: 'Appointments',
      value: summary?.totalAppointments ?? appointments.length,
      detail: 'Scheduled in system',
      icon: CalendarClock,
      tone: 'slate',
    },
    {
      label: 'Fleet & customers',
      value: summary?.totalVehicles ?? vehicles.length,
      detail: `${summary?.totalCustomers ?? 0} customer accounts`,
      icon: CarFront,
      tone: 'coral',
    },
  ]

  const totalRev = summary?.totalRevenue || revenueData?.totalRevenue || 0
  const paidRev =
    revenueData?.paidRevenue || totalRev - (summary?.outstandingAmount || 0)
  const collectionRate =
    totalRev > 0 ? Math.min(100, Math.round((paidRev / totalRev) * 100)) : 100

  return (
    <>
      {/* Top Stat Grid */}
      <section className="stat-grid">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      {/* Main 2-Column Admin Grid */}
      <section className="dashboard-grid-2col">
        {/* Left: Financial & Collection Health */}
        <div className="dashboard-layout-stack">
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Financial Health & Collections</h3>
              <Link to="/admin/bills" className="header-action">
                Billing register <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>

            <div className="revenue-progress-wrap">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <span>Collection Efficiency</span>
                <strong>{collectionRate}% Realized</strong>
              </div>
              <div className="workload-bar-track" style={{ height: '10px' }}>
                <div
                  className="workload-bar-fill"
                  style={{
                    width: `${collectionRate}%`,
                    backgroundColor: 'var(--green)',
                  }}
                />
              </div>

              <div className="revenue-stats-split">
                <div className="revenue-stat-node">
                  <strong>{formatMoney(totalRev)}</strong>
                  <small>Gross Billed</small>
                </div>
                <div className="revenue-stat-node">
                  <strong style={{ color: 'var(--green-text)' }}>
                    {formatMoney(paidRev)}
                  </strong>
                  <small>Settled</small>
                </div>
                <div className="revenue-stat-node">
                  <strong style={{ color: 'var(--coral-text)' }}>
                    {formatMoney(summary?.outstandingAmount || 0)}
                  </strong>
                  <small>Outstanding</small>
                </div>
              </div>
            </div>
          </article>

          {/* Quick Management Shortcuts */}
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Operations Shortcuts</h3>
            </div>
            <div className="shortcut-grid">
              <Link to="/admin/reports" className="shortcut-chip">
                <TrendingUp size={15} color="var(--teal)" aria-hidden="true" />{' '}
                Intelligence Reports
              </Link>
              <Link to="/admin/bills" className="shortcut-chip">
                <ReceiptText size={15} color="var(--amber)" aria-hidden="true" />{' '}
                Invoices & Bills
              </Link>
              <Link to="/admin/services" className="shortcut-chip">
                <ClipboardList size={15} color="var(--blue)" aria-hidden="true" />{' '}
                Workshop Queue
              </Link>
              <Link to="/admin/appointments" className="shortcut-chip">
                <CalendarClock size={15} color="var(--navy)" aria-hidden="true" /> Master
                Schedule
              </Link>
            </div>
          </article>
        </div>

        {/* Right: Live Operations Queue */}
        <article className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Recent Operations Activity</h3>
            <Link to="/admin/services" className="header-action">
              All jobs <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {services.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No service records found"
              description="Operational jobs across all customers will appear in this unified feed."
              compact
            />
          ) : (
            <div>
              {services.slice(0, 6).map((srv) => {
                const vehicleLabel = formatVehicleLabel(srv.vehicle || srv.vehicleId, vehicles)
                return (
                  <div className="dashboard-list-row" key={srv.id}>
                    <div className="dashboard-list-row-main">
                      <ClipboardList size={16} color="var(--muted)" aria-hidden="true" />
                      <div className="dashboard-list-row-info">
                        <strong>{formatServiceType(srv.serviceType)}</strong>
                        <small>{vehicleLabel} · {srv.priority} priority</small>
                      </div>
                    </div>
                    <StatusBadge status={srv.status} />
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>
    </>
  )
}