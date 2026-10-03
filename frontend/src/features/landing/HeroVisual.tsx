import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMedia } from '../../hooks/useMedia'
import { PhoneFallback } from './PhoneFallback'
const PhoneScene = lazy(() => import('./PhoneScene'))
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <PhoneFallback /> : this.props.children
  }
}
export function HeroVisual() {
  const eligible = useMedia('(min-width: 1000px) and (prefers-reduced-motion: no-preference)')
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [capable] = useState(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    return !connection?.saveData && (navigator.hardwareConcurrency || 4) >= 4
  })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="hero-visual" ref={ref}>
      <div className="draft-grid" aria-hidden="true" />
      <div className="visual-corner top-left" />
      <div className="visual-corner bottom-right" />
      <div className="hero-model" aria-label="نمای شماتیک لایه‌های داخلی یک موبایل" role="img">
        {eligible && capable && visible ? (
          <SceneBoundary>
            <Suspense fallback={<PhoneFallback />}>
              <PhoneScene />
            </Suspense>
          </SceneBoundary>
        ) : (
          <PhoneFallback />
        )}
      </div>
      <div className="diagram-label label-screen">
        <span>01 / DISPLAY</span>
        <i />
        نمایشگر
      </div>
      <div className="diagram-label label-board">
        <span>02 / LOGIC BOARD</span>
        <i />
        قلب دستگاه
      </div>
      <div className="diagram-label label-battery">
        <span>03 / POWER</span>
        <i />
        انرژی، دوباره
      </div>
      <span className="visual-caption" dir="ltr">
        EXPLODED VIEW — MOBILE DEVICE
      </span>
    </div>
  )
}
