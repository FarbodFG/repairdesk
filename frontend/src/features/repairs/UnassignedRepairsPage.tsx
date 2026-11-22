import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UserRoundCheck } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState, ErrorState, FormAlert, Loading, Spinner } from '../../components/ui/Feedback'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useToast } from '../../components/ui/Toast'
import { request } from '../../lib/api/client'
import { ApiError } from '../../lib/api/errors'
import { invalidateRepairs, keys } from '../../lib/api/queries'
import { dateTime } from '../../lib/format'
import type { Page, RepairStatus } from '../../types/api'

interface UnassignedRepair {
  id: number
  device_name: string
  repair_status: RepairStatus
  created_at: string
}

export default function UnassignedRepairsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const requestedPage = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const orders = useQuery({
    queryKey: [...keys.repairs, 'unassigned', page],
    queryFn: ({ signal }) => request<Page<UnassignedRepair>>(`repairs/unassigned/?page=${page}`, { signal }),
  })
  const claim = useMutation({
    mutationFn: (id: number) => request<void>(`repairs/${id}/claim/`, { method: 'POST' }),
    onSuccess: () => invalidateRepairs(),
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        setParams({}, { replace: true })
        void invalidateRepairs()
      }
    },
  })

  function assignToMe(id: number) {
    claim.mutate(id, {
      onSuccess: () => {
        toast('سفارش به نام شما ثبت شد.')
        void navigate(`/app/repairs/${id}`)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="سفارش‌های بدون مسئول"
        description="با پذیرش مسئولیت، سفارش به فهرست کارهای شما اضافه می‌شود."
        action={<Link to="/app/repairs" className="button secondary">بازگشت به سفارش‌ها</Link>}
      />
      <section className="panel list-panel">
        <FormAlert error={claim.error} />
        {orders.isPending ? (
          <Loading />
        ) : orders.isError ? (
          <ErrorState error={orders.error} retry={() => {
            if (page === 1) void orders.refetch()
            else setParams({})
          }} />
        ) : orders.data.count === 0 ? (
          <EmptyState title="سفارش بدون مسئول وجود ندارد" description="سفارش‌های فعال پس از ثبت بدون مسئول در این بخش نمایش داده می‌شوند." />
        ) : (
          <>
            <ul className="claim-list" aria-label="سفارش‌های قابل پذیرش">
              {orders.data.results.map((order) => (
                <li key={order.id}>
                  <div className="claim-device">
                    <bdi>{order.device_name || 'دستگاه بدون مدل ثبت‌شده'}</bdi>
                    <small>{dateTime(order.created_at)}</small>
                  </div>
                  <StatusBadge status={order.repair_status} />
                  <button type="button" className="button secondary" disabled={claim.isPending} onClick={() => assignToMe(order.id)}>
                    {claim.isPending && claim.variables === order.id ? <Spinner /> : <UserRoundCheck size={17} aria-hidden="true" />}
                    پذیرش مسئولیت
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              count={orders.data.count}
              page={page}
              busy={orders.isFetching || claim.isPending}
              onChange={(next) => setParams(next === 1 ? {} : { page: String(next) })}
            />
          </>
        )}
      </section>
    </>
  )
}
