import { Field } from '../../components/ui/Field'
import type { CustomerValues } from './customerSchema'
export function CustomerFields({
  values,
  onChange,
  errors = {},
}: {
  values: CustomerValues
  onChange: (key: keyof CustomerValues, value: string) => void
  errors?: Partial<Record<keyof CustomerValues, string>>
}) {
  return (
    <div className="form-grid">
      <div className="span-all">
        <Field label="نام و نام خانوادگی مشتری" error={errors.name}>
          <input
            autoComplete="name"
            maxLength={100}
            value={values.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
        </Field>
      </div>
      <Field label="شماره موبایل" error={errors.phone_number}>
        <input
          type="tel"
          autoComplete="tel-national"
          dir="ltr"
          value={values.phone_number}
          maxLength={11}
          onChange={(e) => onChange('phone_number', e.target.value)}
        />
      </Field>
      <Field label="شماره تماس دوم (اختیاری)" error={errors.available_phone_number}>
        <input
          type="tel"
          dir="ltr"
          maxLength={11}
          value={values.available_phone_number}
          onChange={(e) => onChange('available_phone_number', e.target.value)}
        />
      </Field>
    </div>
  )
}
