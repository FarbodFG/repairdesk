import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Field } from '../../components/ui/Field'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../auth/AuthProvider'
import { canManage } from '../../config/status'
import { site } from '../../config/site'
import { dateTime, parseAmount } from '../../lib/format'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import { applyFieldErrors } from '../../lib/forms'
import type { Repair, Staff, UpdateRepair } from '../../types/api'
import { useUpdateRepair } from './useUpdateRepair'
type EditValues = {
  issue_description: string
  amount: string
  is_paid: boolean
  assigned_technician_id: string
}
export function RepairEditForm({ repair }: { repair: Repair }) {
  const { user } = useAuth()
  const manage = canManage(user?.role)
  const update = useUpdateRepair(repair.id)
  const [pending, setPending] = useState<UpdateRepair | null>(null)
  const form = useForm<EditValues>({
    defaultValues: {
      issue_description: repair.issue_description,
      amount: repair.final_amount?.toString() || '',
      is_paid: repair.is_paid,
      assigned_technician_id: repair.assigned_technician?.id.toString() || '',
    },
  })
  const staff = useQuery({
    queryKey: keys.staff,
    queryFn: ({ signal }) => request<Staff[]>('accounts/', { signal }),
    enabled: manage,
  })
  function save(body: UpdateRepair) {
    update.mutate(body, {
      onSuccess: () => {
        form.reset(form.getValues())
        setPending(null)
      },
      onError: (error) => applyFieldErrors(error, form.setError, { final_amount: 'amount' }),
    })
  }
  function submit(values: EditValues) {
    let amount: number | null
    try {
      amount = parseAmount(values.amount)
      if (values.is_paid && amount === null)
        throw new Error('برای ثبت پرداخت، مبلغ نهایی لازم است.')
    } catch (error) {
      form.setError('amount', { message: (error as Error).message })
      return
    }
    const dirty = form.formState.dirtyFields
    const body: UpdateRepair = {
      ...(dirty.issue_description ? { issue_description: values.issue_description } : {}),
      ...(dirty.amount ? { final_amount: amount } : {}),
      ...(dirty.is_paid ? { is_paid: values.is_paid } : {}),
      ...(manage && dirty.assigned_technician_id
        ? {
            assigned_technician_id: values.assigned_technician_id
              ? Number(values.assigned_technician_id)
              : null,
          }
        : {}),
    }
    if (!Object.keys(body).length) return
    if (dirty.is_paid || (repair.is_paid && dirty.amount)) setPending(body)
    else save(body)
  }
  return (
    <section className="panel">
      <h2>جزئیات و پرداخت</h2>
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <Field
          label="شرح مشکل و یادداشت پذیرش"
          error={form.formState.errors.issue_description?.message}
        >
          <textarea {...form.register('issue_description')} rows={4} />
        </Field>
        {manage && (
          <Field
            label="تعمیرکار مسئول"
            error={form.formState.errors.assigned_technician_id?.message}
          >
            <select
              {...form.register('assigned_technician_id')}
              disabled={staff.isPending || staff.isError}
            >
              <option value="">بدون تخصیص</option>
              {repair.assigned_technician &&
                !staff.data?.some(
                  (person) => person.id === repair.assigned_technician?.id && person.is_active,
                ) && (
                  <option value={repair.assigned_technician.id}>
                    {repair.assigned_technician.username} (فعلی)
                  </option>
                )}
              {staff.data
                ?.filter((person) => person.role === 3 && person.is_active)
                .map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.username}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {manage && staff.isError && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              void staff.refetch()
            }}
          >
            دریافت دوباره تعمیرکاران
          </button>
        )}
        <Field
          label={`مبلغ نهایی (${site.currency})`}
          error={form.formState.errors.amount?.message}
        >
          <input {...form.register('amount')} inputMode="numeric" dir="ltr" />
        </Field>
        <label className="checkbox">
          <input type="checkbox" {...form.register('is_paid')} />
          پرداخت حضوری انجام شده است
        </label>
        <p className="small muted">زمان ثبت پرداخت: {dateTime(repair.paid_at)}</p>
        <FormAlert error={update.error} />
        <div className="form-actions">
          <button className="button" disabled={update.busy || !form.formState.isDirty}>
            {update.busy ? <Spinner /> : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
      <Modal
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !update.busy) setPending(null)
        }}
        title="تأیید تغییر اطلاعات پرداخت"
        description="این تغییر روی مبلغ یا وضعیت پرداخت ثبت‌شده سفارش اثر می‌گذارد."
      >
        <p>پرداخت از طریق این سامانه انجام نمی‌شود؛ فقط نتیجه پرداخت حضوری ثبت خواهد شد.</p>
        <FormAlert error={update.error} />
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={update.busy}
            onClick={() => setPending(null)}
          >
            بازگشت
          </button>
          <button
            className="button"
            disabled={update.busy}
            onClick={() => {
              if (pending) save(pending)
            }}
          >
            تأیید و ذخیره
          </button>
        </div>
      </Modal>
    </section>
  )
}
