import api from './api'

const query = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => value))
export const getServiceSummary = (params) => api.get('/reports/service-summary', { params: query(params) })
export const getAppointmentSummary = (params) => api.get('/reports/appointment-summary', { params: query(params) })
export const getRevenueSummary = (params) => api.get('/reports/revenue-summary', { params: query(params) })
export const getVehicleSummary = (params) => api.get('/reports/vehicle-summary', { params: query(params) })