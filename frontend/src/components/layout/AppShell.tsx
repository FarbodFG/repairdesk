import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router'
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
  Search,
  Plus,
  Ellipsis,
  Sun,
} from 'lucide-react'
import { Brand } from './Brand'
import { Modal } from '../ui/Modal'
import { useAuth } from '../../features/auth/AuthProvider'
import { canManage, roles } from '../../config/status'
import { dateTime } from '../../lib/format'
import { Field } from '../ui/Field'
import { site } from '../../config/site'
export default function AppShell() {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const manage = canManage(user?.role)
  const intakePath = '/app/repairs/new'
  const mobileItems = [
    { to: '/app', label: 'خانه', icon: LayoutDashboard, active: location.pathname === '/app' },
    { to: '/app/repairs', label: 'سفارش‌ها', icon: Wrench, active: location.pathname.startsWith('/app/repairs') && location.pathname !== intakePath },
    ...(manage ? [
      { to: intakePath, label: 'پذیرش', icon: Plus, active: location.pathname === intakePath },
      { to: '/app/notifications', label: 'اعلان‌ها', icon: BellRing, active: location.pathname === '/app/notifications' },
    ] : []),
  ]
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.repeat || event.defaultPrevented || mobile || searchOpen ||
        !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' ||
        document.querySelector('[role="dialog"]')
      ) return
      event.preventDefault()
      setSearch('')
      setSearchOpen(true)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [mobile, searchOpen])
  const items = [
    {
      to: '/app',
      label: user?.role === 3 ? 'میز کار من' : 'نمای کلی',
      icon: LayoutDashboard,
      end: true,
    },
    { to: '/app/repairs', label: 'سفارش‌های تعمیر', icon: Wrench },
    ...(manage
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
        (item.to !== '/app' && location.pathname.startsWith(item.to + '/')),
    )
  const navigation = (
    <>
      <div className="sidebar-brand">
        <Brand light />
      </div>
      <div className="workspace-shop">
        <span className="workspace-shop-icon"><Wrench size={18} aria-hidden="true" /></span>
        <div><b dir="auto">{user?.repair_shop?.title}</b><small>فضای کاری تعمیرگاه</small></div>
      </div>
      <nav className="app-nav" aria-label="منوی پنل">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobile(false)}>
            <item.icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/" className="text-link">
          مشاهده سایت <ArrowUpLeft size={16} aria-hidden="true" />
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
        returnFocus={menuTrigger}
      >
        {navigation}
      </Modal>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="جست‌وجوی سفارش"
        description="نام مشتری، شماره تماس یا کد پیگیری را وارد کنید."
        className="workspace-search-dialog"
        returnFocus={searchTrigger}
        initialFocus={searchInput}
      >
        <form
          className="workspace-search-form"
          onSubmit={(event) => {
            event.preventDefault()
            const value = search.trim()
            if (!value) return
            setSearchOpen(false)
            void navigate('/app/repairs?' + new URLSearchParams({ search: value }))
          }}
        >
          <Field label="عبارت جست‌وجو">
            <input
              ref={searchInput}
              type="search"
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
            />
          </Field>
          <button type="submit" className="button" disabled={!search.trim()}>
            <Search size={18} aria-hidden="true" /> نمایش نتایج
          </button>
        </form>
      </Modal>
      <div className="workspace">
        <header className="app-header">
          <div className="row">
            <button
              className="icon-button mobile-menu"
              aria-label="باز کردن منو"
              onClick={(event) => {
                menuTrigger.current = event.currentTarget
                setMobile(true)
              }}
            >
              <Menu size={22} />
            </button>
            <Link className="mobile-brand" to="/app" aria-label={`${site.shopName}، خانه پنل`}>
              <Sun size={19} aria-hidden="true" /> <b>{site.shopName}</b>
            </Link>
            <nav className="breadcrumb" aria-label="مسیر صفحه">
              <Link to="/app">فضای کاری</Link>
              <ChevronLeft size={14} aria-hidden="true" />
              <span aria-current="page">
                {location.pathname === intakePath ? 'پذیرش دستگاه' : current?.label || 'فضای کاری'}
              </span>
            </nav>
          </div>
          <div className="header-actions">
            <button
              ref={searchTrigger}
              type="button"
              className="workspace-search-button"
              aria-label="جست‌وجوی سفارش"
              aria-keyshortcuts="Control+k Meta+k"
              onClick={() => {
                setSearch('')
                setSearchOpen(true)
              }}
            >
              <Search size={18} aria-hidden="true" />
              <span>جست‌وجوی سفارش</span>
              <kbd dir="ltr">Ctrl K</kbd>
            </button>
            {manage && location.pathname !== intakePath && (
              <Link className="button header-create" to={intakePath} aria-label="پذیرش سریع دستگاه">
                <Plus size={17} aria-hidden="true" /><span>پذیرش</span>
              </Link>
            )}
            <div className="header-account">
              <span className="avatar" aria-hidden="true">
                {(user?.first_name || user?.username || 'ک').slice(0, 1)}
              </span>
              <Link to="/app/account" className="header-profile" aria-label="حساب کاربری">
                <b dir="auto">{user?.first_name || user?.username}</b>
                <small>{user?.role ? roles[user.role] : ''}</small>
              </Link>
              <button
                className="icon-button"
                onClick={logout}
                aria-label="خروج از حساب"
                title="خروج از حساب"
              >
                <LogOut size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
        <main id="main-content" className="app-main">
          <div className="workspace-page" key={location.pathname}><Outlet /></div>
        </main>
        <footer className="app-footer">
          <span>{site.shopName} · پنل کارکنان</span>
          <time>{dateTime(new Date().toISOString()).split('،')[0]}</time>
        </footer>
      </div>
      <nav className="mobile-dock" aria-label="دسترسی سریع پنل">
        {mobileItems.map(({ to, label, icon: Icon, active }) => (
          <Link to={to} key={to} aria-current={active ? 'page' : undefined}>
            <Icon size={20} aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
        <button type="button" aria-haspopup="dialog" onClick={(event) => {
          menuTrigger.current = event.currentTarget
          setMobile(true)
        }}>
          <Ellipsis size={21} aria-hidden="true" /><span>بیشتر</span>
        </button>
      </nav>
    </div>
  )
}
