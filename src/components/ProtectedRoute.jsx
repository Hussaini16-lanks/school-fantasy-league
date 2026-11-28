import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="status">Loading…</p>
  // Remember where they were going, so login can send them back (e.g. a QR check-in)
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}