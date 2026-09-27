import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Printer,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Wrench,
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

import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import Alert from '../components/Alert'

const initialReports = {
  service: null,
  appointment: null,
  revenue: null,
  vehicle: null,
}

// Helper to format date to YYYY-MM-DD in local time
const formatDateYMD = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Preset date ranges calculation
const getPresetRange = (presetKey) => {
  const now = new Date()
  const today = formatDateYMD(now)

  switch (presetKey) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'week': {
      const dayOfWeek = now.getDay() // 0 is Sunday
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
      const monday = new Date(now)
      monday.setDate(now.getDate() + diffToMonday)
      return { startDate: formatDateYMD(monday), endDate: today }
    }
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: formatDateYMD(firstDay), endDate: today }
    }
    case 'last30': {
      const past30 = new Date(now)
      past30.setDate(now.getDate() - 30)
      return { startDate: formatDateYMD(past30), endDate: today }
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' }
  }
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState(initialReports)
  const [range, setRange] = useState({ startDate: '', endDate: '' })
  const [activePreset, setActivePreset] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isCustomer = user?.role === 'CUSTOMER'
  const isStaff = user?.role === 'STAFF'
  const isAdmin = user?.role === 'ADMIN'

  const roleBadgeLabel = isAdmin
    ? 'Executive System View'
    : isStaff
      ? 'Workshop Operations View'
      : 'Personal Service Ledger'

  const load = async (params = range) => {
    try {
      setLoading(true)
      setError('')
      const [serviceRes, appointmentRes, revenueRes, vehicleRes] = await Promise.all([
        getServiceSummary(params),
        getAppointmentSummary(params),
        getRevenueSummary(params),
        getVehicleSummary(params),
      ])
      setReports({
        service: serviceRes.data.data,
        appointment: appointmentRes.data.data,
        revenue: revenueRes.data.data,
        vehicle: vehicleRes.data.data,
      })
    } catch (requestError) {
      setError(getApiMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ startDate: '', endDate: '' })
  }, [user?.role])

  const handleApplyRange = (e) => {
    e.preventDefault()
    setActivePreset('custom')
    load(range)
  }

  const handleSelectPreset = (presetKey) => {
    const newRange = getPresetRange(presetKey)
    setActivePreset(presetKey)
    setRange(newRange)
    load(newRange)
  }

  const handleReset = () => {
    const empty = { startDate: '', endDate: '' }
    setActivePreset('all')
    setRange(empty)
    load(empty)
  }

  const handlePrint = () => {
    window.print()
  }

  const { service, appointment, revenue, vehicle } = reports

  // Revenue analytics calculations
  const totalRev = revenue?.totalRevenue || 0
  const paidRev = revenue?.paidRevenue || 0
  const outstandingRev = revenue?.outstandingAmount || 0
  const totalInvoices = revenue?.totalInvoices || 0
  const paidInvoices = revenue?.paidInvoices || 0
  const pendingInvoices = revenue?.pendingInvoices || 0

  const collectionRate =
    totalRev > 0 ? Math.min(100, Math.round((paidRev / totalRev) * 100)) : totalInvoices > 0 ? 100 : 0

  // Service stages & total
  const serviceBreakdown = useMemo(() => {
    if (!service) return []
    const items = [
      { key: 'requested', label: 'Requested', count: service.requested || 0, tone: 'amber' },
      { key: 'confirmed', label: 'Confirmed / Scheduled', count: service.confirmed || 0, tone: 'blue' },
      { key: 'checkedIn', label: 'Checked In / Inspection', count: service.checkedIn || 0, tone: 'teal' },
      { key: 'inService', label: 'Active In Service', count: service.inService || 0, tone: 'navy' },
      { key: 'completed', label: 'Completed', count: service.completed || 0, tone: 'green' },
      { key: 'cancelled', label: 'Cancelled', count: service.cancelled || 0, tone: 'coral' },
    ]
    const totalCount = items.reduce((sum, item) => sum + item.count, 0)
    return items.map((item) => ({
      ...item,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0,
    }))
  }, [service])

  const totalServicesCount = useMemo(() => {
    return serviceBreakdown.reduce((sum, item) => sum + item.count, 0)
  }, [serviceBreakdown])

  // Appointment metrics
  const totalAppointments = appointment?.total || 0
  const upcomingAppointments = appointment?.upcoming || 0
  const completedAppointments = appointment?.completed || 0
  const cancelledAppointments = appointment?.cancelled || 0

  const appointmentDates = useMemo(() => {
    if (!appointment?.byDate) return []
    return Object.entries(appointment.byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [appointment])

  // Check if any records exist in the active range
  const hasAnyData =
    totalRev > 0 ||
    totalInvoices > 0 ||
    totalServicesCount > 0 ||
    totalAppointments > 0 ||
    (vehicle?.totalRegisteredVehicles || 0) > 0

  return (
    <div className="content-page reports-page">
      {/* Top Page Header */}
      <PageHeader
        eyebrow="Operational intelligence"
        title="Reports"
        description="Comprehensive analysis of service workflow, workshop throughput, appointment demand, and financials."
      >
        <div className="report-header-actions">
          <span className="soft-badge">
            <BarChart3 size={14} aria-hidden="true" /> {roleBadgeLabel}
          </span>
          <button
            type="button"
            className="secondary-button print-report-btn no-print"
            onClick={handlePrint}
            aria-label="Print report"
          >
            <Printer size={15} aria-hidden="true" />
            <span>Print report</span>
          </button>
        </div>
      </PageHeader>

      {/* Date Filter Toolbar & Preset Chips */}
      <section className="surface report-filter-container no-print" aria-label="Report Date Filtering">
        <div className="filter-presets-bar">
          <span className="filter-presets-label">Date presets:</span>
          <div className="preset-chip-group" role="group" aria-label="Date Range Presets">
            <button
              type="button"
              className={`filter-preset-chip ${activePreset === 'all' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('all')}
            >
              All time
            </button>
            <button
              type="button"
              className={`filter-preset-chip ${activePreset === 'today' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`filter-preset-chip ${activePreset === 'week' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('week')}
            >
              This week
            </button>
            <button
              type="button"
              className={`filter-preset-chip ${activePreset === 'month' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('month')}
            >
              This month
            </button>
            <button
              type="button"
              className={`filter-preset-chip ${activePreset === 'last30' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('last30')}
            >
              Last 30 days
            </button>
          </div>
        </div>

        <form className="toolbar report-filter-form" onSubmit={handleApplyRange}>
          <div className="report-date-inputs">
            <div className="date-field">
              <label htmlFor="report-start-date">From</label>
              <input
                id="report-start-date"
                type="date"
                value={range.startDate}
                onChange={(e) => {
                  setRange({ ...range, startDate: e.target.value })
                  setActivePreset('custom')
                }}
              />
            </div>
            <div className="date-field">
              <label htmlFor="report-end-date">To</label>
              <input
                id="report-end-date"
                type="date"
                value={range.endDate}
                onChange={(e) => {
                  setRange({ ...range, endDate: e.target.value })
                  setActivePreset('custom')
                }}
              />
            </div>
          </div>

          <div className="report-filter-buttons">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Applying...' : 'Apply range'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleReset}
              disabled={loading && !range.startDate && !range.endDate}
            >
              <RefreshCw size={14} aria-hidden="true" /> Reset
            </button>
          </div>
        </form>

        {(range.startDate || range.endDate) && (
          <div className="active-filter-indicator">
            <Calendar size={13} aria-hidden="true" />
            <span>
              Showing data from{' '}
              <strong>{range.startDate || 'beginning of records'}</strong> to{' '}
              <strong>{range.endDate || 'latest'}</strong>
            </span>
          </div>
        )}
      </section>

      {/* Error Alert */}
      {error && <Alert type="error" message={error} />}

      {/* Loading State */}
      {loading && !service ? (
        <LoadingState message="Calculating report analytics..." surface />
      ) : !hasAnyData && (range.startDate || range.endDate) ? (
        <EmptyState
          icon={CalendarDays}
          title="No records found in selected date range"
          description="There were no services, appointments, or invoices recorded between the selected dates. Try expanding your date range or resetting to all-time data."
          action={
            <button type="button" className="primary-button" onClick={handleReset}>
              <RefreshCw size={15} aria-hidden="true" /> Reset date filter
            </button>
          }
        />
      ) : (
        <>
          {/* Top KPI Stat Grid */}
          <section className="stat-grid report-stat-grid" aria-label="Key Performance Indicators">
            <StatCard
              label={isCustomer ? 'Total billed' : 'Total revenue'}
              value={formatMoney(totalRev)}
              detail={`${totalInvoices} invoice(s) · ${paidInvoices} settled`}
              icon={DollarSign}
              tone="amber"
            />
            <StatCard
              label={isCustomer ? 'My balance due' : 'Outstanding receivables'}
              value={formatMoney(outstandingRev)}
              detail={`${pendingInvoices} invoice(s) pending payment`}
              icon={ReceiptText}
              tone="coral"
            />
            <StatCard
              label="Appointments"
              value={totalAppointments}
              detail={`${upcomingAppointments} upcoming · ${completedAppointments} completed`}
              icon={CalendarDays}
              tone="teal"
            />
            <StatCard
              label={isCustomer ? 'Registered vehicles' : 'Fleet in garage'}
              value={vehicle?.totalRegisteredVehicles || 0}
              detail={`${vehicle?.vehiclesCurrentlyUnderService || 0} currently under service`}
              icon={CarFront}
              tone="slate"
            />
          </section>

          {/* Detailed Analytics Panels Grid */}
          <section className="analytics-grid" aria-label="Detailed Analytics Sections">
            {/* 1. Revenue & Financial Settlement Analytics */}
            <article className="surface analytics-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>
                    <DollarSign size={18} color="var(--amber)" aria-hidden="true" /> Revenue & Financial Settlement
                  </h2>
                  <p>Invoiced revenue realization and outstanding receivable balance.</p>
                </div>
                <span className="panel-badge tone-amber">{collectionRate}% Realized</span>
              </div>

              {totalInvoices === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No financial statements in this period"
                  description="Invoices and billing summaries will populate once services are billed."
                  compact
                />
              ) : (
                <div className="analytics-content-stack">
                  {/* Visual Realization Meter */}
                  <div className="meter-card">
                    <div className="meter-header">
                      <span>Collection Efficiency</span>
                      <strong>
                        {formatMoney(paidRev)} of {formatMoney(totalRev)}
                      </strong>
                    </div>
                    <div className="meter-track" role="progressbar" aria-valuenow={collectionRate} aria-valuemin="0" aria-valuemax="100" aria-label="Collection Efficiency">
                      <div
                        className="meter-fill fill-green"
                        style={{ width: `${collectionRate}%` }}
                      />
                    </div>
                    <div className="meter-legend">
                      <span>
                        <span className="legend-dot dot-green" /> Settled: {collectionRate}%
                      </span>
                      <span>
                        <span className="legend-dot dot-coral" /> Outstanding: {100 - collectionRate}%
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="metric-breakdown-list">
                    <div className="metric-row">
                      <span className="metric-title">Gross Invoiced Revenue</span>
                      <strong className="metric-value">{formatMoney(totalRev)}</strong>
                    </div>
                    <div className="metric-row">
                      <span className="metric-title">Paid / Settled Revenue</span>
                      <strong className="metric-value" style={{ color: 'var(--green-text)' }}>
                        {formatMoney(paidRev)}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="metric-title">Outstanding Receivables</span>
                      <strong className="metric-value" style={{ color: 'var(--coral-text)' }}>
                        {formatMoney(outstandingRev)}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="metric-title">Settled Invoices</span>
                      <strong className="metric-value">
                        {paidInvoices} / {totalInvoices}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="metric-title">Pending / Partial Invoices</span>
                      <strong className="metric-value">{pendingInvoices}</strong>
                    </div>
                  </div>
                </div>
              )}
            </article>

            {/* 2. Service Workflow & Pipeline Distribution */}
            <article className="surface analytics-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>
                    <Wrench size={18} color="var(--teal)" aria-hidden="true" /> Service Workflow & Stage Distribution
                  </h2>
                  <p>Throughput breakdown across the workshop lifecycle.</p>
                </div>
                <span className="panel-badge tone-teal">{totalServicesCount} Total Services</span>
              </div>

              {totalServicesCount === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No service records in this range"
                  description="Service requests created during this period will be graphed here."
                  compact
                />
              ) : (
                <div className="analytics-content-stack">
                  {/* Proportional Segmented Pipeline Bar */}
                  <div className="pipeline-bar-wrapper">
                    <div className="pipeline-bar-track" aria-label="Service status distribution">
                      {serviceBreakdown
                        .filter((item) => item.count > 0)
                        .map((item) => (
                          <div
                            key={item.key}
                            className={`pipeline-bar-segment segment-${item.tone}`}
                            style={{ width: `${Math.max(item.percentage, 4)}%` }}
                            title={`${item.label}: ${item.count} (${item.percentage}%)`}
                          />
                        ))}
                    </div>
                  </div>

                  {/* Stage Distribution Rows */}
                  <div className="stage-distribution-list">
                    {serviceBreakdown.map((item) => (
                      <div className="stage-dist-row" key={item.key}>
                        <div className="stage-dist-label">
                          <span className={`stage-dist-indicator dot-${item.tone}`} />
                          <span>{item.label}</span>
                        </div>
                        <div className="stage-dist-bar-box">
                          <div
                            className={`stage-dist-bar fill-${item.tone}`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <div className="stage-dist-stat">
                          <strong>{item.count}</strong>
                          <small>({item.percentage}%)</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* 3. Appointment Demand & Scheduling Breakdown */}
            <article className="surface analytics-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>
                    <CalendarDays size={18} color="var(--navy)" aria-hidden="true" /> Appointment Demand & Status Mix
                  </h2>
                  <p>Customer scheduling volume, upcoming visits, and completions.</p>
                </div>
                <span className="panel-badge tone-slate">{totalAppointments} Total Visits</span>
              </div>

              {totalAppointments === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No appointments scheduled in this range"
                  description="Bookings for vehicle inspections and maintenance will display here."
                  compact
                />
              ) : (
                <div className="analytics-content-stack">
                  {/* Appointment Mix Visual Summary Cards */}
                  <div className="appointment-mix-grid">
                    <div className="mix-card tone-teal">
                      <Clock size={16} aria-hidden="true" />
                      <div>
                        <strong>{upcomingAppointments}</strong>
                        <span>Upcoming</span>
                      </div>
                    </div>
                    <div className="mix-card tone-green">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <div>
                        <strong>{completedAppointments}</strong>
                        <span>Completed</span>
                      </div>
                    </div>
                    <div className="mix-card tone-coral">
                      <TrendingUp size={16} aria-hidden="true" />
                      <div>
                        <strong>{cancelledAppointments}</strong>
                        <span>Cancelled</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Distribution Chart if date data exists */}
                  {appointmentDates.length > 0 && (
                    <div className="daily-trend-section">
                      <span className="daily-trend-title">Daily Booking Volume</span>
                      <div className="daily-trend-bar-chart">
                        {appointmentDates.map(({ date, count }) => {
                          const maxCount = Math.max(...appointmentDates.map((d) => d.count), 1)
                          const heightPercent = Math.max(15, Math.round((count / maxCount) * 100))
                          return (
                            <div className="daily-bar-col" key={date} title={`${date}: ${count} appointment(s)`}>
                              <div className="daily-bar-value">{count}</div>
                              <div className="daily-bar-track">
                                <div
                                  className="daily-bar-fill"
                                  style={{ height: `${heightPercent}%` }}
                                />
                              </div>
                              <span className="daily-bar-label">{date.slice(5)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Appointment Status Detail Rows */}
                  <div className="metric-breakdown-list">
                    {appointment?.byStatus &&
                      Object.entries(appointment.byStatus).map(([statusKey, count]) => (
                        <div className="metric-row" key={statusKey}>
                          <span className="metric-title">{statusKey.replaceAll('_', ' ')}</span>
                          <strong className="metric-value">{count}</strong>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </article>

            {/* 4. Fleet & Workshop Utilization */}
            <article className="surface analytics-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>
                    <CarFront size={18} color="var(--slate)" aria-hidden="true" /> Fleet & Workshop Utilization
                  </h2>
                  <p>Registered customer vehicles and workshop throughput history.</p>
                </div>
                <span className="panel-badge tone-navy">
                  {vehicle?.totalRegisteredVehicles || 0} Registered
                </span>
              </div>

              {(vehicle?.totalRegisteredVehicles || 0) === 0 ? (
                <EmptyState
                  icon={CarFront}
                  title="No registered vehicles found"
                  description="Vehicle registrations and maintenance history will appear here."
                  compact
                />
              ) : (
                <div className="analytics-content-stack">
                  <div className="fleet-stat-triad">
                    <div className="fleet-stat-box">
                      <span className="fleet-stat-num">{vehicle?.totalRegisteredVehicles || 0}</span>
                      <span className="fleet-stat-title">Total Vehicles</span>
                      <small>In database registry</small>
                    </div>
                    <div className="fleet-stat-box highlight-box">
                      <span className="fleet-stat-num text-teal">
                        {vehicle?.vehiclesCurrentlyUnderService || 0}
                      </span>
                      <span className="fleet-stat-title">Currently Under Service</span>
                      <small>Active in bays</small>
                    </div>
                    <div className="fleet-stat-box">
                      <span className="fleet-stat-num text-green">
                        {vehicle?.vehiclesWithCompletedServiceHistory || 0}
                      </span>
                      <span className="fleet-stat-title">Service History</span>
                      <small>Completed visits</small>
                    </div>
                  </div>

                  <div className="metric-breakdown-list">
                    <div className="metric-row">
                      <span className="metric-title">Active Floor Utilization</span>
                      <strong className="metric-value">
                        {vehicle?.totalRegisteredVehicles > 0
                          ? `${Math.round(
                              ((vehicle?.vehiclesCurrentlyUnderService || 0) /
                                vehicle.totalRegisteredVehicles) *
                                100
                            )}% of fleet`
                          : '0%'}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span className="metric-title">Vehicles with Lifetime Completed Care</span>
                      <strong className="metric-value">
                        {vehicle?.vehiclesWithCompletedServiceHistory || 0}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  )
}