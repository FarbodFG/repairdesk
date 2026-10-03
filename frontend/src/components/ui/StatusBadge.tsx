import { statuses } from '../../config/status'
import type { RepairStatus } from '../../types/api'
export function StatusBadge({ status }: { status: RepairStatus }) {
  const item = statuses[status]
  return (
    <span className={`badge ${item?.tone || 'neutral'}`}>
      <span className="status-dot" />
      {item?.label || 'وضعیت نامشخص'}
    </span>
  )
}
