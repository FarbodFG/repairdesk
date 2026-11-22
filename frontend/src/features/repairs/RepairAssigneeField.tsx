import { useQuery } from '@tanstack/react-query'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Field } from '../../components/ui/Field'
import { roles } from '../../config/status'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import type { Staff } from '../../types/api'
import { useAuth } from '../auth/AuthProvider'

export function RepairAssigneeField({ registration, current, error, optional }: {
  registration: UseFormRegisterReturn<'assigned_technician_id'>
  current?: Staff | null
  error?: string
  optional?: boolean
}) {
  const { user } = useAuth()
  const staff = useQuery({
    queryKey: keys.staff,
    queryFn: ({ signal }) => request<Staff[]>('accounts/', { signal }),
  })
  const others = staff.data?.filter((person) =>
    person.id !== user?.id && person.is_active && person.role !== null && person.role in roles,
  )

  return (
    <>
      <Field
        label={optional ? 'تعمیرکار مسئول (اختیاری)' : 'تعمیرکار مسئول'}
        error={error}
        hint={staff.isPending ? 'در حال دریافت کارکنان…' : undefined}
      >
        <select {...registration}>
          <option value="">بدون تخصیص</option>
          {user && <option value={user.id}>خودم ({user.username})</option>}
          {current && current.id !== user?.id && !others?.some((person) => person.id === current.id) && (
            <option value={current.id} disabled>{current.username} (مسئول فعلی)</option>
          )}
          {others?.map((person) => <option key={person.id} value={person.id}>{person.username}</option>)}
        </select>
      </Field>
      {staff.isError && (
        <button type="button" className="text-link" onClick={() => void staff.refetch()}>
          تلاش دوباره برای دریافت کارکنان
        </button>
      )}
    </>
  )
}
