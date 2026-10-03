import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Field } from '../../components/ui/Field'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../auth/AuthProvider'
import { request } from '../../lib/api/client'
import { keys, queryClient } from '../../lib/api/queries'
import { applyFieldErrors } from '../../lib/forms'
import { roles } from '../../config/status'
import type { Role, Staff, StaffInput, StaffUpdateResponse } from '../../types/api'
function schema(edit: boolean) {
  return z
    .object({
      username: z
        .string()
        .trim()
        .min(1, 'نام کاربری لازم است.')
        .max(150, 'حداکثر ۱۵۰ کاراکتر.')
        .regex(/^[\p{L}\p{N}_@.+-]+$/u, 'نام کاربری فقط شامل حروف، اعداد و @ . + - _ باشد.'),
      email: z.union([z.email('ایمیل معتبر وارد کنید.'), z.literal('')]),
      role: z.enum(['1', '2', '3'], 'نقش را انتخاب کنید.'),
      is_active: z.boolean(),
      password: z.string(),
    })
    .superRefine((data, ctx) => {
      if ((!edit || data.password) && (data.password.length < 8 || /^\d+$/.test(data.password)))
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'رمز باید دست‌کم ۸ کاراکتر باشد و فقط عدد نباشد.',
        })
    })
}
type StaffValues = {
  username: string
  email: string
  role: '1' | '2' | '3'
  is_active: boolean
  password: string
}
export function StaffForm({ staff, onSuccess }: { staff: Staff | null; onSuccess: () => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const form = useForm<StaffValues>({
    resolver: zodResolver(schema(!!staff)),
    defaultValues: {
      username: staff?.username || '',
      email: staff?.email || '',
      role: String(staff?.role || 3) as StaffValues['role'],
      is_active: staff?.is_active ?? true,
      password: '',
    },
  })
  const mutation = useMutation<Staff | StaffUpdateResponse, Error, StaffValues>({
    mutationFn: (values: StaffValues) => {
      const body: StaffInput = {
        username: values.username,
        email: values.email,
        role: Number(values.role) as Role,
        is_active: values.is_active,
        ...(!staff
          ? { password: values.password }
          : values.password
            ? { new_password: values.password }
            : {}),
      }
      return staff
        ? request<StaffUpdateResponse>(`accounts/${staff.id}/`, { method: 'PATCH', body })
        : request<Staff>('accounts/', { method: 'POST', body })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.staff }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
      ])
      toast(staff ? 'اطلاعات کارمند ذخیره شد.' : 'کارمند جدید ثبت شد.')
      onSuccess()
    },
    onError: (error) => applyFieldErrors(error, form.setError, { new_password: 'password' }),
  })
  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      {staff?.id === user?.id && (
        <p className="notice">
          در حال ویرایش حساب خودتان هستید. تغییر نقش یا غیرفعال‌کردن، دسترسی شما را تغییر می‌دهد.
        </p>
      )}
      <Field label="نام کاربری" error={form.formState.errors.username?.message}>
        <input {...form.register('username')} dir="ltr" autoComplete="off" />
      </Field>
      <Field label="ایمیل (اختیاری)" error={form.formState.errors.email?.message}>
        <input type="email" {...form.register('email')} dir="ltr" />
      </Field>
      <Field label="نقش" error={form.formState.errors.role?.message}>
        <select {...form.register('role')}>
          {([1, 2, 3] as Role[]).map((role) => (
            <option key={role} value={role}>
              {roles[role]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={staff ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'}
        error={form.formState.errors.password?.message}
        hint={
          staff
            ? 'برای حفظ رمز فعلی، این فیلد را خالی بگذارید.'
            : 'حداقل ۸ کاراکتر؛ از رمزهای رایج استفاده نکنید.'
        }
      >
        <input
          type="password"
          {...form.register('password')}
          dir="ltr"
          autoComplete="new-password"
        />
      </Field>
      <label className="checkbox">
        <input type="checkbox" {...form.register('is_active')} />
        حساب فعال باشد
      </label>
      <FormAlert error={mutation.error} />
      <div className="form-actions">
        <button className="button" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : 'ذخیره اطلاعات'}
        </button>
      </div>
    </form>
  )
}
