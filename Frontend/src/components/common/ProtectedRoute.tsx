import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { canRead } from '@/store/slices/authSlice'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useSelector((s: RootState) => s.auth)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function PermissionRoute({ menu, children }: { menu: string; children: React.ReactNode }) {
  const { user, permissions } = useSelector((s: RootState) => s.auth)
  if (!canRead(permissions, user?.role, menu)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
