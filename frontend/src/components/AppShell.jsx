import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, CalendarClock, CarFront, ClipboardList, LayoutDashboard, LogOut, Menu, ReceiptText, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { label: 'Overview', path: 'dashboard', icon: LayoutDashboard },
  { label: 'Vehicles', path: 'vehicles', icon: CarFront },
  { label: 'Services', path: 'services', icon: ClipboardList },
  { label: 'Appointments', path: 'appointments', icon: CalendarClock },
  { label: 'Bills', path: 'bills', icon: ReceiptText },
  { label: 'Reports', path: 'reports', icon: BarChart3, roles: ['STAFF', 'ADMIN'] },
  { label: 'Profile', path: 'profile', icon: UserRound },
]
const roleLabels = { CUSTOMER: 'Customer', STAFF: 'Service staff', ADMIN: 'Administrator' }

export default function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><span className="brand-emblem">V</span><span><strong>VEHICLE SERVICE</strong><small>management workspace</small></span><button className="icon-button sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="workspace-label">Workspace</div>
      <nav className="side-nav">{navItems.filter((item) => !item.roles || item.roles.includes(user.role)).map(({ label, path, icon: Icon }) => <NavLink key={path} to={`/${user.role.toLowerCase()}${path === 'dashboard' ? '' : `/${path}`}`} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-footer"><div className="support-panel"><span className="eyebrow">Need a hand?</span><strong>Service desk</strong><span>Connect with your operations team.</span></div><button className="logout-link" onClick={handleLogout}><LogOut size={16} /> Sign out</button></div>
    </aside>
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <div className="main-column"><header className="topbar"><button className="icon-button menu-trigger" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="topbar-context"><span className="status-dot" /> Operations live <span className="context-divider">/</span> {roleLabels[user.role]}</div><div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><span /></button><NavLink to={`/${user.role.toLowerCase()}/profile`} className="profile-chip"><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{user.name}</strong><small>{roleLabels[user.role]}</small></span></NavLink></div></header><main className="page-frame"><Outlet /></main></div>
  </div>
}