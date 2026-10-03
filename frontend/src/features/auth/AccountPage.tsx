import { useAuth } from './AuthProvider'
import { roles } from '../../config/status'
import { PageHeader } from '../../components/layout/PageHeader'
export default function AccountPage() {
  const { user, logout } = useAuth()
  return (
    <>
      <PageHeader title="حساب کاربری" description="اطلاعات حساب فعلی شما در تعمیرگاه" />
      <section className="panel narrow-panel">
        <dl className="details-list">
          <div>
            <dt>نام کاربری</dt>
            <dd>
              <bdi>{user?.username}</bdi>
            </dd>
          </div>
          <div>
            <dt>نام و نام خانوادگی</dt>
            <dd>{`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'ثبت نشده'}</dd>
          </div>
          <div>
            <dt>نقش</dt>
            <dd>{user?.role ? roles[user.role] : 'تعیین نشده'}</dd>
          </div>
          <div>
            <dt>تعمیرگاه</dt>
            <dd>{user?.repair_shop?.title}</dd>
          </div>
          <div>
            <dt>ایمیل</dt>
            <dd>
              <bdi>{user?.email || 'ثبت نشده'}</bdi>
            </dd>
          </div>
        </dl>
        <p className="notice">برای تغییر اطلاعات یا رمز عبور با مدیر تعمیرگاه هماهنگ کنید.</p>
        <button className="button secondary" onClick={logout}>
          خروج از حساب
        </button>
      </section>
    </>
  )
}
