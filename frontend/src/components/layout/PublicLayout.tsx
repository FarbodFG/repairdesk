import { Link, Outlet } from 'react-router'
import { ArrowUpLeft } from 'lucide-react'
import { Brand } from './Brand'
import { site } from '../../config/site'
export default function PublicLayout() {
  return (
    <div className="public-site">
      <header className="public-header">
        <div className="container public-nav">
          <Brand light />
          <nav aria-label="منوی سایت">
            <a href="/#services">خدمات</a>
            <a href="/#process">مسیر تعمیر</a>
            <Link to="/track">پیگیری سفارش</Link>
          </nav>
          <Link className="button header-login" to="/login">
            ورود کارکنان <ArrowUpLeft size={16} />
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container footer-grid">
          <div>
            <Brand light />
            <p>از پذیرش تا تحویل؛ یک مسیر قابل پیگیری.</p>
          </div>
          <div>
            <h3>{site.shopName}</h3>
            <p>{site.address}</p>
            <p>{site.hours}</p>
            {site.phone && (
              <a href={`tel:${site.phone}`} dir="ltr">
                {site.phone}
              </a>
            )}
          </div>
          <div>
            <h3>دسترسی سریع</h3>
            <Link to="/track">پیگیری تعمیر</Link>
            <Link to="/login">فضای کاری کارکنان</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>RepairDesk · سامانه مدیریت تعمیرات</span>
          <span dir="ltr">DESIGNED AROUND THE DETAILS.</span>
        </div>
      </footer>
    </div>
  )
}
