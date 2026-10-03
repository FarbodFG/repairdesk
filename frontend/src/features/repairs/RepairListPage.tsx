import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { canManage, statusIds, statuses } from '../../config/status'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { ErrorState, Loading } from '../../components/ui/Feedback'
import { Pagination } from '../../components/ui/Pagination'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { Page, Repair, Staff } from '../../types/api'
import { RepairTable } from './RepairTable'
export default function RepairListPage() {
  const { user } = useAuth()
  const manage = canManage(user?.role)
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), page_size: '20' })
  for (const key of ['search', 'status', ...(manage ? ['technician_id'] : [])]) {
    if (params.get(key)) query.set(key, params.get(key)!)
  }
  const queryString = query.toString()
  const repairs = useQuery({
    queryKey: keys.repairList(queryString),
    queryFn: ({ signal }) => request<Page<Repair>>(`repairs/?${queryString}`, { signal }),
    placeholderData: keepPreviousData,
  })
  const staff = useQuery({
    queryKey: keys.staff,
    queryFn: ({ signal }) => request<Staff[]>('accounts/', { signal }),
    enabled: manage,
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
        title={manage ? 'سفارش‌های تعمیر' : 'سفارش‌های من'}
        description={
          manage
            ? 'از پذیرش تا تحویل؛ وضعیت هر دستگاه در یک نگاه.'
            : 'فقط سفارش‌های تخصیص‌یافته به شما نمایش داده می‌شوند.'
        }
        action={
          manage && (
            <Link className="button" to="/app/repairs/new">
              <Plus size={18} />
              پذیرش دستگاه
            </Link>
          )
        }
      />
      <section className="panel list-panel">
        <div className="filters">
          <SearchInput
            value={params.get('search') || ''}
            onChange={(value) => filter('search', value)}
            placeholder="نام مشتری، شماره تماس یا کد پیگیری"
          />
          <select
            aria-label="فیلتر وضعیت"
            value={params.get('status') || ''}
            onChange={(e) => filter('status', e.target.value)}
          >
            <option value="">همه وضعیت‌ها</option>
            {statusIds.map((id) => (
              <option key={id} value={id}>
                {statuses[id].label}
              </option>
            ))}
          </select>
          {manage && (
            <select
              aria-label="فیلتر تعمیرکار"
              value={params.get('technician_id') || ''}
              disabled={staff.isPending || staff.isError}
              onChange={(e) => filter('technician_id', e.target.value)}
            >
              <option value="">
                {staff.isError ? 'دریافت تعمیرکاران ناموفق' : 'همه تعمیرکاران'}
              </option>
              {staff.data
                ?.filter((person) => person.role === 3)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.username}
                    {!person.is_active && ' (غیرفعال)'}
                  </option>
                ))}
            </select>
          )}
          <button
            className="icon-button"
            aria-label="بازنشانی فیلترها"
            onClick={() => setParams({})}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        {staff.isError && manage && (
          <button
            className="text-link panel-inline"
            onClick={() => {
              void staff.refetch()
            }}
          >
            دریافت دوباره تعمیرکاران
          </button>
        )}
        {repairs.isPending ? (
          <Loading />
        ) : repairs.isError ? (
          <ErrorState
            error={repairs.error}
            retry={() => {
              void repairs.refetch()
            }}
          />
        ) : (
          <div
            aria-busy={repairs.isFetching}
            className={repairs.isPlaceholderData ? 'refreshing' : ''}
          >
            <RepairTable repairs={repairs.data.results} />
            <Pagination
              count={repairs.data.count}
              page={page}
              busy={repairs.isFetching}
              onChange={(value) =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous)
                  next.set('page', String(value))
                  return next
                })
              }
            />
          </div>
        )}
      </section>
    </>
  )
}
