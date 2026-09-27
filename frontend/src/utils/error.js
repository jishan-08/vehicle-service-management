/**
 * Centralized API Error Extractor
 */
export function getApiMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.response?.data?.message) return error.response.data.message
  if (error.request) return 'The service is unavailable right now. Please check your connection.'
  if (error.message) return error.message
  return fallback
}
