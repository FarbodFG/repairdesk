import { Link, Outlet } from 'react-router'
import { LogIn, Phone } from 'lucide-react'
import { Brand } from './Brand'
import { site } from '../../config/site'
export default function PublicLayout() {
  return (
    <div className="public-site">
      <header className="public-header">
        <div className="container public-nav">
          <Brand light storefront />
          <nav aria-label="منوی سایت">
            <a href="/#services">خدمات</a>
            <a href="/#about">درباره ما</a>
            <a href="/#contact">تماس با ما</a>
            <Link to="/track">پیگیری سفارش</Link>
          </nav>
          <Link className="button header-login" to="/login">
            ورود کارکنان <LogIn size={17} />
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Brand light storefront />
            <p>تعمیر انواع موبایل و فروش لوازم جانبی موبایل در {site.shopName}.</p>
          </div>
          <div className="footer-contact">
            <h3>تماس و ساعت کاری</h3>
            {site.phone && (
              <a className="footer-phone" href={`tel:${site.phone}`}>
                <Phone size={16} aria-hidden="true" />
                <bdi>{site.phone}</bdi>
              </a>
            )}
            {site.hours && <p>{site.hours}</p>}
            {site.address && <p>{site.address}</p>}
          </div>
          <div>
            <h3>دسترسی سریع</h3>
            <nav className="footer-links" aria-label="دسترسی‌های فوتر">
              <a href="/#services">خدمات</a>
              <a href="/#about">درباره ما</a>
              <a href="/#contact">تماس با ما</a>
              <a href="/#faq">پرسش‌های متداول</a>
              <Link to="/track">پیگیری تعمیر</Link>
              <Link to="/login">ورود کارکنان</Link>
            </nav>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>{site.shopName} · تعمیر موبایل و فروش لوازم جانبی</span>
          <span>پیگیری سفارش با RepairDesk</span>
        </div>
      </footer>
    </div>
  )
}
