import { ChevronLeft, ChevronRight } from 'lucide-react'
import { number } from '../../lib/format'
export function Pagination({
  count,
  page,
  size = 20,
  onChange,
  busy = false,
}: {
  count: number
  page: number
  size?: number
  onChange: (page: number) => void
  busy?: boolean
}) {
  const pages = Math.max(1, Math.ceil(count / size))
  return (
    <nav className="pagination" aria-label="صفحه‌بندی">
      <span>
        {number(count)} مورد · صفحه {number(page)} از {number(pages)}
      </span>
      <div className="row">
        <button
          className="icon-button"
          aria-label="صفحه قبل"
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="صفحه بعد"
          disabled={page >= pages || busy}
          onClick={() => onChange(page + 1)}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
    </nav>
  )
}
