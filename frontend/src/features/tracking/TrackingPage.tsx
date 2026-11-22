import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, ClipboardList, Clock3, Phone, SearchX, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react'
import { z } from 'zod'
import { TrackingForm, trackingSchema } from './TrackingForm'
import { request } from '../../lib/api/client'
import { ApiError } from '../../lib/api/errors'
import { dateTime, money } from '../../lib/format'
import { site } from '../../config/site'
import { statuses } from '../../config/status'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Feedback'
import workbenchImage from './tracking-workbench.jpg'
import mobileWorkbenchImage from './tracking-workbench-mobile.jpg'
import './tracking.css'

const resultSchema = z.object({
  tracking_code: trackingSchema.shape.code,
  repair_status: z.literal([1, 2, 3, 4, 5, 6, 7]),
  final_amount: z.number().nonnegative().nullable(),
  is_paid: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
})

const phases = ['پذیرش', 'بررسی', 'تعمیر', 'آمادهٔ تحویل', 'تحویل']
const phaseByStatus = { 1: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4 } as const
const statusIcons = { 1: ClipboardList, 2: Clock3, 3: Clock3, 4: Wrench, 5: CircleCheck, 6: CircleCheck, 7: TriangleAlert }

export default function TrackingPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const linkedCode = params.get('code')
  const parsed = trackingSchema.safeParse({ code: linkedCode ?? location.state?.code ?? '' })
  const code = parsed.success ? parsed.data.code : ''

  if (linkedCode !== null) {
    params.delete('code')
    return (
      <Navigate
        replace
        to={{ pathname: location.pathname, search: params.toString(), hash: location.hash }}
        state={{ code, invalidLink: !code }}
      />
    )
  }

  return <TrackingLookup key={location.key} initialCode={code} invalidLink={location.state?.invalidLink === true} />
}

function TrackingLookup({ initialCode, invalidLink }: { initialCode: string; invalidLink: boolean }) {
  const [code, setCode] = useState(initialCode)
  const [linkError, setLinkError] = useState(invalidLink)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const result = useQuery({
    queryKey: ['public-tracking', code],
    queryFn: async ({ signal }) => {
      const payload = await request<unknown>(`repairs/?tracking_code=${encodeURIComponent(code)}`, {
        public: true,
        referrerPolicy: 'no-referrer',
        signal,
      })
      const parsed = resultSchema.safeParse(payload)
      if (!parsed.success || parsed.data.tracking_code !== code) throw new ApiError(502)
      return parsed.data
    },
    enabled: !!code,
    networkMode: 'always',
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (result.isSuccess && !result.isFetching) resultHeading.current?.focus()
  }, [result.isSuccess, result.isFetching, result.dataUpdatedAt])

  return (
    <section className="tracking-page" aria-labelledby="tracking-heading">
      <div className="container tracking-layout">
        <div className="tracking-hero">
          <Link to="/" className="tracking-home-link">
            <ArrowRight size={18} aria-hidden="true" /> بازگشت به خانه
          </Link>
          <h1 id="tracking-heading">پیگیری سفارش تعمیر</h1>
          <p className="tracking-intro">کد روی رسید پذیرش یا پیامک را وارد کنید تا آخرین وضعیت دستگاهتان را ببینید.</p>
          <TrackingForm
            initialCode={initialCode}
            busy={result.isFetching}
            lookup
            onEdit={() => {
              setCode('')
              setLinkError(false)
            }}
            onTrack={(value) => {
              if (value === code) void result.refetch()
              else setCode(value)
            }}
          />
          <p className="tracking-privacy"><ShieldCheck size={17} aria-hidden="true" /> برای پیگیری فقط کد سفارش کافی است.</p>
        </div>
        {(code || linkError) && (
          <div className="tracking-outcome">
            {result.isFetching ? (
              <p className="tracking-checking" role="status"><Spinner /> در حال بررسی کد پیگیری…</p>
            ) : result.isError ? (
              <TrackingError error={result.error} retry={() => void result.refetch()} />
            ) : result.data ? (
              <TrackingResult repair={result.data} heading={resultHeading} />
            ) : linkError ? (
              <div className="tracking-notice" role="alert">
                <TriangleAlert size={24} aria-hidden="true" />
                <div><h2>کد پیگیری داخل لینک معتبر نیست</h2><p>کد روی رسید یا پیامک را در کادر وارد کنید.</p></div>
              </div>
            ) : null}
          </div>
        )}
        {site.phone && (
          <aside className="tracking-help">
            <div>
              <h2>{result.data ? 'تماس با تعمیرگاه' : 'کد پیگیری را پیدا نمی‌کنید؟'}</h2>
              <p>{result.data ? 'برای هماهنگی تحویل یا پرسش دربارهٔ تعمیر تماس بگیرید.' : 'برای دریافت کد با تعمیرگاه تماس بگیرید.'}</p>
            </div>
            <a href={`tel:${site.phone}`} className="tracking-call" aria-label={`تماس با ${site.shopName}، ${site.phone}`}>
              <Phone size={18} aria-hidden="true" /><bdi dir="ltr">{site.phone}</bdi>
            </a>
          </aside>
        )}
        <picture className="tracking-photo" aria-hidden="true">
          <source media="(max-width: 840px)" srcSet={mobileWorkbenchImage} width={1040} height={520} />
          <img src={workbenchImage} alt="" width={900} height={1125} fetchPriority="high" />
        </picture>
      </div>
    </section>
  )
}

