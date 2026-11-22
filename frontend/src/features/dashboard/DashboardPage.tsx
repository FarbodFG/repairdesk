import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ArrowUpLeft, Plus, Wrench, PackageCheck, Wallet, ClipboardList, Activity, Package } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { DashboardSummary, Page, Repair } from '../../types/api'
import { money, number } from '../../lib/format'
import { statusIds, statuses } from '../../config/status'
import { Loading, ErrorState } from '../../components/ui/Feedback'
import { RepairTable } from '../repairs/RepairTable'
import { TechnicianHome } from './TechnicianHome'
import { WorkspaceWelcome } from './WorkspaceWelcome'

const queues = [
  { label: 'پذیرش امروز', filter: 'scope=today', icon: ClipboardList },
  { label: 'آماده تحویل', filter: 'status=5', icon: PackageCheck },
  { label: 'منتظر قطعه', filter: 'status=3', icon: Package },
  { label: 'پرداخت‌های باز', filter: 'scope=unpaid', icon: Wallet },
] as const

export default function DashboardPage() {
  const { user } = useAuth()
  return user?.role === 3 ? <TechnicianHome /> : <ManagementDashboard />
}
function ManagementDashboard() {
  const { user } = useAuth()
  const [selected, setSelected] = useState(0)
  const queue = queues[selected]
  const queueQuery = `${queue.filter}&page_size=5`
  const summary = useQuery({
    queryKey: keys.summary,
    queryFn: ({ signal }) => request<DashboardSummary>('dashboard/summary/', { signal }),
  })
  const work = useQuery({
    queryKey: keys.repairList(queueQuery),
    queryFn: ({ signal }) => request<Page<Repair>>(`repairs/?${queueQuery}`, { signal }),
  })
  const data = summary.data
  const metrics = data
    ? [
        {
          label: 'سفارش‌های فعال',
          value: data.orders.active,
          icon: Wrench,
          tone: 'teal',
          filter: '?scope=active',
        },
        {
          label: 'آماده تحویل',
          value: data.orders.ready_for_delivery,
          icon: PackageCheck,
          tone: 'green',
          filter: '?status=5',
        },
        {
          label: 'پرداخت‌های باز',
          value: data.orders.unpaid,
          icon: Wallet,
          tone: 'amber',
          filter: '?scope=unpaid',
        },
        {
          label: 'پذیرش امروز',
          value: data.orders.today,
          icon: ClipboardList,
          tone: 'neutral',
          filter: '?scope=today',
        },
      ]
    : []
  return (
    <>
      <WorkspaceWelcome
        title={`سلام، ${user?.first_name || user?.username}`}
        description="سفارش‌های امروز و دستگاه‌های آمادهٔ تحویل در دسترس‌اند."
      >
        <Link to="/app/repairs/new" className="button">
          <Plus size={19} aria-hidden="true" /> پذیرش دستگاه
        </Link>
        <Link to="/app/repairs" className="button secondary">
          فهرست سفارش‌ها <ArrowLeft size={17} aria-hidden="true" />
        </Link>
      </WorkspaceWelcome>
      {summary.isPending ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorState
          error={summary.error}
          retry={() => {
            void summary.refetch()
          }}
        />
      ) : (
        <div className="metric-grid" aria-label="خلاصه سفارش‌ها">
          {metrics.map((metric) => (
            <Link className={`metric ${metric.tone}`} key={metric.label} to={`/app/repairs${metric.filter}`}>
              <div className="metric-label">
                <span className="metric-icon"><metric.icon size={20} aria-hidden="true" /></span>
                <span>{metric.label}</span>
              </div>
              <div className="metric-bottom"><strong>{number(metric.value)}</strong><ArrowUpLeft size={16} aria-hidden="true" /></div>
            </Link>
          ))}
        </div>
      )}
      <section className="panel list-panel dashboard-queue" aria-labelledby="dashboard-queue-title">
        <div className="panel-heading">
          <h2 id="dashboard-queue-title">صف کار تعمیرگاه</h2>
          <Link to="/app/repairs" className="text-link">همه سفارش‌ها <ArrowLeft size={16} aria-hidden="true" /></Link>
        </div>
        <div className="dashboard-queue-filters" role="group" aria-label="فیلتر صف کار">
          {queues.map(({ label, icon: Icon, filter }, index) => (
            <button type="button" aria-pressed={selected === index} key={filter} onClick={() => setSelected(index)}>
              <Icon size={18} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div className="dashboard-queue-results" key={queue.filter} aria-busy={work.isPending}>
          {work.isPending ? (
            <Loading />
          ) : work.isError ? (
            <ErrorState error={work.error} retry={() => void work.refetch()} />
          ) : (
            <>
              <RepairTable repairs={work.data.results} />
              {work.data.count > 0 && (
                <div className="dashboard-queue-footer">
                  <span>{number(work.data.count)} سفارش</span>
                  <Link to={`/app/repairs?${queue.filter}`} className="text-link">
                    مشاهده فهرست «{queue.label}» <ArrowLeft size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {data && (
        <div className="dashboard-middle">
          <section className="panel status-overview">
            <div className="dashboard-card-heading">
              <div><h2>جریان سفارش‌ها</h2><p>{number(data.orders.total)} سفارش ثبت‌شده</p></div>
              <span className="dashboard-card-icon"><Activity size={20} aria-hidden="true" /></span>
            </div>
            <div className="status-bars">
              {statusIds.map((id) => {
                const count =
                  data.status_counts[statuses[id].key as keyof DashboardSummary['status_counts']]
                return (
                  <Link to={`/app/repairs?status=${id}`} key={id}>
                    <span>{statuses[id].label}</span>
                    <div className="bar-track" aria-hidden="true">
                      <div
                        style={{
                          width: `${data.orders.total ? (count / data.orders.total) * 100 : 0}%`,
                        }}
                        className={`bar-fill ${statuses[id].tone}`}
                      />
                    </div>
                    <b>{number(count)}</b>
                  </Link>
                )
              })}
            </div>
          </section>
          <section className="revenue-panel">
            <div className="dashboard-card-heading">
              <div><h2>پرداخت‌ها</h2><p>مبالغ ثبت‌شده در تعمیرگاه</p></div>
              <span className="dashboard-card-icon"><Wallet size={20} aria-hidden="true" /></span>
            </div>
            <div className="revenue-today">
              <small>دریافتی امروز</small>
              <strong>{money(data.revenue.today_paid_amount)}</strong>
            </div>
            <div className="revenue-total">
              <small>مجموع پرداخت‌ها</small>
              <b>{money(data.revenue.total_paid_amount)}</b>
            </div>
            <Link className="text-link" to="/app/repairs?scope=unpaid">
              مشاهده پرداخت‌های باز <ArrowLeft size={16} aria-hidden="true" />
            </Link>
          </section>
        </div>
      )}
    </>
  )
}
