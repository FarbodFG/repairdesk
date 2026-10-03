import { useMutation, useIsMutating } from '@tanstack/react-query'
import { request } from '../../lib/api/client'
import { invalidateRepairs } from '../../lib/api/queries'
import { useToast } from '../../components/ui/Toast'
import type { Repair, UpdateRepair } from '../../types/api'
export function useUpdateRepair(id: number) {
  const toast = useToast()
  const busy = useIsMutating({ mutationKey: ['repair-update', id] }) > 0
  const mutation = useMutation({
    mutationKey: ['repair-update', id],
    scope: { id: `repair-${id}` },
    mutationFn: (data: UpdateRepair) =>
      request<Repair>(`repairs/${id}/`, { method: 'PATCH', body: data }),
    onSuccess: async () => {
      await invalidateRepairs()
      toast('تغییرات سفارش ذخیره شد.')
    },
  })
  return { ...mutation, busy }
}
