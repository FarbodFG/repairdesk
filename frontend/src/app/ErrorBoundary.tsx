import { Component, type ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <main className="not-found">
        <h1>صفحه به‌درستی بارگذاری نشد</h1>
        <p>اتصال را بررسی کنید و صفحه را دوباره بارگذاری کنید.</p>
        <button className="button" onClick={() => location.reload()}>
          بارگذاری دوباره
        </button>
        <a className="text-link" href="/">
          صفحه اصلی
        </a>
      </main>
    ) : (
      this.props.children
    )
  }
}
