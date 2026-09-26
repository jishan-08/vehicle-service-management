import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import VehiclesPage from './pages/VehiclesPage'
import ServicesPage from './pages/ServicesPage'
import ProfilePage from './pages/ProfilePage'
import BillsPage from './pages/BillsPage'
import AppointmentsPage from './pages/AppointmentsPage'
import ReportsPage from './pages/ReportsPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

function App() {
  return <AuthProvider><BrowserRouter><Routes><Route path="/" element={<LoginPage landing />} /><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<AppShell />}><Route path="/customer" element={<ProtectedRoute roles={['CUSTOMER']} />}><Route index element={<DashboardPage />} /><Route path="vehicles" element={<VehiclesPage />} /><Route path="services" element={<ServicesPage />} /><Route path="appointments" element={<AppointmentsPage />} /><Route path="bills" element={<BillsPage />} /><Route path="profile" element={<ProfilePage />} /></Route><Route path="/staff" element={<ProtectedRoute roles={['STAFF']} />}><Route index element={<DashboardPage />} /><Route path="vehicles" element={<VehiclesPage />} /><Route path="services" element={<ServicesPage />} /><Route path="appointments" element={<AppointmentsPage />} /><Route path="bills" element={<BillsPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="profile" element={<ProfilePage />} /></Route><Route path="/admin" element={<ProtectedRoute roles={['ADMIN']} />}><Route index element={<DashboardPage />} /><Route path="vehicles" element={<VehiclesPage />} /><Route path="services" element={<ServicesPage />} /><Route path="appointments" element={<AppointmentsPage />} /><Route path="bills" element={<BillsPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="profile" element={<ProfilePage />} /></Route></Route></Route><Route path="*" element={<NotFoundPage />} /></Routes></BrowserRouter></AuthProvider>
}

export default App