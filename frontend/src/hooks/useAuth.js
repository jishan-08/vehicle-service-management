import { useContext } from 'react'
import { AuthContext } from '../context/context'

export function useAuth() {
  return useContext(AuthContext)
}