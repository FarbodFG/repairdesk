import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Field } from '../../components/ui/Field'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../auth/AuthProvider'
import { canManage } from '../../config/status'
import { dateTime, parseAmount } from '../../lib/format'
import { applyFieldErrors } from '../../lib/forms'
import type { Repair, UpdateRepair } from '../../types/api'
import { useUpdateRepair } from './useUpdateRepair'
import { MoneyField } from './MoneyField'
import { RepairAssigneeField } from './RepairAssigneeField'
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
    const dirty = form.formState.dirtyFields
    let amount: number | null = null
    try {
      if (dirty.amount || dirty.is_paid) {
        amount = parseAmount(values.amount)
        if (values.is_paid && amount === null)
          throw new Error('برای ثبت پرداخت، مبلغ نهایی لازم است.')
      }
    } catch (error) {
      form.setError('amount', { message: (error as Error).message })
      return
    }
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
          <RepairAssigneeField
            registration={form.register('assigned_technician_id')}
            current={repair.assigned_technician}
            error={form.formState.errors.assigned_technician_id?.message}
          />
        )}
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
