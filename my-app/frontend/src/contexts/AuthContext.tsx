import { useState, type ReactNode } from 'react'
import { AuthContext } from './auth.ts'

const TOKEN_KEY = 'calendaction-token'
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000').replace(/\/$/, '')

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, updateToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  function setToken(nextToken: string) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    updateToken(nextToken)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    updateToken(null)
  }

  function apiFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)

    return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  }

  return (
    <AuthContext.Provider value={{ token, setToken, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  )
}