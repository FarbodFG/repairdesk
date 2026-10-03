import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, ShieldCheck, XCircle } from 'lucide-react'
import { TrackingForm, trackingSchema } from './TrackingForm'
import { request } from '../../lib/api/client'
import type { PublicRepair } from '../../types/api'
import { ApiError } from '../../lib/api/errors'
import { dateTime, money } from '../../lib/format'
import { statuses } from '../../config/status'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Loading, ErrorState } from '../../components/ui/Feedback'
export default function TrackingPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initial = trackingSchema.safeParse({
    code: location.state?.code || searchParams.get('code') || '',
  })
  const [code, setCode] = useState(initial.success ? initial.data.code : '')
  const result = useQuery({
    queryKey: ['public-tracking', code],
    queryFn: ({ signal }) =>
      request<PublicRepair>(`repairs/?tracking_code=${encodeURIComponent(code)}`, {
        public: true,
        signal,
      }),
    enabled: !!code,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  return (
    <section className="track-page container">
      <div className="track-heading">
        <span className="eyebrow">از وضعیت دستگاهتان باخبر بمانید</span>
        <h1>تعمیر شما، در چه مرحله‌ای است؟</h1>
        <p>کد روی رسید پذیرش را وارد کنید. بدون ورود، وضعیت فعلی سفارش را ببینید.</p>
      </div>
      <div className="track-panel">
        <TrackingForm
          initialCode={code}
          busy={result.isFetching}
          onTrack={(value) => {
            if (value === code) void result.refetch()
            else setCode(value)
          }}
        />
        <p className="privacy-note">
          <ShieldCheck size={16} />
          در این صفحه فقط اطلاعات عمومی سفارش نمایش داده می‌شود.
        </p>
        {code && result.isFetching && <Loading label="در حال بررسی کد پیگیری…" />}
        {code &&
          !result.isFetching &&
          result.isError &&
          (result.error instanceof ApiError && result.error.status === 404 ? (
            <div className="empty-state" role="alert">
              <XCircle size={30} />
              <h2>سفارشی با این کد پیدا نشد</h2>
              <p>کد روی رسید را دوباره بررسی کنید یا با تعمیرگاه تماس بگیرید.</p>
            </div>
          ) : (
            <ErrorState
              error={result.error}
              retry={() => {
                void result.refetch()
              }}
            />
          ))}
        {code && !result.isFetching && result.data && <TrackingResult repair={result.data} />}
      </div>
      <Link to="/" className="text-link">
        بازگشت به صفحه اصلی
      </Link>
    </section>
  )
}
function TrackingResult({ repair }: { repair: PublicRepair }) {
  const current = statuses[repair.repair_status]
  return (
    <section className="tracking-result" aria-live="polite">
      <div className="result-top">
        <span>
          سفارش <bdi className="mono">{repair.tracking_code}</bdi>
        </span>
        <StatusBadge status={repair.repair_status} />
      </div>
      <div className={`tracking-status ${repair.repair_status === 7 ? 'cancelled' : ''}`}>
        {repair.repair_status === 7 ? <XCircle size={42} /> : <CircleCheck size={42} />}
        <h2>{current.label}</h2>
        <p>{current.description}</p>
      </div>
      <dl className="tracking-facts">
        <div>
          <dt>مبلغ نهایی</dt>
          <dd>{money(repair.final_amount)}</dd>
        </div>
        <div>
          <dt>وضعیت پرداخت</dt>
          <dd>{repair.is_paid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}</dd>
        </div>
        <div>
          <dt>زمان ثبت سفارش</dt>
          <dd>{dateTime(repair.created_at)}</dd>
        </div>
      </dl>
      <p className="small muted">
        این اطلاعات وضعیت فعلی ثبت‌شده در تعمیرگاه است. زمان مراحل قبلی در پیگیری عمومی ارائه
        نمی‌شود.
      </p>
    </section>
  )
}
