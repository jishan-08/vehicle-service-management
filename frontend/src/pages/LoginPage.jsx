import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { roleHome } from '../utils/navigation'

export default function LoginPage({ landing = false }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(form.email, form.password)
      navigate(location.state?.from?.pathname || roleHome(user.role), {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getApiMessage(requestError, 'We could not sign you in with those details.')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`auth-screen ${landing ? 'auth-landing' : ''}`}>
      <div className="auth-visual">
        <div className="auth-visual-content">
          <div className="brand-lockup light">
            <span className="brand-emblem" aria-hidden="true">V</span>
            <span>
              <strong>VEHICLE SERVICE</strong>
              <small>management workspace</small>
            </span>
          </div>

          <div className="visual-copy">
            <span className="eyebrow accent-eyebrow">
              Service operations platform
            </span>
            <h1>Keep every vehicle moving.</h1>
            <p>
              One reliable workspace for vehicles, workshop progress,
              appointments, and invoices.
            </p>
          </div>

          <div className="visual-metrics">
            <div>
              <strong>01</strong>
              <span>connected workspace</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>service visibility</span>
            </div>
          </div>
        </div>

        <div className="road-lines" aria-hidden="true" />
        <div className="visual-orbit orbit-one" aria-hidden="true" />
        <div className="visual-orbit orbit-two" aria-hidden="true" />
      </div>

      <div className="auth-panel">
        <div className="auth-mobile-brand">
          <span className="brand-emblem" aria-hidden="true">V</span>
          <strong>VEHICLE SERVICE</strong>
        </div>

        <div className="auth-form-wrap">
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to Vehicle Service Management</h2>
          <p className="form-intro">
            Access the tools and records assigned to your workspace role.
          </p>

          {error && <div className="alert error-alert" role="alert">{error}</div>}

          <form onSubmit={submit} className="stack-form">
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
              />
            </label>

            <label>
              Password
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            <button
              className="primary-button full-button"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}{' '}
              {!loading && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>

          <div className="auth-assurance">
            <LockKeyhole size={16} aria-hidden="true" />
            <span>Role-aware access with secure session verification</span>
          </div>

          <div className="auth-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Your workspace stays focused</strong>
              <span>
                Customers, staff, and admins see the tools assigned to their role.
              </span>
            </div>
          </div>
        </div>

        <footer className="auth-footer">
          Vehicle Service Management <span aria-hidden="true">•</span> 2026
        </footer>
      </div>
    </div>
  )
}