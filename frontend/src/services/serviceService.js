import api from './api'

export const listServices = () => api.get('/services')
export const createService = (payload) => api.post('/services', payload)
export const updateService = (id, payload) => api.put(`/services/${id}`, payload)
export const updateServiceStatus = (id, status) => api.patch(`/services/${id}/status`, { status })