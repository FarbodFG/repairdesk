import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { DeviceFields } from './DeviceFields'
import { request } from '../../lib/api/client'
import { queryClient, keys } from '../../lib/api/queries'
import { ApiError } from '../../lib/api/errors'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'
import type { Device } from '../../types/api'
export function AddDeviceForm({
  customerId,
  onSuccess,
}: {
  customerId: number
  onSuccess: () => void
}) {
  const [model, setModel] = useState('')
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()
  const create = useMutation({
    mutationFn: () =>
      request<Device>(`customers/${customerId}/devices/`, {
        method: 'POST',
        body: model ? { device_model: Number(model) } : { custom_model_name: custom.trim() },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.devices(customerId) })
      toast('دستگاه مشتری ثبت شد.')
      onSuccess()
    },
  })
  const fields = create.error instanceof ApiError ? create.error.fields : {}
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!!model === !!custom.trim()) {
          setError('یک مدل آماده یا نام دستی وارد کنید.')
          return
        }
        setError('')
        create.mutate()
      }}
    >
      <DeviceFields
        model={model}
        customName={custom}
        onModel={setModel}
        onCustomName={setCustom}
        modelError={error || fields.device_model}
        customError={fields.custom_model_name}
      />
      <FormAlert error={create.error} />
      <div className="form-actions">
        <button disabled={create.isPending} className="button">
          {create.isPending ? <Spinner /> : 'ثبت دستگاه'}
        </button>
      </div>
    </form>
  )
}
