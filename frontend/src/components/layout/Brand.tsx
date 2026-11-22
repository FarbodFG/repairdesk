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
      aria-label={`${site.shopName}، صفحه اصلی`}
    >
      <span className="brand-mark" aria-hidden="true">
        <Sun size={27} strokeWidth={1.5} />
      </span>
      <span>
        <b dir="auto">{site.shopName}</b>
        <small>
          {storefront ? 'تعمیر موبایل و فروش لوازم جانبی' : 'پنل کارکنان'}
        </small>
      </span>
    </Link>
  )
}
