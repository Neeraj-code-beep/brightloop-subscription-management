import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'
import AccessRestrictedPage from '../../pages/AccessRestrictedPage.jsx'

export default function RoleGuard({ allowedRoles, children }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-foreground-muted">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return allowedRoles.includes(role) ? children : <AccessRestrictedPage />
}
