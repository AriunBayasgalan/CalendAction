import { createContext, useContext } from 'react'

export type AuthContextValue = {
  token: string | null
  setToken: (token: string) => void
  logout: () => void
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}