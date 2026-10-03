import { useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router'
import {
  LayoutDashboard,
  Wrench,
  Users,
  ContactRound,
  UserRound,
  LogOut,
  Menu,
  ChevronLeft,
  ArrowUpLeft,
  BellRing,
} from 'lucide-react'
import { Brand } from './Brand'
import { Modal } from '../ui/Modal'
import { useAuth } from '../../features/auth/AuthProvider'
import { canManage, roles } from '../../config/status'
import { dateTime } from '../../lib/format'
export default function AppShell() {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const location = useLocation()
  const items = [
    {
      to: '/app',
      label: user?.role === 3 ? 'میز کار من' : 'نمای کلی',
      icon: LayoutDashboard,
      end: true,
    },
    { to: '/app/repairs', label: 'سفارش‌های تعمیر', icon: Wrench },
    ...(canManage(user?.role)
      ? [
          { to: '/app/customers', label: 'مشتریان و دستگاه‌ها', icon: Users },
          { to: '/app/staff', label: 'کارکنان تعمیرگاه', icon: ContactRound },
          { to: '/app/notifications', label: 'اعلان‌های مشتریان', icon: BellRing },
        ]
      : []),
    { to: '/app/account', label: 'حساب کاربری', icon: UserRound },
  ]
  const current = [...items]
    .reverse()
    .find(
      (item) =>
        item.to === location.pathname ||
        (item.to !== '/app' && location.pathname.startsWith(item.to)),
    )
  const navigation = (
    <>
      <div className="sidebar-brand">
        <Brand />
        <span className="workspace-label">فضای کاری تعمیرگاه</span>
      </div>
      <nav className="app-nav" aria-label="منوی پنل">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobile(false)}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="shop-label">
          <span className="status-dot" />
          <span>{user?.repair_shop?.title}</span>
        </div>
        <Link to="/" className="text-link">
          مشاهده سایت <ArrowUpLeft size={16} />
        </Link>
      </div>
    </>
  )
  return (
    <div className="app-shell">
      <aside className="sidebar">{navigation}</aside>
      <Modal
        open={mobile}
        onOpenChange={setMobile}
        title="منوی فضای کاری"
        description="دسترسی به بخش‌های پنل"
        className="mobile-drawer"
      >
        {navigation}
      </Modal>
      <div className="workspace">
        <header className="app-header">
          <div className="row">
            <button
              className="icon-button mobile-menu"
              aria-label="باز کردن منو"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <nav className="breadcrumb" aria-label="مسیر صفحه">
              <Link to="/app">فضای کاری</Link>
              <ChevronLeft size={14} />
              <span>
                {current?.label ||
                  (location.pathname.endsWith('/new') ? 'پذیرش دستگاه' : 'دسترسی محدود')}
              </span>
            </nav>
          </div>
          <div className="header-account">
            <span className="avatar">
              {(user?.first_name || user?.username || 'ک').slice(0, 1)}
            </span>
            <Link to="/app/account">
              <b>{user?.first_name || user?.username}</b>
              <small>{user?.role ? roles[user.role] : ''}</small>
            </Link>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="خروج از حساب"
              title="خروج از حساب"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" className="app-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>RepairDesk · میز تعمیر</span>
          <time>{dateTime(new Date().toISOString()).split('،')[0]}</time>
        </footer>
      </div>
    </div>
  )
}
