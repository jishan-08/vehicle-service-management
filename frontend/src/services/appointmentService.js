import api from './api'

export const listAppointments = () => api.get('/appointments')
export const createAppointment = (payload) => api.post('/appointments', payload)
export const updateAppointment = (id, payload) => api.put(`/appointments/${id}`, payload)
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}/status`, { status })