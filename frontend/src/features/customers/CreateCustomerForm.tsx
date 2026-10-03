import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CustomerFields } from './CustomerFields'
import { customerSchema, type CustomerValues } from './customerSchema'
import { request } from '../../lib/api/client'
import { queryClient, keys } from '../../lib/api/queries'
import { applyFieldErrors } from '../../lib/forms'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { useToast } from '../../components/ui/Toast'
import type { Customer } from '../../types/api'
export function CreateCustomerForm({ onSuccess }: { onSuccess: (customer: Customer) => void }) {
  const toast = useToast()
  const form = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone_number: '', available_phone_number: '' },
  })
  const errors = form.formState.errors
  const create = useMutation({
    mutationFn: (data: CustomerValues) =>
      request<Customer>('customers/', { method: 'POST', body: data }),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: keys.customers })
      toast('مشتری ثبت شد.')
      onSuccess(customer)
    },
    onError: (error) => applyFieldErrors(error, form.setError),
  })
  return (
    <form onSubmit={form.handleSubmit((data) => create.mutate(data))} noValidate>
      <CustomerFields
        values={form.watch()}
        onChange={(key, value) => form.setValue(key, value)}
        errors={{
          name: errors.name?.message,
          phone_number: errors.phone_number?.message,
          available_phone_number: errors.available_phone_number?.message,
        }}
      />
      <FormAlert error={create.error} />
      <div className="form-actions">
        <button className="button" disabled={create.isPending}>
          {create.isPending ? <Spinner /> : 'ثبت مشتری'}
        </button>
      </div>
    </form>
  )
}
