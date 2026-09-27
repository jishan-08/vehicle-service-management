import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  CalendarClock,
  CarFront,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  UserRound,
  X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { formatInitials } from '../utils/formatters'

const navItems = [
  { label: 'Overview', path: 'dashboard', icon: LayoutDashboard },
  { label: 'Vehicles', path: 'vehicles', icon: CarFront },
  { label: 'Services', path: 'services', icon: ClipboardList },
  { label: 'Appointments', path: 'appointments', icon: CalendarClock },
  { label: 'Bills', path: 'bills', icon: ReceiptText },
  { label: 'Reports', path: 'reports', icon: BarChart3, roles: ['STAFF', 'ADMIN'] },
  { label: 'Profile', path: 'profile', icon: UserRound },
]

const roleLabels = {
  CUSTOMER: 'Customer',
  STAFF: 'Service staff',
  ADMIN: 'Administrator',
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const rolePrefix = user?.role?.toLowerCase() || 'customer'
  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  )

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main Sidebar Navigation">
        <div className="brand-lockup">
          <span className="brand-emblem" aria-hidden="true">V</span>
          <span>
            <strong>VEHICLE SERVICE</strong>
            <small>management workspace</small>
          </span>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="workspace-label">Workspace</div>

        <nav className="side-nav" aria-label="Main Navigation">
          {visibleNavItems.map(({ label, path, icon: Icon }) => {
            const targetUrl = `/${rolePrefix}${path === 'dashboard' ? '' : `/${path}`}`
            return (
              <NavLink
                key={path}
                to={targetUrl}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="support-panel">
            <span className="eyebrow">Need a hand?</span>
            <strong>Service desk</strong>
            <span>Connect with your operations team.</span>
          </div>
          <button type="button" className="logout-link" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop / Scrim */}
      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation backdrop"
        />
      )}

      {/* Main Content Area */}
      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-trigger"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} aria-hidden="true" />
          </button>

          <div className="topbar-context">
            <span className="status-dot" aria-hidden="true" />
            Operations live
            <span className="context-divider">/</span>
            {roleLabels[user?.role] || user?.role}
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={19} aria-hidden="true" />
              <span aria-hidden="true" />
            </button>

            <NavLink
              to={`/${rolePrefix}/profile`}
              className="profile-chip"
            >
              <span className="avatar" aria-hidden="true">
                {formatInitials(user?.name)}
              </span>
              <span className="profile-copy">
                <strong>{user?.name}</strong>
                <small>{roleLabels[user?.role] || user?.role}</small>
              </span>
            </NavLink>
          </div>
        </header>

        <main className="page-frame" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}