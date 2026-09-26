import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vsm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vsm_token')
      localStorage.removeItem('vsm_user')
      window.dispatchEvent(new Event('vsm:auth-expired'))
    }
    return Promise.reject(error)
  },
)

export const getApiMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error.response?.data?.message || (error.request ? 'The service is unavailable right now.' : fallback)

export default api