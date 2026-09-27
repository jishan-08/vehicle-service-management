import { useEffect, useState } from 'react'
import {
  Activity,
  CalendarClock,
  CarFront,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { formatMoney, formatShortDate } from '../utils/formatters'
import { getDashboardSummary } from '../services/dashboardService'
import StatCard from '../components/StatCard'

const roleCopy = {
  CUSTOMER: {
    eyebrow: 'Customer workspace',
    title: 'Good to see you.',
    description: 'Your vehicles and service requests, clearly in view.',
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const copy = roleCopy[user.role] || roleCopy.CUSTOMER
  const isCustomer = user.role === 'CUSTOMER'

  useEffect(() => {
    let active = true

    getDashboardSummary()
      .then((response) => {
        if (active) setSummary(response.data.data.summary)
      })
      .catch((requestError) => {
        if (active) setError(getApiMessage(requestError))
      })

    return () => {
      active = false
    }
  }, [])

  const cards = !summary
    ? []
    : isCustomer
    ? [
        {
          label: 'My vehicles',
          value: summary.totalVehicles,
          detail: 'Registered in your garage',
          icon: CarFront,
          tone: 'amber',
        },
        {
          label: 'Active services',
          value: summary.activeServiceRequests,
          detail: 'Requests in progress',
          icon: ClipboardList,
          tone: 'teal',
        },
        {
          label: 'Upcoming appointments',
          value: summary.upcomingAppointments,
          detail: 'Scheduled visits',
          icon: CalendarClock,
          tone: 'slate',
        },
        {
          label: 'Amount due',
          value: formatMoney(summary.totalAmountDue),
          detail: `${summary.pendingBills} pending bill${summary.pendingBills === 1 ? '' : 's'}`,
          icon: FileText,
          tone: 'coral',
        },
      ]
    : user.role === 'STAFF'
    ? [
        {
          label: "Today's appointments",
          value: summary.todaysAppointments,
          detail: 'Scheduled for today',
          icon: CalendarClock,
          tone: 'amber',
        },
        {
          label: 'Pending appointments',
          value: summary.pendingAppointments,
          detail: 'Awaiting operations',
          icon: ClipboardList,
          tone: 'teal',
        },
        {
          label: 'Vehicles in service',
          value: summary.vehiclesCurrentlyInService,
          detail: 'Currently being worked on',
          icon: CarFront,
          tone: 'slate',
        },
        {
          label: 'Completed services',
          value: summary.completedServices,
          detail: `${summary.pendingBills} pending bill${summary.pendingBills === 1 ? '' : 's'}`,
          icon: Activity,
          tone: 'coral',
        },
      ]
    : [
        {
          label: 'Customers',
          value: summary.totalCustomers,
          detail: 'Registered customer accounts',
          icon: UsersRound,
          tone: 'amber',
        },
        {
          label: 'Vehicles',
          value: summary.totalVehicles,
          detail: 'Registered in the system',
          icon: CarFront,
          tone: 'teal',
        },
        {
          label: 'Appointments',
          value: summary.totalAppointments,
          detail: 'All appointment records',
          icon: CalendarClock,
          tone: 'slate',
        },
        {
          label: 'Total revenue',
          value: formatMoney(summary.totalRevenue),
          detail: `${formatMoney(summary.outstandingAmount)} outstanding`,
          icon: FileText,
          tone: 'coral',
        },
      ]

  return (
    <div className="dashboard-page">
      <section className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="date-stamp">
          <span className="status-dot" aria-hidden="true" /> System operational{' '}
          <small>{formatShortDate(new Date())}</small>
        </div>
      </section>

      {error && <div className="alert error-alert" role="alert">{error}</div>}

      {!summary && !error ? (
        <div className="surface loading-state">
          <span className="spinner" aria-hidden="true" /> Loading dashboard summary
        </div>
      ) : (
        <>
          <section className="stat-grid">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="surface activity-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Your command center</span>
                  <h2>{isCustomer ? 'Keep the road open' : 'Operations pulse'}</h2>
                </div>
                <span className="soft-badge">
                  <Activity size={14} aria-hidden="true" /> Live
                </span>
              </div>
              <div className="empty-state compact">
                <div className="empty-icon">
                  <ClipboardCheck size={22} aria-hidden="true" />
                </div>
                <strong>
                  {isCustomer
                    ? 'Your next service update will appear here.'
                    : 'Service activity will appear here as work moves forward.'}
                </strong>
                <span>Connect the team, the vehicle, and the next best action.</span>
              </div>
            </article>

            <article className="surface quick-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">At a glance</span>
                  <h2>{isCustomer ? 'Planned modules' : 'Team focus'}</h2>
                </div>
              </div>

              {isCustomer ? (
                <div className="planned-list">
                  <div>
                    <CalendarClock size={18} aria-hidden="true" />
                    <span>
                      <strong>Appointments</strong>
                      <small>Use the live appointment workspace</small>
                    </span>
                  </div>
                  <div>
                    <FileText size={18} aria-hidden="true" />
                    <span>
                      <strong>Bills & invoices</strong>
                      <small>View your live billing records</small>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="planned-list">
                  <div>
                    <UsersRound size={18} aria-hidden="true" />
                    <span>
                      <strong>Customer records</strong>
                      <small>Ready for service workflows</small>
                    </span>
                  </div>
                  <div>
                    <Clock3 size={18} aria-hidden="true" />
                    <span>
                      <strong>Service queue</strong>
                      <small>Keep jobs progressing</small>
                    </span>
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