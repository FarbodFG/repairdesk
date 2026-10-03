import { Link } from 'react-router'
import { ChevronLeft, Smartphone } from 'lucide-react'
import type { Repair } from '../../types/api'
import { dateTime, deviceName, money } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/Feedback'
export function RepairTable({ repairs }: { repairs: Repair[] }) {
  if (!repairs.length)
    return (
      <EmptyState
        title="سفارشی پیدا نشد"
        description="اگر فیلتر فعال است، آن را تغییر دهید یا یک سفارش جدید ثبت کنید."
      />
    )
  return (
    <div className="repair-list">
      <div className="repair-list-head" aria-hidden="true">
        <span>دستگاه / کد پیگیری</span>
        <span>مشتری</span>
        <span>وضعیت تعمیر</span>
        <span>مبلغ / پرداخت</span>
        <span />
      </div>
      <ul>
        {repairs.map((repair) => (
          <li key={repair.id} className="repair-row">
            <div className="repair-device">
              <span className="device-icon">
                <Smartphone size={22} strokeWidth={1.5} />
              </span>
              <div>
                <Link className="repair-title" to={`/app/repairs/${repair.id}`}>
                  {deviceName(repair.device)}
                </Link>
                <Link className="repair-code mono" dir="ltr" to={`/app/repairs/${repair.id}`}>
                  {repair.tracking_code}
                </Link>
              </div>
            </div>
            <div className="repair-customer">
              <b>{repair.customer.name}</b>
              <small>{dateTime(repair.created_at)}</small>
            </div>
            <div>
              <StatusBadge status={repair.repair_status} />
            </div>
            <div className="repair-amount">
              <b>{money(repair.final_amount)}</b>
              <small className={repair.is_paid ? 'paid-text' : 'muted'}>
                {repair.is_paid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}
              </small>
            </div>
            <Link
              className="icon-button repair-open"
              aria-label={`جزئیات سفارش ${repair.tracking_code}`}
              to={`/app/repairs/${repair.id}`}
            >
              <ChevronLeft size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
