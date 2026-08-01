import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps routes that require authentication.
 * Unauthenticated users are redirected to /login.
 */
export function ProtectedRoute() {
  const { isAuthed } = useAuth()
  return isAuthed ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * Wraps routes that should only be accessible when NOT authenticated
 * (login, register). Authenticated users are redirected to /dashboard.
 */
export function GuestRoute() {
  const { isAuthed } = useAuth()
  return isAuthed ? <Navigate to="/dashboard" replace /> : <Outlet />
}
