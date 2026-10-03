import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Smartphone } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Modal } from '../../components/ui/Modal'
import { CopyButton } from '../../components/ui/CopyButton'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Loading, ErrorState, EmptyState } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import { ApiError } from '../../lib/api/errors'
import { dateTime, deviceName, money } from '../../lib/format'
import type { Customer, CustomerRepairHistory, Device, Page } from '../../types/api'
import { AddDeviceForm } from '../devices/AddDeviceForm'
export default function CustomerDetailPage() {
  const { id: raw } = useParams()
  const id = Number(raw)
  const valid = Number.isSafeInteger(id) && id > 0
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [open, setOpen] = useState(false)
  const customers = useQuery({
    queryKey: keys.customerList(''),
    queryFn: ({ signal }) => request<Customer[]>('customers/', { signal }),
    enabled: valid,
  })
  const devices = useQuery({
    queryKey: keys.devices(id),
    queryFn: ({ signal }) => request<Device[]>(`customers/${id}/devices/`, { signal }),
    enabled: valid,
  })
  const history = useQuery({
    queryKey: keys.customerHistory(id, page),
    queryFn: ({ signal }) =>
      request<Page<CustomerRepairHistory>>(`customers/${id}/repairs/?page=${page}`, { signal }),
    enabled: valid,
  })
  if (!valid) return <ErrorState error={new ApiError(404)} />
  if (customers.isPending) return <Loading />
  if (customers.isError)
    return (
      <ErrorState
        error={customers.error}
        retry={() => {
          void customers.refetch()
        }}
      />
    )
  const customer = customers.data.find((item) => item.id === id)
  if (!customer) return <ErrorState error={new ApiError(404)} />
  return (
    <>
      <PageHeader
        title={customer.name}
        description={`مشتری از ${dateTime(customer.created_at)}`}
        action={
          <Link className="button secondary" to="/app/customers">
            بازگشت به مشتریان
          </Link>
        }
      />
      <div className="customer-detail-grid">
        <aside className="panel customer-contact">
          <h2>اطلاعات تماس</h2>
          <dl className="details-list">
            <div>
              <dt>شماره موبایل</dt>
              <dd className="row">
                <a href={`tel:${customer.phone_number}`} dir="ltr">
                  {customer.phone_number}
                </a>
                <CopyButton value={customer.phone_number} />
              </dd>
            </div>
            <div>
              <dt>شماره دوم</dt>
              <dd>
                {customer.available_phone_number ? (
                  <div className="row">
                    <a href={`tel:${customer.available_phone_number}`} dir="ltr">
                      {customer.available_phone_number}
                    </a>
                    <CopyButton value={customer.available_phone_number} />
                  </div>
                ) : (
                  'ثبت نشده'
                )}
              </dd>
            </div>
          </dl>
          <p className="small muted">ویرایش اطلاعات مشتری در API فعلی ارائه نشده است.</p>
        </aside>
        <section className="panel">
          <div className="panel-title">
            <h2>دستگاه‌های مشتری</h2>
            <button className="button secondary small-button" onClick={() => setOpen(true)}>
              <Plus size={16} />
              دستگاه جدید
            </button>
          </div>
          {devices.isPending ? (
            <Loading />
          ) : devices.isError ? (
            <ErrorState
              error={devices.error}
              retry={() => {
                void devices.refetch()
              }}
            />
          ) : devices.data.length ? (
            <ul className="customer-devices">
              {devices.data.map((device) => (
                <li key={device.id}>
                  <span className="device-icon">
                    <Smartphone size={22} />
                  </span>
                  <div>
                    <b>{deviceName(device)}</b>
                    <small>ثبت: {dateTime(device.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="دستگاهی ثبت نشده" />
          )}
        </section>
      </div>
      <section className="panel list-panel">
        <div className="panel-heading">
          <h2>سابقه تعمیرها</h2>
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
        ) : (
          <>
            {history.data.results.length ? (
              <ul className="customer-history">
                {history.data.results.map((repair) => (
                  <li key={repair.id}>
                    <div>
                      <Link to={`/app/repairs/${repair.id}`}>
                        <b>{repair.device_name}</b>
                      </Link>
                      <small>
                        <bdi className="mono">{repair.tracking_code}</bdi> ·{' '}
                        {dateTime(repair.created_at)}
                      </small>
                    </div>
                    <StatusBadge status={repair.repair_status} />
                    <span>{money(repair.final_amount)}</span>
                    <Link className="text-link" to={`/app/repairs/${repair.id}`}>
                      جزئیات
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="سابقه تعمیری وجود ندارد" />
            )}
            <Pagination
              page={page}
              count={history.data.count}
              onChange={(value) => setParams({ page: String(value) })}
            />
          </>
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="افزودن دستگاه"
        description={`ثبت یک دستگاه برای ${customer.name}`}
      >
        {open && <AddDeviceForm customerId={id} onSuccess={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
