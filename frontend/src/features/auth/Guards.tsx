import { Navigate, Outlet, useLocation, Link } from 'react-router'
import { useAuth } from './AuthProvider'
import { ErrorState, Loading } from '../../components/ui/Feedback'
import type { Role } from '../../types/api'
export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()
  if (!auth.active)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (auth.loading) return <Loading label="در حال بررسی حساب کاربری…" />
  if (auth.error)
    return (
      <div className="narrow page-pad">
        <ErrorState error={auth.error} retry={auth.retry} />
        <button className="button secondary" onClick={auth.logout}>
          خروج از حساب
        </button>
      </div>
    )
  if (
    !auth.user?.role ||
    !auth.user.repair_shop ||
    !auth.user.is_active ||
    !auth.user.repair_shop.is_active
  )
    return (
      <div className="narrow page-pad">
        <h1>حساب شما آماده استفاده نیست</h1>
        <p>نقش و تعمیرگاه فعال باید توسط مدیر مشخص شوند.</p>
        <button className="button" onClick={auth.logout}>
          خروج از حساب
        </button>
      </div>
    )
  return <Outlet />
}
export function RoleGuard({ allowed }: { allowed: Role[] }) {
  const { user } = useAuth()
  return user?.role && allowed.includes(user.role) ? (
    <Outlet />
  ) : (
    <div className="empty-state">
      <h1>دسترسی به این صفحه ندارید</h1>
      <p>این بخش برای نقش شما در دسترس نیست.</p>
      <Link className="button secondary" to="/app">
        بازگشت به فضای کاری
      </Link>
    </div>
  )
}
