import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowRight, Trash2, History, Smartphone } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { CopyButton } from '../../components/ui/CopyButton'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, ErrorState, FormAlert, Loading } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys, invalidateRepairs } from '../../lib/api/queries'
import { ApiError } from '../../lib/api/errors'
import { dateTime, deviceName } from '../../lib/format'
import { canManage, statuses } from '../../config/status'
import { useAuth } from '../auth/AuthProvider'
import type { Repair, RepairHistory } from '../../types/api'
import { StatusPanel } from './StatusPanel'
import { ReceiptPanel } from './ReceiptPanel'
import { RepairEditForm } from './RepairEditForm'
export default function RepairDetailPage() {
  const { id: raw } = useParams()
  const id = Number(raw)
  const valid = Number.isSafeInteger(id) && id > 0
  const { user } = useAuth()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const detail = useQuery({
    queryKey: keys.repair(id),
    queryFn: ({ signal }) => request<Repair>(`repairs/${id}/`, { signal }),
    enabled: valid,
  })
  const history = useQuery({
    queryKey: keys.history(id),
    queryFn: ({ signal }) => request<RepairHistory[]>(`repairs/${id}/history/`, { signal }),
    enabled: valid,
  })
  const remove = useMutation({
    mutationFn: () => request(`repairs/${id}/`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidateRepairs()
      navigate('/app/repairs')
    },
  })
  if (!valid) return <ErrorState error={new ApiError(404)} />
  if (detail.isPending) return <Loading />
  if (detail.isError)
    return (
      <ErrorState
        error={detail.error}
        retry={() => {
          void detail.refetch()
        }}
      />
    )
  const repair = detail.data
  const manage = canManage(user?.role)
  return (
    <>
      <PageHeader
        title="پرونده تعمیر"
        description={`ثبت‌شده در ${dateTime(repair.created_at)}`}
        action={
          <Link className="button secondary" to="/app/repairs">
            <ArrowRight size={17} />
            سفارش‌ها
          </Link>
        }
      />
      <section className="repair-identity panel">
        <div className="row">
          <span className="device-icon large">
            <Smartphone size={30} strokeWidth={1.2} />
          </span>
          <div>
            <h2>{deviceName(repair.device)}</h2>
            <div className="row">
              <bdi className="mono">{repair.tracking_code}</bdi>
              <CopyButton value={repair.tracking_code} label="کپی کد پیگیری" />
            </div>
          </div>
        </div>
        <div>
          <small className="muted">مشتری</small>
          <p>
            {manage ? (
              <Link className="text-link" to={`/app/customers/${repair.customer.id}`}>
                {repair.customer.name}
              </Link>
            ) : (
              repair.customer.name
            )}
          </p>
        </div>
        <div>
          <small className="muted">شماره تماس</small>
          <div className="row">
            <a href={`tel:${repair.customer.phone_number}`} dir="ltr">
              {repair.customer.phone_number}
            </a>
            <CopyButton value={repair.customer.phone_number} label="کپی شماره تماس" />
          </div>
        </div>
        <div>
          <small className="muted">تعمیرکار</small>
          <p>{repair.assigned_technician?.username || 'تخصیص داده نشده'}</p>
        </div>
      </section>
      <div className="detail-grid">
        <div className="detail-main">
          <StatusPanel repair={repair} />
          <RepairEditForm
            key={`${repair.id}-${repair.issue_description}-${repair.final_amount}-${repair.is_paid}-${repair.assigned_technician?.id}`}
            repair={repair}
          />
          <section className="panel">
            <div className="panel-title">
              <h2>تاریخچه تغییر وضعیت</h2>
              <History size={21} />
            </div>
            {history.isPending ? (
              <Loading />
            ) : history.isError ? (
              <ErrorState
                error={history.error}
                retry={() => {
                  void history.refetch()
                }}
              />
            ) : history.data.length ? (
              <ol className="history-list">
                {history.data.map((item) => (
                  <li key={item.id}>
                    <span className="history-node" />
                    <div>
                      <p>
                        {statuses[item.repair_previous_status].label}{' '}
                        <span className="muted">←</span>{' '}
                        <b>{statuses[item.repair_new_status].label}</b>
                      </p>
                      <small>
                        {item.modifier_name} ·{' '}
                        <time dateTime={item.modified_at}>{dateTime(item.modified_at)}</time>
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="هنوز تغییر وضعیتی ثبت نشده"
                description="اولین تغییر وضعیت در این بخش ثبت خواهد شد."
              />
            )}
          </section>
        </div>
        <aside>
          <ReceiptPanel repair={repair} />
          <section className="panel help-panel">
            <h3>رسید و پیگیری</h3>
            <p>
              کد پیگیری را در اختیار مشتری قرار دهید. اطلاعات داخلی این پرونده در صفحه عمومی نمایش
              داده نمی‌شود.
            </p>
            <Link to="/track" state={{ code: repair.tracking_code }} className="text-link">
              مشاهده پیگیری عمومی
            </Link>
          </section>
          {manage &&
            repair.repair_status === 1 &&
            history.isSuccess &&
            history.data.length === 0 && (
              <button className="button delete-order" onClick={() => setConfirm(true)}>
                <Trash2 size={17} />
                حذف پذیرش اشتباه
              </button>
            )}
        </aside>
      </div>
      <Modal
        open={confirm}
        onOpenChange={(open) => {
          if (!remove.isPending) setConfirm(open)
        }}
        title="حذف سفارش"
        description="فقط سفارش بدون تاریخچه قابل حذف است. این عملیات قابل بازگشت نیست."
      >
        <FormAlert error={remove.error} />
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={remove.isPending}
            onClick={() => setConfirm(false)}
          >
            بازگشت
          </button>
          <button
            className="button danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            تأیید حذف سفارش
          </button>
        </div>
      </Modal>
    </>
  )
}
