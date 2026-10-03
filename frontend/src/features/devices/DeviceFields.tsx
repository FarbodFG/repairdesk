import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import { useDebounce } from '../../hooks/useDebounce'
import { Field } from '../../components/ui/Field'
import { Pagination } from '../../components/ui/Pagination'
import { ErrorState, Spinner } from '../../components/ui/Feedback'
import type { DeviceModel, Page } from '../../types/api'
export function DeviceFields({
  model,
  customName,
  onModel,
  onCustomName,
  modelError,
  customError,
}: {
  model: string
  customName: string
  onModel: (value: string) => void
  onCustomName: (value: string) => void
  modelError?: string
  customError?: string
}) {
  const [manual, setManual] = useState(!!customName)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)
  const models = useQuery({
    queryKey: keys.models(debounced, page),
    queryFn: ({ signal }) =>
      request<Page<DeviceModel>>(
        `devices/models/?search=${encodeURIComponent(debounced)}&page=${page}&page_size=20`,
        { signal },
      ),
    enabled: !manual,
  })
  return (
    <div className="device-fields">
      <div className="segmented" role="group" aria-label="روش انتخاب مدل">
        <button
          type="button"
          aria-pressed={!manual}
          onClick={() => {
            setManual(false)
            onCustomName('')
          }}
        >
          انتخاب مدل آماده
        </button>
        <button
          type="button"
          aria-pressed={manual}
          onClick={() => {
            setManual(true)
            onModel('')
          }}
        >
          نام مدل به‌صورت دستی
        </button>
      </div>
      {manual ? (
        <Field label="نام مدل دستگاه" error={customError || modelError}>
          <input
            value={customName}
            maxLength={150}
            onChange={(e) => onCustomName(e.target.value)}
            placeholder="نام برند و مدل دستگاه"
          />
        </Field>
      ) : (
        <>
          <Field label="جست‌وجوی مدل" hint="نام برند یا مدل را وارد کنید.">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
                onModel('')
              }}
              placeholder="مثلاً Samsung یا iPhone"
            />
          </Field>
          {models.isError ? (
            <ErrorState
              error={models.error}
              retry={() => {
                void models.refetch()
              }}
            />
          ) : (
            <>
              <Field label="مدل دستگاه" error={modelError || customError}>
                <select
                  value={model}
                  disabled={models.isPending}
                  onChange={(e) => onModel(e.target.value)}
                >
                  <option value="">
                    {models.isPending ? 'در حال دریافت…' : 'یک مدل انتخاب کنید'}
                  </option>
                  {models.data?.results.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.brand.name} — {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              {models.isFetching && (
                <span className="inline-loading" role="status">
                  <Spinner />
                  در حال جست‌وجو…
                </span>
              )}
              {models.data && models.data.count === 0 && (
                <p className="small muted">مدلی پیدا نشد؛ نام مدل را دستی وارد کنید.</p>
              )}
              {models.data && models.data.count > 20 && (
                <Pagination
                  count={models.data.count}
                  page={page}
                  size={20}
                  busy={models.isFetching}
                  onChange={(value) => {
                    setPage(value)
                    onModel('')
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
