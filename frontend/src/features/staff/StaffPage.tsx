import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Loading, EmptyState } from '../../components/ui/Feedback'
import { request } from '../../lib/api/client'
import { keys } from '../../lib/api/queries'
import { roles } from '../../config/status'
import { useAuth } from '../auth/AuthProvider'
import type { Staff } from '../../types/api'
import { StaffForm } from './StaffForm'
export default function StaffPage() {
  const { user } = useAuth()
  const manager = user?.role === 1
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Staff | null>(null)
  const staff = useQuery({
    queryKey: keys.staff,
    queryFn: ({ signal }) => request<Staff[]>('accounts/', { signal }),
  })
  return (
    <>
      <PageHeader
        title="کارکنان تعمیرگاه"
        description={
          manager
            ? 'اعضای تیم، نقش‌ها و دسترسی حساب‌ها را مدیریت کنید.'
            : 'فهرست اعضای تیم؛ ویرایش فقط در دسترس مدیر است.'
        }
        action={
          manager && (
            <button
              className="button"
              onClick={() => {
                setSelected(null)
                setOpen(true)
              }}
            >
              <Plus size={18} />
              کارمند جدید
            </button>
          )
        }
      />
      <section className="panel list-panel">
        {staff.isPending ? (
          <Loading />
        ) : staff.isError ? (
          <ErrorState
            error={staff.error}
            retry={() => {
              void staff.refetch()
            }}
          />
        ) : staff.data.length ? (
          <ul className="staff-list">
            {staff.data.map((person) => (
              <li key={person.id}>
                <span className="avatar">
                  <UserRound size={20} />
                </span>
                <div>
                  <b>
                    <bdi>{person.username}</bdi>
                  </b>
                  <small>
                    <bdi>{person.email || 'ایمیل ثبت نشده'}</bdi>
                  </small>
                </div>
                <span>{person.role ? roles[person.role] : 'بدون نقش'}</span>
                <span className={`badge ${person.is_active ? 'forest' : 'neutral'}`}>
                  {person.is_active ? 'فعال' : 'غیرفعال'}
                </span>
                {manager && (
                  <button
                    className="icon-button"
                    aria-label={`ویرایش ${person.username}`}
                    onClick={() => {
                      setSelected(person)
                      setOpen(true)
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </section>
      {manager && (
        <Modal
          open={open}
          onOpenChange={setOpen}
          title={selected ? `ویرایش ${selected.username}` : 'ثبت کارمند جدید'}
          description="سطح دسترسی هر حساب بر اساس نقش آن تعیین می‌شود."
        >
          {open && <StaffForm staff={selected} onSuccess={() => setOpen(false)} />}
        </Modal>
      )}
    </>
  )
}
