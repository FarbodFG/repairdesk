import { Link } from 'react-router'
import { Sun } from 'lucide-react'
import { site } from '../../config/site'
export function Brand({
  light = false,
  storefront = false,
}: {
  light?: boolean
  storefront?: boolean
}) {
  return (
    <Link
      to="/"
      className={`brand ${light ? 'light' : ''} ${storefront ? 'storefront' : ''}`}
      aria-label={`${storefront ? site.shopName : site.productName}، صفحه اصلی`}
    >
      <span className="brand-mark" aria-hidden="true">
        {storefront ? (
          <Sun size={27} strokeWidth={1.5} />
        ) : (
          <svg viewBox="0 0 40 40" fill="none">
            <path
              d="M11 30V10h11a7 7 0 0 1 0 14H11m10 0 9 6"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
        )}
      </span>
      <span>
        <b dir={storefront ? 'rtl' : 'ltr'}>
          {storefront ? site.shopName : site.productName}
          <span className="brand-dot">.</span>
        </b>
        <small>
          {storefront ? 'تعمیر موبایل و فروش لوازم جانبی' : `${site.name} / مدیریت و پیگیری تعمیر`}
        </small>
      </span>
    </Link>
  )
}
