import { useState } from 'react'
import { transitions, statuses } from '../../config/status'
import type { Repair, RepairStatus } from '../../types/api'
import { useUpdateRepair } from './useUpdateRepair'
import { Modal } from '../../components/ui/Modal'
import { FormAlert, Spinner } from '../../components/ui/Feedback'
import { StatusBadge } from '../../components/ui/StatusBadge'
export function StatusPanel({ repair }: { repair: Repair }) {
  const update = useUpdateRepair(repair.id)
  const [target, setTarget] = useState<RepairStatus | null>(null)
  function change(status: RepairStatus) {
    if (status === 6 || status === 7) setTarget(status)
    else update.mutate({ repair_status: status })
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>وضعیت تعمیر</h2>
        <StatusBadge status={repair.repair_status} />
      </div>
      <p className="muted small">{statuses[repair.repair_status].description}</p>
      <div className="status-actions">
        {transitions[repair.repair_status].map((status) => (
          <button
            key={status}
            className={`button small-button ${status === 7 ? 'cancel-button' : 'secondary'}`}
            disabled={update.busy}
            onClick={() => change(status)}
          >
            {statuses[status].label}
          </button>
        ))}
      </div>
      {!transitions[repair.repair_status].length && (
        <p className="notice">این وضعیت نهایی است و تغییر وضعیت مجاز نیست.</p>
      )}
      <FormAlert error={update.error} />
      <Modal
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !update.busy) setTarget(null)
        }}
        title={target === 7 ? 'لغو سفارش تعمیر' : 'تأیید تحویل دستگاه'}
        description="این وضعیت نهایی است و امکان بازگشت به مراحل قبلی وجود ندارد."
      >
        <p>
          {target === 7
            ? 'از لغو این سفارش مطمئن هستید؟'
            : 'آیا دستگاه به مشتری تحویل داده شده است؟'}
        </p>
        {target === 6 && !repair.is_paid && (
          <p className="notice">این سفارش هنوز پرداخت‌نشده ثبت شده است.</p>
        )}
        <FormAlert error={update.error} />
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={update.busy}
            onClick={() => setTarget(null)}
          >
            بازگشت
          </button>
          <button
            className={`button ${target === 7 ? 'danger' : ''}`}
            disabled={update.busy}
            onClick={() => {
              if (target)
                update.mutate({ repair_status: target }, { onSuccess: () => setTarget(null) })
            }}
          >
            {update.busy ? <Spinner /> : 'تأیید تغییر وضعیت'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
