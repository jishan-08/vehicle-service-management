import { Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { formatInitials } from '../utils/formatters'

const roleLabels = {
  CUSTOMER: 'Customer',
  STAFF: 'Service staff',
  ADMIN: 'Administrator',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const roleName = roleLabels[user?.role] || user?.role

  return (
    <div className="content-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Account settings</span>
          <h1>Profile</h1>
          <p>Your identity and workspace access.</p>
        </div>
      </section>

      <section className="profile-layout">
        <article className="surface profile-card">
          <div className="profile-hero">
            <span className="profile-avatar-large" aria-hidden="true">
              {formatInitials(user?.name)}
            </span>
            <div>
              <h2>{user?.name}</h2>
              <span className="soft-badge">
                <ShieldCheck size={14} aria-hidden="true" /> {roleName}
              </span>
            </div>
          </div>

          <div className="profile-fields">
            <div>
              <span className="field-label">
                <Mail size={15} aria-hidden="true" /> Email address
              </span>
              <strong>{user?.email}</strong>
            </div>
            <div>
              <span className="field-label">
                <UserRound size={15} aria-hidden="true" /> Account role
              </span>
              <strong>{roleName}</strong>
            </div>
          </div>
        </article>

        <aside className="surface access-card">
          <span className="eyebrow">Access overview</span>
          <h2>Your workspace is role-aware.</h2>
          <p>
            VANTA keeps operational tools focused around the access your team
            needs. Backend permissions remain the source of truth.
          </p>
          <div className="access-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Authenticated session active</span>
          </div>
        </aside>
      </section>
    </div>
  )
}