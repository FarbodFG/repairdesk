import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { Page, Repair, RepairStatus } from '../../types/api'
import { statuses } from '../../config/status'
import { number } from '../../lib/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Loading, ErrorState } from '../../components/ui/Feedback'
import { RepairTable } from '../repairs/RepairTable'
const workOrder: RepairStatus[] = [4, 2, 3, 1, 5]
export function TechnicianHome() {
  const { user } = useAuth()
  const groups = useQueries({
    queries: workOrder.map((status) => ({
      queryKey: keys.repairList(`status=${status}&page_size=3`),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        request<Page<Repair>>(`repairs/?status=${status}&page_size=3`, { signal }),
    })),
  })
  return (
    <>
      <PageHeader
        title={`میز کار ${user?.first_name || user?.username}`}
        description="کارهای فعال شما، به ترتیب تعمیر، بررسی، انتظار قطعه و پذیرش."
        action={
          <Link className="button secondary" to="/app/repairs">
            همه سفارش‌های من <ArrowLeft size={17} />
          </Link>
        }
      />
      <div className="technician-work">
        {groups.map((group, i) => (
          <section className="panel list-panel" key={workOrder[i]}>
            <div className="panel-heading">
              <h2>
                {statuses[workOrder[i]].label}{' '}
                {group.data && <span className="count-pill">{number(group.data.count)}</span>}
              </h2>
              <Link className="text-link" to={`/app/repairs?status=${workOrder[i]}`}>
                مشاهده همه <ArrowLeft size={15} />
              </Link>
            </div>
            {group.isPending ? (
              <Loading />
            ) : group.isError ? (
              <ErrorState
                error={group.error}
                retry={() => {
                  void group.refetch()
                }}
              />
            ) : (
              <RepairTable repairs={group.data.results} />
            )}
          </section>
        ))}
      </div>
    </>
  )
}
