import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { ProtectedRoute, RoleGuard } from '../features/auth/Guards'
import { Loading } from '../components/ui/Feedback'
const PublicLayout = lazy(() => import('../components/layout/PublicLayout'))
const AppShell = lazy(() => import('../components/layout/AppShell'))
const LandingPage = lazy(() => import('../features/landing/LandingPage'))
const TrackingPage = lazy(() => import('../features/tracking/TrackingPage'))
const LoginPage = lazy(() => import('../features/auth/LoginPage'))
const AccountPage = lazy(() => import('../features/auth/AccountPage'))
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
const RepairListPage = lazy(() => import('../features/repairs/RepairListPage'))
const CreateRepairPage = lazy(() => import('../features/repairs/CreateRepairPage'))
const RepairDetailPage = lazy(() => import('../features/repairs/RepairDetailPage'))
const CustomersPage = lazy(() => import('../features/customers/CustomersPage'))
const CustomerDetailPage = lazy(() => import('../features/customers/CustomerDetailPage'))
const StaffPage = lazy(() => import('../features/staff/StaffPage'))
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'))
const NotFoundPage = lazy(() => import('../routes/NotFoundPage'))
export function App() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const title =
      pathname === '/'
        ? 'تعمیر دقیق. خیال آسوده.'
        : pathname === '/track'
          ? 'پیگیری تعمیر'
          : pathname === '/login'
            ? 'ورود کارکنان'
            : pathname.includes('customers')
              ? 'مشتریان و دستگاه‌ها'
              : pathname.includes('staff')
                ? 'کارکنان'
                : pathname.includes('notifications')
                  ? 'اعلان‌های مشتریان'
                  : pathname.includes('repairs')
                    ? 'سفارش‌های تعمیر'
                    : pathname.includes('account')
                      ? 'حساب کاربری'
                      : 'فضای کاری'
    document.title = `${title} | RepairDesk`
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return (
    <>
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <Suspense fallback={<Loading label="در حال بارگذاری صفحه…" />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="track" element={<TrackingPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="repairs" element={<RepairListPage />} />
              <Route path="repairs/:id" element={<RepairDetailPage />} />
              <Route element={<RoleGuard allowed={[1, 2]} />}>
                <Route path="repairs/new" element={<CreateRepairPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}
