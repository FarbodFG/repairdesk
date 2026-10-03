import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Field } from '../../components/ui/Field'
import { FormAlert, Loading, Spinner } from '../../components/ui/Feedback'
import { Brand } from '../../components/layout/Brand'
import { useAuth } from './AuthProvider'
const schema = z.object({
  username: z.string().trim().min(1, 'نام کاربری را وارد کنید.'),
  password: z.string().min(1, 'رمز عبور را وارد کنید.'),
})
export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const from: unknown = location.state?.from
  const destination = typeof from === 'string' && /^\/app(?:\/|\?|$)/.test(from) ? from : '/app'
  if (auth.active && auth.loading) return <Loading label="در حال بررسی حساب کاربری…" />
  if (auth.active)
    return (
      <Navigate
        to={
          auth.user?.role === 3 &&
          /^\/app\/(customers|staff|repairs\/new)(?:\/|\?|$)/.test(destination)
            ? '/app'
            : destination
        }
        replace
      />
    )
  return (
    <main className="login-page" id="main-content" tabIndex={-1}>
      <section className="login-story">
        <Brand light />
        <div>
          <span className="eyebrow">REPAIRDESK / WORKSPACE</span>
          <h1>
            هر تعمیر،
            <br />
            یک مسیر روشن.
          </h1>
          <p>
            از پذیرش دستگاه تا تحویل به مشتری؛
            <br />
            همه جزئیات در یک میز کار.
          </p>
        </div>
        <span className="technical-label">PRECISION IN EVERY DETAIL</span>
      </section>
      <section className="login-panel">
        <Link to="/" className="text-link">
          بازگشت به سایت <ArrowLeft size={16} />
        </Link>
        <div className="login-form">
          <span className="icon-tile">
            <LockKeyhole size={24} />
          </span>
          <h2>ورود به فضای کاری</h2>
          <p className="muted">با حسابی که مدیر تعمیرگاه ساخته است وارد شوید.</p>
          {auth.expired && (
            <p className="notice" role="status">
              نشست شما پایان یافته است. لطفاً دوباره وارد شوید.
            </p>
          )}
          <form
            onSubmit={form.handleSubmit(async (data) => {
              setError(null)
              try {
                await auth.login(data.username, data.password)
              } catch (err) {
                setError(err)
              }
            })}
            noValidate
          >
            <Field label="نام کاربری" error={form.formState.errors.username?.message}>
              <input autoComplete="username" dir="ltr" {...form.register('username')} />
            </Field>
            <div className="password-field">
              <Field label="رمز عبور" error={form.formState.errors.password?.message}>
                <input
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  {...form.register('password')}
                />
              </Field>
              <button
                type="button"
                className="icon-button password-toggle"
                aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FormAlert error={error} />
            <button disabled={form.formState.isSubmitting} className="button full">
              {form.formState.isSubmitting ? <Spinner /> : 'ورود به پنل'}
              <ArrowLeft size={18} />
            </button>
          </form>
          <p className="login-help">
            حساب ندارید یا رمز را فراموش کرده‌اید؟
            <br />
            با مدیر تعمیرگاه هماهنگ کنید.
          </p>
        </div>
        <span className="muted small">این بخش مخصوص کارکنان تعمیرگاه است.</span>
      </section>
    </main>
  )
}
