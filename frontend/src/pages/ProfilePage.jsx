import {
  Calendar,
  CarFront,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  Mail,
  ReceiptText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatDate, formatInitials } from '../utils/formatters'
import { roleHome } from '../utils/navigation'
import PageHeader from '../components/PageHeader'

const roleDetails = {
  CUSTOMER: {
    label: 'Customer',
    badgeClass: 'tone-amber',
    description: 'Personal garage access with online service booking and invoice tracking.',
    capabilities: [
      'Register and manage personal vehicle fleet',
      'Request maintenance and diagnostic service jobs',
      'Schedule appointments with certified technicians',
      'Review billing statements and payment records',
    ],
    links: [
      { label: 'My Vehicles', path: '/customer/vehicles', icon: CarFront },
      { label: 'Service Requests', path: '/customer/services', icon: Wrench },
      { label: 'Appointments', path: '/customer/appointments', icon: Clock },
      { label: 'Billing & Invoices', path: '/customer/bills', icon: ReceiptText },
    ],
  },
  STAFF: {
    label: 'Service Staff',
    badgeClass: 'tone-teal',
    description: 'Workshop floor technician with queue management and scheduling privileges.',
    capabilities: [
      'Manage real-time workshop active queue',
      'Advance vehicle service lifecycle stages',
      'Review daily appointment arrivals and time slots',
      'Inspect operational performance reports',
    ],
    links: [
      { label: 'Workshop Queue', path: '/staff/services', icon: Wrench },
      { label: 'Floor Schedule', path: '/staff/appointments', icon: Clock },
      { label: 'Service Reports', path: '/staff/reports', icon: ShieldCheck },
    ],
  },
  ADMIN: {
    label: 'Administrator',
    badgeClass: 'tone-navy',
    description: 'Executive management with full operational, billing, and system intelligence access.',
    capabilities: [
      'Full visibility into all vehicle registrations and service jobs',
      'Manage invoices, billing items, and revenue settlement',
      'Generate comprehensive financial and operational reports',
      'Oversee workshop throughput and master scheduling',
    ],
    links: [
      { label: 'System Overview', path: '/admin', icon: Shield },
      { label: 'Intelligence Reports', path: '/admin/reports', icon: ShieldCheck },
      { label: 'Billing Register', path: '/admin/bills', icon: ReceiptText },
      { label: 'Master Schedule', path: '/admin/appointments', icon: Clock },
    ],
  },
}

export default function ProfilePage() {
  const { user } = useAuth()
  const roleConfig = roleDetails[user?.role] || roleDetails.CUSTOMER
  const homePath = roleHome(user?.role)

  return (
    <div className="content-page profile-page">
      <PageHeader
        eyebrow="Account settings"
        title="Profile"
        description="Your personal credentials, workspace role, and security access permissions."
      />

      <section className="profile-layout-grid" aria-label="Profile Details">
        {/* Left Column: User Card & Credentials */}
        <div className="profile-main-col">
          <article className="surface profile-card">
            <div className="profile-hero-section">
              <div className="profile-avatar-large" aria-hidden="true">
                {formatInitials(user?.name)}
              </div>
              <div className="profile-hero-info">
                <h2>{user?.name}</h2>
                <div className="profile-badges-row">
                  <span className={`soft-badge ${roleConfig.badgeClass}`}>
                    <ShieldCheck size={14} aria-hidden="true" /> {roleConfig.label}
                  </span>
                  <span className="soft-badge tone-green">
                    <UserCheck size={14} aria-hidden="true" /> Verified Account
                  </span>
                </div>
                <small className="account-id-label">
                  Account ID: <code>{user?.id || user?._id || 'Verified'}</code>
                </small>
              </div>
            </div>

            <div className="profile-details-grid">
              <div className="profile-field-node">
                <span className="field-node-label">
                  <UserRound size={15} aria-hidden="true" /> Full Name
                </span>
                <strong className="field-node-value">{user?.name}</strong>
              </div>

              <div className="profile-field-node">
                <span className="field-node-label">
                  <Mail size={15} aria-hidden="true" /> Email Address
                </span>
                <strong className="field-node-value">{user?.email}</strong>
              </div>

              <div className="profile-field-node">
                <span className="field-node-label">
                  <Shield size={15} aria-hidden="true" /> Workspace Role
                </span>
                <strong className="field-node-value">{roleConfig.label}</strong>
              </div>

              <div className="profile-field-node">
                <span className="field-node-label">
                  <Calendar size={15} aria-hidden="true" /> Member Since
                </span>
                <strong className="field-node-value">
                  {user?.createdAt ? formatDate(user.createdAt) : 'Active Member'}
                </strong>
              </div>
            </div>
          </article>

          {/* Quick Workspace Navigation Shortcuts */}
          <article className="surface profile-card">
            <div className="section-heading">
              <h3>Role Shortcuts</h3>
              <p>Quick access to features assigned to your {roleConfig.label} workspace.</p>
            </div>
            <div className="profile-shortcuts-grid">
              {roleConfig.links.map(({ label, path, icon: Icon }) => (
                <Link key={path} to={path} className="profile-shortcut-tile">
                  <div className="shortcut-tile-icon">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <span>{label}</span>
                  <ExternalLink size={13} className="shortcut-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </article>
        </div>

        {/* Right Column: Security & Role Permissions Overview */}
        <div className="profile-side-col">
          {/* Workspace Capabilities */}
          <article className="surface access-card">
            <div className="access-card-header">
              <span className="eyebrow">Permissions</span>
              <h3>Workspace Scope</h3>
            </div>
            <p className="access-desc">{roleConfig.description}</p>
            
            <ul className="capabilities-list">
              {roleConfig.capabilities.map((cap) => (
                <li key={cap}>
                  <CheckCircle2 size={16} color="var(--teal)" aria-hidden="true" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Security Overview */}
          <article className="surface access-card security-overview-card">
            <div className="access-card-header">
              <span className="eyebrow">Session Security</span>
              <h3>Access & Authentication</h3>
            </div>
            <p className="access-desc">
              Your session is secured using JSON Web Tokens with automatic 24-hour expiration
              and role-based API authorization enforcement.
            </p>

            <div className="security-status-box">
              <div className="security-status-row">
                <KeyRound size={16} color="var(--green)" aria-hidden="true" />
                <div>
                  <strong>Session Active</strong>
                  <small>Token cryptographically verified</small>
                </div>
              </div>
              <div className="security-status-row">
                <ShieldCheck size={16} color="var(--navy)" aria-hidden="true" />
                <div>
                  <strong>Data Isolation</strong>
                  <small>Backend authorization enforced</small>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}