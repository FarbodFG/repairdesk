import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from './api/errors'
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  aliases: Record<string, string> = {},
) {
  if (!(error instanceof ApiError)) return
  Object.entries(error.fields).forEach(([path, message]) => {
    if (!['detail', 'non_field_errors'].includes(path))
      setError((aliases[path] || path) as Path<T>, { type: 'server', message })
  })
}
