import { OrderCustomerSection } from './OrderCustomerSection'
import { OrderDeviceSection } from './OrderDeviceSection'
import { useNavigate, Link } from 'react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ClipboardList } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Field } from '../../components/ui/Field'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'
import { request } from '../../lib/api/client'
import { keys, invalidateRepairs } from '../../lib/api/queries'
import { applyFieldErrors } from '../../lib/forms'
import { site } from '../../config/site'
import type { Repair, Staff } from '../../types/api'
import { defaultOrder, orderPayload, orderSchema, type OrderValues } from './orderSchema'
export default function CreateRepairPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const form = useForm<OrderValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: defaultOrder,
  })
  const errors = form.formState.errors
  const staff = useQuery({
    queryKey: keys.staff,
    queryFn: ({ signal }) => request<Staff[]>('accounts/', { signal }),
  })
  const create = useMutation({
    mutationFn: (data: OrderValues) =>
      request<Repair>('repairs/', { method: 'POST', body: orderPayload(data) }),
    onSuccess: async (repair) => {
      await invalidateRepairs()
      toast('سفارش پذیرش شد. کد پیگیری آماده است.')
      navigate(`/app/repairs/${repair.id}`)
    },
    onError: (error) => applyFieldErrors(error, form.setError, { final_amount: 'amount' }),
  })
  return (
    <>
      <PageHeader
        title="پذیرش دستگاه"
        description="مشتری، دستگاه و جزئیات پذیرش؛ کوتاه و یک‌جا."
        action={
          <Link to="/app/repairs" className="button secondary">
            بازگشت به سفارش‌ها
          </Link>
        }
      />
      <FormProvider {...form}>
        <form
          className="order-create"
          onSubmit={form.handleSubmit((data) => create.mutate(data))}
          noValidate
        >
          <div className="form-sections">
            <OrderCustomerSection />
            <OrderDeviceSection />
          </div>
          <aside className="panel order-summary">
            <div className="form-section-title">
              <ClipboardList size={20} />
              <h2>۳. جزئیات پذیرش</h2>
            </div>
            <Field label="شرح مشکل دستگاه" error={errors.issue_description?.message}>
              <textarea
                {...form.register('issue_description')}
                rows={4}
                placeholder="مشکل اعلام‌شده توسط مشتری و نکات پذیرش…"
              />
            </Field>
            <Field label="تعمیرکار مسئول (اختیاری)" error={errors.assigned_technician_id?.message}>
              <select
                {...form.register('assigned_technician_id')}
                disabled={staff.isPending || staff.isError}
              >
                <option value="">بدون تخصیص</option>
                {staff.data
                  ?.filter((person) => person.role === 3 && person.is_active)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.username}
                    </option>
                  ))}
              </select>
            </Field>
            {staff.isError && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  void staff.refetch()
                }}
              >
                تلاش دوباره برای دریافت تعمیرکاران
              </button>
            )}
            <Field
              label={`مبلغ نهایی (${site.currency})`}
              hint="اگر مبلغ مشخص نیست، خالی بگذارید."
              error={errors.amount?.message}
            >
              <input {...form.register('amount')} dir="ltr" inputMode="numeric" />
            </Field>
            <label className="checkbox">
              <input type="checkbox" {...form.register('is_paid')} />
              پرداخت حضوری انجام شده است
            </label>
            <p className="notice">
              سفارش با وضعیت «پذیرش اولیه» ثبت می‌شود. زمان دریافت دستگاه را پس از ثبت، در جزئیات
              سفارش مشخص کنید.
            </p>
            <FormAlert error={create.error} />
            <button className="button full" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : <Check size={18} />}ثبت و دریافت کد پیگیری
            </button>
          </aside>
        </form>
      </FormProvider>
    </>
  )
}
