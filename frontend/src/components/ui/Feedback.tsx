import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'
import { errorMessage } from '../../lib/api/errors'
export function Spinner() {
  return <LoaderCircle className="spin" size={18} aria-hidden="true" />
}
export function Loading({ label = 'در حال دریافت اطلاعات…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <Spinner />
      <span>{label}</span>
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <h2>دریافت اطلاعات ممکن نشد</h2>
      <p>{errorMessage(error)}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={16} />
          تلاش دوباره
        </button>
      )}
    </div>
  )
}
export function EmptyState({
  title = 'هنوز چیزی ثبت نشده',
  description = 'اطلاعات پس از ثبت در این بخش نمایش داده می‌شود.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
export function FormAlert({ error }: { error: unknown }) {
  return error ? (
    <div className="form-alert" role="alert">
      <AlertCircle size={18} />
      <span>{errorMessage(error)}</span>
    </div>
  ) : null
}
