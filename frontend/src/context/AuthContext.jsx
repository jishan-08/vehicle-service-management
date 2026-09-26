import { useEffect, useState } from 'react'
import { currentUserRequest, loginRequest } from '../services/authService'
import { AuthContext } from './context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('vsm_user') || 'null'))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handleExpired = () => setUser(null)
    window.addEventListener('vsm:auth-expired', handleExpired)

    const hydrate = async () => {
      const token = localStorage.getItem('vsm_token')
      if (!token) {
        setReady(true)
        return
      }
      try {
        const response = await currentUserRequest()
        const nextUser = response.data.data.user
        localStorage.setItem('vsm_user', JSON.stringify(nextUser))
        setUser(nextUser)
      } catch {
        localStorage.removeItem('vsm_token')
        localStorage.removeItem('vsm_user')
        setUser(null)
      } finally {
        setReady(true)
      }
    }

    hydrate()
    return () => window.removeEventListener('vsm:auth-expired', handleExpired)
  }, [])

  const login = async (email, password) => {
    const response = await loginRequest(email, password)
    const { token, user: nextUser } = response.data.data
    localStorage.setItem('vsm_token', token)
    localStorage.setItem('vsm_user', JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }

  const logout = () => {
    localStorage.removeItem('vsm_token')
    localStorage.removeItem('vsm_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}