function TrackingError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined
  const missing = status === 404
  const limited = status === 429
  const Icon = missing ? SearchX : TriangleAlert
  return (
    <div className="tracking-notice" role="alert">
      <Icon size={26} aria-hidden="true" />
      <div>
        <h2>{missing ? 'سفارشی با این کد پیدا نشد' : limited ? 'درخواست‌های پیگیری زیاد است' : 'دریافت وضعیت سفارش ممکن نشد'}</h2>
        <p>{missing ? 'کد روی رسید یا پیامک را دوباره بررسی کنید.' : limited ? 'کمی صبر کنید و دوباره پیگیری کنید.' : 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'}</p>
      </div>
      {!missing && !limited && <button className="button secondary" onClick={retry} type="button">تلاش دوباره</button>}
    </div>
  )
}

function TrackingResult({ repair, heading }: {
  repair: z.infer<typeof resultSchema>
  heading: RefObject<HTMLHeadingElement | null>
}) {
  const status = repair.repair_status
  const Icon = statusIcons[status]
  const current = statuses[status]
  const phase = status === 7 ? null : phaseByStatus[status]

  return (
    <section className="tracking-receipt" aria-labelledby="tracking-result-heading">
      <div className="tracking-receipt-head">
        <span>کد پیگیری <bdi className="tracking-code" dir="ltr" translate="no">{repair.tracking_code}</bdi></span>
        <StatusBadge status={status} />
      </div>
      <div className={`tracking-current ${current.tone}`}>
        <span className="tracking-status-icon"><Icon size={27} aria-hidden="true" /></span>
        <div>
          <h2 id="tracking-result-heading" tabIndex={-1} ref={heading}>{current.label}</h2>
          <p>{current.description}</p>
        </div>
      </div>
      {phase !== null && (
        <ol className="tracking-phases" role="list" aria-label="مراحل تعمیر">
          {phases.map((label, index) => (
            <li key={label} aria-current={phase === index ? 'step' : undefined} data-passed={index < phase}>
              <span aria-hidden="true">{index < phase ? <CircleCheck size={16} /> : <i />}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      <dl className="tracking-details">
        <div><dt>زمان ثبت سفارش</dt><dd>{dateTime(repair.created_at)}</dd></div>
        <div><dt>مبلغ نهایی</dt><dd>{money(repair.final_amount)}</dd></div>
        <div><dt>وضعیت پرداخت</dt><dd>{repair.is_paid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}</dd></div>
      </dl>
    </section>
  )
}
