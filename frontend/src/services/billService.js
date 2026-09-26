import api from './api'

export const listBills = () => api.get('/bills')
export const createBill = (payload) => api.post('/bills', payload)
export const updateBill = (id, payload) => api.put(`/bills/${id}`, payload)
export const recordBillPayment = (id, payload) => api.patch(`/bills/${id}/payment`, payload)
export const cancelBill = (id) => api.patch(`/bills/${id}/cancel`)