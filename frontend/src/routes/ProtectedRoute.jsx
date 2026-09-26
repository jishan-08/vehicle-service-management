import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../utils/navigation'

export default function ProtectedRoute({ roles }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <div className="screen-loader"><span className="loader-mark">VS</span><span>Loading your workspace</span></div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  return <Outlet />
}