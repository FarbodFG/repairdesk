import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { Page, Repair, RepairStatus } from '../../types/api'
import { statuses } from '../../config/status'
import { number } from '../../lib/format'
import { WorkspaceWelcome } from './WorkspaceWelcome'
import { Loading, ErrorState } from '../../components/ui/Feedback'
import { RepairTable } from '../repairs/RepairTable'
const workOrder: RepairStatus[] = [4, 2, 3, 1, 5]
export function TechnicianHome() {
  const { user } = useAuth()
  const [selectedStatus, setSelectedStatus] = useState<RepairStatus>(4)
  const groups = useQueries({
    queries: workOrder.map((status) => ({
      queryKey: keys.repairList(`status=${status}&page_size=3`),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        request<Page<Repair>>(`repairs/?status=${status}&page_size=3`, { signal }),
    })),
  })
  const selected = statuses[selectedStatus]
  const group = groups[workOrder.indexOf(selectedStatus)]
  return (
    <>
      <WorkspaceWelcome
        title={`میز کار ${user?.first_name || user?.username}`}
        description="کارهای تخصیص‌یافته به خودتان را بر اساس مرحلهٔ تعمیر دنبال کنید."
      >
        <Link className="button" to="/app/repairs">
          همه سفارش‌های من <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        <Link className="button secondary" to="/app/repairs/unassigned">سفارش‌های بدون مسئول</Link>
      </WorkspaceWelcome>
      <div className="technician-work">
        <div className="work-queues" role="group" aria-label="مرحله تعمیر">
          {workOrder.map((status, index) => (
            <button key={status} type="button" aria-pressed={selectedStatus === status} onClick={() => setSelectedStatus(status)}>
              <span className={`queue-dot ${statuses[status].tone}`} aria-hidden="true" />
              {statuses[status].label}
              {groups[index].data && <span className="count-pill">{number(groups[index].data.count)}</span>}
            </button>
          ))}
        </div>
          <section className="panel list-panel" key={selectedStatus}>
            <div className="panel-heading">
              <h2>
                {selected.label}{' '}
                {group.data && <span className="count-pill">{number(group.data.count)}</span>}
              </h2>
              <Link className="text-link" to={`/app/repairs?status=${selectedStatus}`}>
                مشاهده همه <ArrowLeft size={15} aria-hidden="true" />
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
      </div>
    </>
  )
}
