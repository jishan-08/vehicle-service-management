import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../utils/navigation'

export default function NotFoundPage() { const { user } = useAuth(); return <div className="not-found"><span className="empty-icon"><Compass size={27} /></span><span className="eyebrow">Route not found</span><h1>That road is not on the map.</h1><p>The page you requested does not exist or has moved.</p><Link className="primary-button" to={user ? roleHome(user.role) : '/login'}><ArrowLeft size={17} /> Back to workspace</Link></div> }