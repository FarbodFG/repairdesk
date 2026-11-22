import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ScanLine } from 'lucide-react'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/Feedback'
import { normalizeTracking } from '../../lib/format'
export const trackingSchema = z.object({
  code: z
    .string()
    .transform(normalizeTracking)
    .pipe(
      z
        .string()
        .regex(
          /^[A-Z0-9]{6,32}$/,
          'کد پیگیری درج‌شده روی رسید را با حروف و اعداد لاتین وارد کنید.',
        ),
    ),
})
export function TrackingForm({
  onTrack,
  busy = false,
  initialCode = '',
  compact = false,
  lookup = false,
  onEdit,
}: {
  onTrack: (code: string) => void
  busy?: boolean
  initialCode?: string
  compact?: boolean
  lookup?: boolean
  onEdit?: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof trackingSchema>, unknown, z.output<typeof trackingSchema>>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { code: initialCode },
  })
  return (
    <form
      className={`tracking-form ${compact ? 'compact' : ''} ${lookup ? 'lookup' : ''}`}
      onSubmit={handleSubmit((data) => onTrack(data.code))}
      noValidate
    >
      <div className="tracking-input">
        <ScanLine size={20} aria-hidden="true" />
        <Field label="کد پیگیری سفارش" error={errors.code?.message}>
          <input
            {...register('code', { onChange: onEdit })}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={lookup ? 'کد درج‌شده روی رسید…' : 'کد درج‌شده روی رسید'}
            translate="no"
            maxLength={32}
          />
        </Field>
      </div>
      <button disabled={busy} className="button" type="submit">
        {busy ? <><Spinner /> در حال بررسی…</> : <>پیگیری تعمیر <ArrowLeft size={18} aria-hidden="true" /></>}
      </button>
    </form>
  )
}
