import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowLeft, Plus, Wrench, PackageCheck, Wallet, ClipboardList } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { DashboardSummary, Page, Repair } from '../../types/api'
import { money, number } from '../../lib/format'
import { statusIds, statuses } from '../../config/status'
import { PageHeader } from '../../components/layout/PageHeader'
import { Loading, ErrorState } from '../../components/ui/Feedback'
import { RepairTable } from '../repairs/RepairTable'
import { TechnicianHome } from './TechnicianHome'
export default function DashboardPage() {
  const { user } = useAuth()
  return user?.role === 3 ? <TechnicianHome /> : <ManagementDashboard />
}
function ManagementDashboard() {
  const { user } = useAuth()
  const summary = useQuery({
    queryKey: keys.summary,
    queryFn: ({ signal }) => request<DashboardSummary>('dashboard/summary/', { signal }),
  })
  const recent = useQuery({
    queryKey: keys.repairList('page_size=5'),
    queryFn: ({ signal }) => request<Page<Repair>>('repairs/?page_size=5', { signal }),
  })
  const data = summary.data
  const metrics = data
    ? [
        {
          label: 'سفارش‌های فعال',
          value: data.orders.active,
          icon: Wrench,
          tone: 'teal',
          filter: '',
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
          filter: '',
        },
        {
          label: 'پذیرش امروز',
          value: data.orders.today,
          icon: ClipboardList,
          tone: 'neutral',
          filter: '',
        },
      ]
    : []
  return (
    <>
      <PageHeader
        title={`سلام، ${user?.first_name || user?.username}`}
        description="یک نگاه به جریان امروز تعمیرگاه."
        action={
          <Link to="/app/repairs/new" className="button">
            <Plus size={18} />
            پذیرش دستگاه
          </Link>
        }
      />
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
        <>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <div className={`metric ${metric.tone}`} key={metric.label}>
                <div className="metric-label">
                  <span>{metric.label}</span>
                  <metric.icon size={20} />
                </div>
                <strong>{number(metric.value)}</strong>
                <span className="metric-caption">
                  {metric.label === 'پرداخت‌های باز'
                    ? 'مبلغ مشخص، پرداخت‌نشده'
                    : 'بر اساس اطلاعات ثبت‌شده'}
                </span>
              </div>
            ))}
          </div>
          <div className="dashboard-middle">
            <section className="panel status-overview">
              <h2>جریان سفارش‌ها</h2>
              <p>توزیع وضعیت {number(data!.orders.total)} سفارش ثبت‌شده</p>
              <div className="status-bars">
                {statusIds.map((id) => {
                  const count =
                    data!.status_counts[statuses[id].key as keyof DashboardSummary['status_counts']]
                  return (
                    <Link to={`/app/repairs?status=${id}`} key={id}>
                      <span>{statuses[id].label}</span>
                      <div className="bar-track">
                        <div
                          style={{
                            width: `${data!.orders.total ? (count / data!.orders.total) * 100 : 0}%`,
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
              <span className="eyebrow">نمای پرداخت‌ها</span>
              <h2>مبالغ ثبت‌شده پرداخت</h2>
              <div>
                <small>امروز</small>
                <strong>{money(data!.revenue.today_paid_amount)}</strong>
              </div>
              <div>
                <small>مجموع پرداخت‌ها</small>
                <b>{money(data!.revenue.total_paid_amount)}</b>
              </div>
              <p>پرداخت حضوری است. این مبلغ از وضعیت پرداخت ثبت‌شده سفارش‌ها محاسبه می‌شود.</p>
            </section>
          </div>
        </>
      )}
      <section className="panel list-panel">
        <div className="panel-heading">
          <div>
            <h2>آخرین پذیرش‌ها</h2>
            <p>جدیدترین دستگاه‌های ثبت‌شده در تعمیرگاه</p>
          </div>
          <Link to="/app/repairs" className="text-link">
            همه سفارش‌ها <ArrowLeft size={16} />
          </Link>
        </div>
        {recent.isPending ? (
          <Loading />
        ) : recent.isError ? (
          <ErrorState
            error={recent.error}
            retry={() => {
              void recent.refetch()
            }}
          />
        ) : (
          <RepairTable repairs={recent.data.results} />
        )}
      </section>
    </>
  )
}
