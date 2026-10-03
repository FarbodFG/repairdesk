import { Link } from 'react-router'
import { site } from '../../config/site'
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand ${light ? 'light' : ''}`} aria-label="RepairDesk، صفحه اصلی">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M11 30V10h11a7 7 0 0 1 0 14H11m10 0 9 6" stroke="currentColor" strokeWidth="3" />
        </svg>
      </span>
      <span>
        <b dir="ltr">
          {site.productName}
          <span className="brand-dot">.</span>
        </b>
        <small>{site.name} / مدیریت و پیگیری تعمیر</small>
      </span>
    </Link>
  )
}
