import { Link } from 'react-router'
export default function NotFoundPage() {
  return (
    <main className="not-found" id="main-content" tabIndex={-1}>
      <strong>۴۰۴</strong>
      <h1>این صفحه را پیدا نکردیم</h1>
      <p>ممکن است نشانی تغییر کرده باشد یا اشتباه وارد شده باشد.</p>
      <Link to="/" className="button">
        بازگشت به صفحه اصلی
      </Link>
    </main>
  )
}
