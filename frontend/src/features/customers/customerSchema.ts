import { z } from 'zod'
import { latinDigits } from '../../lib/format'
export const customerSchema = z.object({
  name: z.string().trim().min(1, 'نام مشتری را وارد کنید.').max(100, 'نام حداکثر ۱۰۰ کاراکتر است.'),
  phone_number: z
    .string()
    .transform((value) => latinDigits(value.trim()))
    .pipe(z.string().regex(/^09\d{9}$/, 'شماره موبایل باید ۱۱ رقم باشد و با 09 شروع شود.')),
  available_phone_number: z
    .string()
    .transform((value) => latinDigits(value.trim()))
    .pipe(z.string().regex(/^(09\d{9})?$/, 'شماره دوم باید خالی یا یک موبایل معتبر باشد.')),
})
export type CustomerValues = z.input<typeof customerSchema>
