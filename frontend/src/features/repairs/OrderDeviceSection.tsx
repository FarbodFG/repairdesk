import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Field } from '../../components/ui/Field'
import { ErrorState } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { OrderValues } from './orderSchema'
import { Smartphone } from 'lucide-react'
import { DeviceFields } from '../devices/DeviceFields'
import { deviceName } from '../../lib/format'
import type { Device } from '../../types/api'
export function OrderDeviceSection() {
  const form = useFormContext<OrderValues>()
  const values = form.watch()
  const errors = form.formState.errors
  const devices = useQuery({
    queryKey: keys.devices(Number(values.customer_id)),
    queryFn: ({ signal }) =>
      request<Device[]>(`customers/${values.customer_id}/devices/`, { signal }),
    enabled: values.customerMode === 'existing' && !!values.customer_id,
  })
  return (
    <section className="panel">
      <div className="form-section-title">
        <Smartphone size={20} />
        <h2>۲. دستگاه</h2>
      </div>
      {values.customerMode === 'existing' && (
        <div className="segmented" role="group" aria-label="روش انتخاب دستگاه">
          <button
            type="button"
            aria-pressed={values.deviceMode === 'existing'}
            onClick={() => form.setValue('deviceMode', 'existing')}
          >
            دستگاه قبلی
          </button>
          <button
            type="button"
            aria-pressed={values.deviceMode === 'new'}
            onClick={() => form.setValue('deviceMode', 'new')}
          >
            دستگاه جدید
          </button>
        </div>
      )}
      {values.customerMode === 'existing' && values.deviceMode === 'existing' ? (
        devices.isError ? (
          <ErrorState
            error={devices.error}
            retry={() => {
              void devices.refetch()
            }}
          />
        ) : (
          <Field
            label="دستگاه مشتری"
            error={errors.device_id?.message}
            hint={
              !values.customer_id
                ? 'ابتدا مشتری را انتخاب کنید.'
                : devices.data?.length === 0
                  ? 'این مشتری دستگاه ندارد؛ دستگاه جدید ثبت کنید.'
                  : undefined
            }
          >
            <select
              {...form.register('device_id')}
              disabled={!values.customer_id || devices.isPending}
            >
              <option value="">دستگاه را انتخاب کنید</option>
              {devices.data?.map((device) => (
                <option key={device.id} value={device.id}>
                  {deviceName(device)}
                </option>
              ))}
            </select>
          </Field>
        )
      ) : (
        <DeviceFields
          model={values.new_device.device_model}
          customName={values.new_device.custom_model_name}
          onModel={(value) => form.setValue('new_device.device_model', value)}
          onCustomName={(value) => form.setValue('new_device.custom_model_name', value)}
          modelError={errors.new_device?.device_model?.message}
          customError={errors.new_device?.custom_model_name?.message}
        />
      )}
    </section>
  )
}
