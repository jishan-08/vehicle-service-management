import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getApiMessage } from '../utils/error'
import { roleHome } from '../utils/navigation'
import Alert from '../components/Alert'

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
    if (!form.email || !form.password) {
      setError('Please enter both your email address and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(form.email, form.password)
      navigate(location.state?.from?.pathname || roleHome(user.role), {
        replace: true,
      })
    } catch (requestError) {
      setError(
        getApiMessage(requestError, 'Invalid email or password. Please verify your credentials.')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`auth-screen ${landing ? 'auth-landing' : ''}`}>
      {/* Brand Visual Hero (Left Side on Desktop) */}
      <div className="auth-visual" aria-hidden="true">
        <div className="auth-visual-content">
          <div className="brand-lockup light">
            <span className="brand-emblem">V</span>
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
              One reliable workspace for vehicle records, real-time workshop floor
              progress, appointments, and billing.
            </p>
          </div>

          <div className="visual-metrics">
            <div>
              <strong>01</strong>
              <span>unified workspace</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>service visibility</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>role-aware security</span>
            </div>
          </div>
        </div>

        <div className="road-lines" />
        <div className="visual-orbit orbit-one" />
        <div className="visual-orbit orbit-two" />
      </div>

      {/* Login Form Panel (Right Side) */}
      <div className="auth-panel">
        <div className="auth-mobile-brand">
          <span className="brand-emblem" aria-hidden="true">V</span>
          <div>
            <strong>VEHICLE SERVICE</strong>
            <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)' }}>
              management workspace
            </small>
          </div>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-header-block">
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to Vehicle Service Management</h2>
            <p className="form-intro">
              Access the tools, records, and operations assigned to your workspace account.
            </p>
          </div>

          {error && <Alert type="error" message={error} />}

          <form onSubmit={submit} className="stack-form" noValidate={false}>
            <label htmlFor="auth-email">
              Email address
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                required
                disabled={loading}
              />
            </label>

            <label htmlFor="auth-password">
              Password
              <div className="password-field">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
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
              className="primary-button full-button auth-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="auth-assurance">
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Secure 256-bit encrypted authentication session</span>
          </div>

          <div className="auth-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Role-aware access control</strong>
              <span>
                Customers, technicians, and administrators receive targeted tools for their role.
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