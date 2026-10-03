import { z } from 'zod'
import { customerSchema } from '../customers/customerSchema'
import { parseAmount } from '../../lib/format'
import type { CreateRepair } from '../../types/api'
export const orderSchema = z
  .object({
    customerMode: z.enum(['existing', 'new']),
    deviceMode: z.enum(['existing', 'new']),
    customer_id: z.string(),
    device_id: z.string(),
    assigned_technician_id: z.string(),
    new_customer: z.object({
      name: z.string(),
      phone_number: z.string(),
      available_phone_number: z.string(),
    }),
    new_device: z.object({
      device_model: z.string(),
      custom_model_name: z.string().max(150, 'نام مدل حداکثر ۱۵۰ کاراکتر است.'),
    }),
    issue_description: z.string(),
    amount: z.string(),
    is_paid: z.boolean(),
  })
  .superRefine((data, context) => {
    if (data.customerMode === 'existing' && !data.customer_id)
      context.addIssue({ code: 'custom', path: ['customer_id'], message: 'مشتری را انتخاب کنید.' })
    if (data.customerMode === 'new') {
      const parsed = customerSchema.safeParse(data.new_customer)
      if (!parsed.success)
        parsed.error.issues.forEach((issue) =>
          context.addIssue({
            code: 'custom',
            path: ['new_customer', ...issue.path],
            message: issue.message,
          }),
        )
    }
    if (data.customerMode === 'existing' && data.deviceMode === 'existing') {
      if (!data.device_id)
        context.addIssue({
          code: 'custom',
          path: ['device_id'],
          message: 'دستگاه مشتری را انتخاب کنید.',
        })
    } else if (!!data.new_device.device_model === !!data.new_device.custom_model_name.trim())
      context.addIssue({
        code: 'custom',
        path: ['new_device', 'device_model'],
        message: 'یک مدل آماده یا یک نام دستی وارد کنید.',
      })
    try {
      const amount = parseAmount(data.amount)
      if (data.is_paid && amount === null)
        context.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'برای ثبت پرداخت، مبلغ نهایی را وارد کنید.',
        })
    } catch (error) {
      context.addIssue({ code: 'custom', path: ['amount'], message: (error as Error).message })
    }
  })
export type OrderValues = z.infer<typeof orderSchema>
export const defaultOrder: OrderValues = {
  customerMode: 'existing',
  deviceMode: 'existing',
  customer_id: '',
  device_id: '',
  assigned_technician_id: '',
  new_customer: { name: '', phone_number: '', available_phone_number: '' },
  new_device: { device_model: '', custom_model_name: '' },
  issue_description: '',
  amount: '',
  is_paid: false,
}
export function orderPayload(data: OrderValues): CreateRepair {
  return {
    ...(data.customerMode === 'new'
      ? { new_customer: customerSchema.parse(data.new_customer) }
      : { customer_id: Number(data.customer_id) }),
    ...(data.customerMode === 'new' || data.deviceMode === 'new'
      ? {
          new_device: data.new_device.device_model
            ? { device_model: Number(data.new_device.device_model) }
            : { custom_model_name: data.new_device.custom_model_name.trim() },
        }
      : { device_id: Number(data.device_id) }),
    assigned_technician_id: data.assigned_technician_id
      ? Number(data.assigned_technician_id)
      : null,
    issue_description: data.issue_description.trim(),
    final_amount: parseAmount(data.amount),
    is_paid: data.is_paid,
  }
}
