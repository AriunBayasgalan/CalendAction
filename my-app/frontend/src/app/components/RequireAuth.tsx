import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../contexts/auth.ts'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const location = useLocation()

  return token ? children : <Navigate to="/login" replace state={{ from: location }} />
}

export default RequireAuth