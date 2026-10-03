import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Field } from '../../components/ui/Field'
import { ErrorState } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { OrderValues } from './orderSchema'
import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { SearchInput } from '../../components/ui/SearchInput'
import { CustomerFields } from '../customers/CustomerFields'
import type { Customer } from '../../types/api'
export function OrderCustomerSection() {
  const [search, setSearch] = useState('')
  const form = useFormContext<OrderValues>()
  const values = form.watch()
  const errors = form.formState.errors
  const customers = useQuery({
    queryKey: keys.customerList(search),
    queryFn: ({ signal }) =>
      request<Customer[]>(`customers/?search=${encodeURIComponent(search)}`, { signal }),
    enabled: values.customerMode === 'existing',
  })
  return (
    <section className="panel">
      <div className="form-section-title">
        <UserRound size={20} />
        <h2>۱. مشتری</h2>
      </div>
      <div className="segmented" role="group" aria-label="روش انتخاب مشتری">
        <button
          type="button"
          aria-pressed={values.customerMode === 'existing'}
          onClick={() => {
            form.setValue('customerMode', 'existing')
            form.setValue('device_id', '')
          }}
        >
          مشتری قبلی
        </button>
        <button
          type="button"
          aria-pressed={values.customerMode === 'new'}
          onClick={() => {
            form.setValue('customerMode', 'new')
            form.setValue('deviceMode', 'new')
            form.setValue('device_id', '')
          }}
        >
          مشتری جدید
        </button>
      </div>
      {values.customerMode === 'new' ? (
        <CustomerFields
          values={values.new_customer}
          onChange={(key, value) => form.setValue(`new_customer.${key}`, value)}
          errors={{
            name: errors.new_customer?.name?.message,
            phone_number: errors.new_customer?.phone_number?.message,
            available_phone_number: errors.new_customer?.available_phone_number?.message,
          }}
        />
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              form.setValue('customer_id', '')
              form.setValue('device_id', '')
            }}
            placeholder="جست‌وجوی نام یا شماره موبایل مشتری"
            label="جست‌وجوی مشتری"
          />
          {customers.isError ? (
            <ErrorState
              error={customers.error}
              retry={() => {
                void customers.refetch()
              }}
            />
          ) : (
            <Field label="انتخاب مشتری" error={errors.customer_id?.message}>
              <select
                {...form.register('customer_id', {
                  onChange: () => form.setValue('device_id', ''),
                })}
                disabled={customers.isPending}
              >
                <option value="">
                  {customers.isPending ? 'در حال دریافت…' : 'مشتری را انتخاب کنید'}
                </option>
                {customers.data?.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} — {customer.phone_number}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
    </section>
  )
}
