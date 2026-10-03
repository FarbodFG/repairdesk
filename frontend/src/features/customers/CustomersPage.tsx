import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, ChevronLeft, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { CopyButton } from '../../components/ui/CopyButton'
import { Loading, ErrorState, EmptyState } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import { number } from '../../lib/format'
import type { Customer } from '../../types/api'
import { CreateCustomerForm } from './CreateCustomerForm'
export default function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('search') || ''
  const [open, setOpen] = useState(false)
  const customers = useQuery({
    queryKey: keys.customerList(search),
    queryFn: ({ signal }) =>
      request<Customer[]>(`customers/?search=${encodeURIComponent(search)}`, { signal }),
  })
  return (
    <>
      <PageHeader
        title="مشتریان و دستگاه‌ها"
        description="اطلاعات تماس، دستگاه‌ها و سابقه هر مشتری."
        action={
          <button className="button" onClick={() => setOpen(true)}>
            <Plus size={18} />
            مشتری جدید
          </button>
        }
      />
      <section className="panel list-panel">
        <div className="filters">
          <SearchInput
            value={search}
            onChange={(value) => setParams(value ? { search: value } : {})}
            placeholder="جست‌وجوی نام یا شماره موبایل"
          />
          {customers.data && (
            <span className="muted small">{number(customers.data.length)} مشتری</span>
          )}
        </div>
        {customers.isPending ? (
          <Loading />
        ) : customers.isError ? (
          <ErrorState
            error={customers.error}
            retry={() => {
              void customers.refetch()
            }}
          />
        ) : customers.data.length ? (
          <ul className="customer-list">
            {customers.data.map((customer) => (
              <li key={customer.id}>
                <span className="avatar">
                  <UserRound size={19} />
                </span>
                <div>
                  <Link className="customer-name" to={`/app/customers/${customer.id}`}>
                    {customer.name}
                  </Link>
                  <div className="row">
                    <a href={`tel:${customer.phone_number}`} dir="ltr" className="small muted">
                      {customer.phone_number}
                    </a>
                    <CopyButton
                      value={customer.phone_number}
                      label={`کپی شماره ${customer.name}`}
                    />
                  </div>
                </div>
                <Link className="text-link" to={`/app/customers/${customer.id}`}>
                  پرونده مشتری <ChevronLeft size={16} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="مشتری پیدا نشد"
            description="جست‌وجو را تغییر دهید یا مشتری جدید ثبت کنید."
          />
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="ثبت مشتری جدید"
        description="اطلاعات تماس مشتری را برای ثبت و پیگیری تعمیر وارد کنید."
      >
        {open && <CreateCustomerForm onSuccess={() => setOpen(false)} />}
      </Modal>
    </>
  )
}
