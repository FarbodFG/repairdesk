import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { BellRing, RefreshCw, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { EmptyState, ErrorState, FormAlert, Loading, Spinner } from '../../components/ui/Feedback'
import { Pagination } from '../../components/ui/Pagination'
import { useToast } from '../../components/ui/Toast'
import { request } from '../../lib/api/client'
import { keys, queryClient } from '../../lib/api/queries'
import { dateTime } from '../../lib/format'
import type { Notification, NotificationStatus, Page } from '../../types/api'

const statusDetails: Record<NotificationStatus, { label: string; tone: string }> = {
  pending: { label: 'در انتظار ارسال', tone: 'amber' },
  processing: { label: 'در حال ارسال', tone: 'blue' },
  simulated: { label: 'شبیه‌سازی‌شده', tone: 'teal' },
  sent: { label: 'ارسال‌شده', tone: 'green' },
  delivered: { label: 'تحویل‌شده', tone: 'forest' },
  failed: { label: 'ناموفق', tone: 'red' },
  cancelled: { label: 'لغوشده', tone: 'neutral' },
}

const eventLabels: Record<string, string> = {
  repair_created: 'ثبت سفارش',
  repair_waiting_for_parts: 'در انتظار قطعه',
  repair_ready: 'آماده تحویل',
  repair_cancelled: 'لغو سفارش',
}

const providerLabels: Record<string, string> = {
  fake: 'شبیه‌ساز',
  smsir: 'SMS.ir',
  kavenegar: 'کاوه‌نگار',
}

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const notify = useToast()
  const requestedPage = Number(params.get('page'))
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const query = new URLSearchParams({ page: String(page), page_size: '20' })

  for (const key of ['search', 'status', 'provider']) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }

  const queryString = query.toString()
  const notifications = useQuery({
    queryKey: keys.notificationList(queryString),
    queryFn: ({ signal }) =>
      request<Page<Notification>>(`notifications/?${queryString}`, { signal }),
    placeholderData: keepPreviousData,
  })

  const retry = useMutation({
    mutationFn: async (notificationId: number) => {
      const result = await request<Notification>(`notifications/${notificationId}/retry/`, {
        method: 'POST',
      })
      if (result.status === 'failed') {
        throw new Error(result.last_error || 'ارسال مجدد پیام ناموفق بود.')
      }
      return result
    },
    onSuccess: (result) => {
      notify(
        result.status === 'pending'
          ? 'پیام در صف ارسال قرار گرفت.'
          : result.status === 'processing'
          ? 'پیام در حال پردازش است؛ نتیجه را کمی بعد بررسی کنید.'
          : 'ارسال مجدد انجام شد و نتیجه ثبت شد.',
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.notifications })
    },
  })

  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  return (
    <>
      <PageHeader
        title="اعلان‌های مشتریان"
        description="وضعیت پیام‌های ثبت سفارش و تغییرات مهم تعمیر را مشاهده و خطاها را دوباره ارسال کنید."
      />
      <section className="panel list-panel">
        <div className="filters">
          <SearchInput
            value={params.get('search') || ''}
            onChange={(value) => filter('search', value)}
            placeholder="نام مشتری، شماره موبایل یا کد پیگیری"
          />
          <select
            aria-label="فیلتر وضعیت اعلان"
            value={params.get('status') || ''}
            onChange={(event) => filter('status', event.target.value)}
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(statusDetails).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="فیلتر سرویس ارسال"
            value={params.get('provider') || ''}
            onChange={(event) => filter('provider', event.target.value)}
          >
            <option value="">همه سرویس‌ها</option>
            {Object.entries(providerLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="بازنشانی فیلترها"
            onClick={() => setParams({})}
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {retry.isError && <div className="panel-alert"><FormAlert error={retry.error} /></div>}

        {notifications.isPending ? (
          <Loading />
        ) : notifications.isError ? (
          <ErrorState
            error={notifications.error}
            retry={() => {
              void notifications.refetch()
            }}
          />
        ) : notifications.data.results.length ? (
          <div
            aria-busy={notifications.isFetching}
            className={notifications.isPlaceholderData ? 'refreshing' : ''}
          >
            <div className="notification-list">
              <div className="notification-list-head" aria-hidden="true">
                <span>مشتری / سفارش</span>
                <span>نوع پیام</span>
                <span>وضعیت</span>
                <span>زمان</span>
                <span />
              </div>
              <ul>
                {notifications.data.results.map((item) => {
                  const statusItem = statusDetails[item.status]
                  const retrying = retry.isPending && retry.variables === item.id
                  return (
                    <li key={item.id} className="notification-row">
                      <div className="notification-recipient">
                        <span className="notification-icon">
                          <BellRing size={19} strokeWidth={1.6} />
                        </span>
                        <div>
                          <b>{item.customer_name || 'مشتری حذف‌شده'}</b>
                          <small dir="ltr">{item.recipient}</small>
                          {item.repair_order_id && item.tracking_code && (
                            <Link to={`/app/repairs/${item.repair_order_id}`} className="text-link mono">
                              {item.tracking_code}
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="notification-event">
                        <b>{eventLabels[item.event_type] || item.event_type}</b>
                        <small>{providerLabels[item.provider] || item.provider_display}</small>
                        <p title={item.rendered_message}>{item.rendered_message}</p>
                      </div>
                      <div>
                        <span className={`badge ${statusItem.tone}`}>
                          <span className="status-dot" />
                          {statusItem.label}
                        </span>
                        <small className="notification-attempts">
                          {item.attempt_count ? `${item.attempt_count} تلاش` : 'هنوز تلاش نشده'}
                        </small>
                      </div>
                      <div className="notification-time">
                        <time>{dateTime(item.created_at)}</time>
                        {item.last_error && <small title={item.last_error}>{item.last_error}</small>}
                        {item.status === 'failed' && item.is_retryable && (
                          <small className="notification-retry-time">
                            تلاش خودکار بعدی: {dateTime(item.scheduled_at)}
                          </small>
                        )}
                      </div>
                      <div className="notification-action">
                        {item.status === 'failed' && (
                          <button
                            className="button secondary small-button"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(item.id)}
                          >
                            {retrying ? <Spinner /> : <RefreshCw size={15} />}
                            ارسال مجدد
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <Pagination
              count={notifications.data.count}
              page={page}
              busy={notifications.isFetching}
              onChange={(value) =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.set('page', String(value))
                  return next
                })
              }
            />
          </div>
        ) : (
          <EmptyState
            title="اعلانی پیدا نشد"
            description="اگر فیلتری فعال است آن را تغییر دهید؛ اعلان‌ها پس از ثبت یا تغییر وضعیت سفارش اینجا دیده می‌شوند."
          />
        )}
      </section>
    </>
  )
}
