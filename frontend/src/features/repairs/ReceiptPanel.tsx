import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import { dateTime, localDateTimeMax, receiptISO } from '../../lib/format'
import { Field } from '../../components/ui/Field'
import { FormAlert } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import type { Repair } from '../../types/api'
import { useUpdateRepair } from './useUpdateRepair'
export function ReceiptPanel({ repair }: { repair: Repair }) {
  const update = useUpdateRepair(repair.id)
  const [manual, setManual] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  function now() {
    if (repair.received_at) setConfirm(true)
    else update.mutate({ receive_now: true })
  }
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>دریافت دستگاه از مشتری</h2>
        <Clock3 size={20} />
      </div>
      <p className="receipt-time">{dateTime(repair.received_at)}</p>
      <p className="small muted">این زمان، دریافت گوشی از مشتری است؛ نه شروع تعمیر.</p>
      <button className="button secondary full receipt-now" disabled={update.busy} onClick={now}>
        ثبت زمان فعلی
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          try {
            const received_at = receiptISO(manual)
            setError('')
            update.mutate({ received_at })
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      >
        <Field
          label="ورود دستی تاریخ و ساعت"
          hint="تقویم میلادی؛ ساعت محلی دستگاه شما. نمایش ذخیره‌شده با ساعت تهران است."
          error={error}
        >
          <input
            type="datetime-local"
            dir="ltr"
            max={localDateTimeMax()}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
          />
        </Field>
        <button className="button secondary full" disabled={update.busy || !manual}>
          ذخیره زمان دستی
        </button>
      </form>
      <FormAlert error={update.error} />
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="جایگزینی زمان دریافت"
        description="زمان قبلی با زمان فعلی سرور جایگزین می‌شود."
      >
        <div className="form-actions">
          <button className="button secondary" onClick={() => setConfirm(false)}>
            بازگشت
          </button>
          <button
            className="button"
            disabled={update.busy}
            onClick={() =>
              update.mutate({ receive_now: true }, { onSuccess: () => setConfirm(false) })
            }
          >
            ثبت زمان فعلی
          </button>
        </div>
        <FormAlert error={update.error} />
      </Modal>
    </section>
  )
}
