import { OrderCustomerSection } from './OrderCustomerSection'
import { OrderDeviceSection } from './OrderDeviceSection'
import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Controller, FormProvider, useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Smartphone, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Field } from '../../components/ui/Field'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'
import { request } from '../../lib/api/client'
import { ApiError } from '../../lib/api/errors'
import { invalidateRepairs } from '../../lib/api/queries'
import { applyFieldErrors } from '../../lib/forms'
import type { Repair } from '../../types/api'
import { defaultOrder, orderPayload, orderSchema, type OrderValues } from './orderSchema'
import { MoneyField } from './MoneyField'
import { RepairAssigneeField } from './RepairAssigneeField'

const steps = [
  { label: 'مشتری', icon: UserRound, fields: ['customer_id', 'new_customer'] },
  { label: 'دستگاه', icon: Smartphone, fields: ['device_id', 'new_device'] },
  { label: 'جزئیات سفارش', icon: ClipboardList, fields: ['issue_description', 'assigned_technician_id', 'amount', 'is_paid'] },
] satisfies { label: string; icon: typeof UserRound; fields: FieldPath<OrderValues>[] }[]
const fieldAliases = { final_amount: 'amount' }

export default function CreateRepairPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const sections = useRef<HTMLDivElement>(null)
  const form = useForm<OrderValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: defaultOrder,
    shouldFocusError: false,
  })
  const errors = form.formState.errors
  const create = useMutation({
    mutationFn: (data: OrderValues) =>
      request<Repair>('repairs/', { method: 'POST', body: orderPayload(data) }),
    onSuccess: async (repair) => {
      await invalidateRepairs()
      toast('سفارش پذیرش شد. کد پیگیری آماده است.')
      navigate(`/app/repairs/${repair.id}`)
    },
    onError: (error) => {
      applyFieldErrors(error, form.setError, fieldAliases)
      if (!(error instanceof ApiError)) return
      const fields = Object.keys(error.fields).map((path) => fieldAliases[path as keyof typeof fieldAliases] || path)
      const firstInvalid = steps.findIndex(({ fields: paths }) =>
        paths.some((path) => fields.some((field) => field === path || field.startsWith(`${path}.`))),
      )
      if (firstInvalid >= 0) showStep(firstInvalid, true)
    },
  })

  function showStep(index: number, invalid = false) {
    setStep(index)
    requestAnimationFrame(() => {
      const panel = sections.current?.querySelector(`[data-order-step="${index}"]`)
      const target = (invalid && panel?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')) ||
        panel?.querySelector<HTMLElement>('h2')
      target?.focus()
    })
  }

  async function nextStep() {
    const valid = await form.trigger(steps[step].fields)
    showStep(valid ? step + 1 : step, !valid)
  }

  return (
    <>
      <PageHeader
        title="پذیرش دستگاه"
        action={
          <Link to="/app/repairs" className="button secondary">
            بازگشت به سفارش‌ها
          </Link>
        }
      />
      <FormProvider {...form}>
        <form
          className="intake-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (create.isPending) return
            if (step < steps.length - 1) {
              void nextStep()
              return
            }
            void form.handleSubmit((data) => create.mutate(data), (invalid) => {
              const firstInvalid = steps.findIndex(({ fields }) =>
                fields.some((field) => field in invalid),
              )
              showStep(firstInvalid >= 0 ? firstInvalid : step, true)
            })(event)
          }}
          noValidate
        >
          <ol className="intake-steps" aria-label="مراحل پذیرش">
            {steps.map(({ label, icon: Icon }, index) => (
              <li key={label} aria-current={step === index ? 'step' : undefined}>
                <button
                  type="button"
                  disabled={index >= step || create.isPending}
                  onClick={() => showStep(index)}
                >
                  <span className="intake-step-icon">
                    {index < step ? <Check size={19} /> : <Icon size={19} />}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <div className="intake-sections" ref={sections}>
            <div hidden={step !== 0} data-order-step="0"><OrderCustomerSection /></div>
            <div hidden={step !== 1} data-order-step="1"><OrderDeviceSection /></div>
            <section hidden={step !== 2} data-order-step="2" className="panel intake-details">
              <div className="form-section-title">
                <ClipboardList size={20} aria-hidden="true" />
                <h2 tabIndex={-1}>جزئیات سفارش</h2>
              </div>
              <Field label="شرح مشکل دستگاه" error={errors.issue_description?.message}>
                <textarea
                  {...form.register('issue_description')}
                  rows={4}
                  placeholder="مشکل اعلام‌شده توسط مشتری و نکات پذیرش…"
                />
              </Field>
              <RepairAssigneeField
                registration={form.register('assigned_technician_id')}
                error={errors.assigned_technician_id?.message}
                optional
              />
              <Controller
                control={form.control}
                name="amount"
                render={({ field: { onChange, ...field }, fieldState }) => (
                  <MoneyField {...field} onValueChange={onChange} error={fieldState.error?.message} />
                )}
              />
              <label className="checkbox">
                <input type="checkbox" {...form.register('is_paid')} />
                پرداخت حضوری انجام شده است
              </label>
              <p className="notice">
                سفارش با وضعیت «پذیرش اولیه» ثبت می‌شود. زمان دریافت دستگاه را پس از ثبت، در جزئیات
                سفارش مشخص کنید.
              </p>
            </section>
            <FormAlert error={create.error} />
            <div className="intake-actions">
              {step > 0 && (
                <button type="button" className="button secondary" disabled={create.isPending} onClick={() => showStep(step - 1)}>
                  <ArrowRight size={17} aria-hidden="true" /> بازگشت
                </button>
              )}
              <button className="button" type="submit" disabled={create.isPending}>
                {step < steps.length - 1 ? (
                  <> {step === 0 ? 'ادامه به انتخاب دستگاه' : 'ادامه به جزئیات سفارش'} <ArrowLeft size={18} aria-hidden="true" /></>
                ) : (
                  <>{create.isPending ? <Spinner /> : <Check size={18} aria-hidden="true" />} ثبت و دریافت کد پیگیری</>
                )}
              </button>
            </div>
          </div>
        </form>
      </FormProvider>
    </>
  )
}
