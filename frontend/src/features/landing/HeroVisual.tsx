import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play, Pointer } from 'lucide-react'
import { useMedia } from '../../hooks/useMedia'
import { PhoneFallback } from './PhoneFallback'
import type { DevicePointer } from './DeviceSculpture'
const PhoneScene = lazy(() => import('./PhoneScene'))

class SceneBoundary extends Component<
  { children: ReactNode; exploded: boolean; onToggle: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <PhoneFallback exploded={this.props.exploded} onToggle={this.props.onToggle} />
    ) : (
      this.props.children
    )
  }
}

export function HeroVisual() {
  const motion = useMedia('(prefers-reduced-motion: no-preference)')
  const compact = useMedia('(max-width: 700px)')
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useRef<DevicePointer>({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const [exploded, setExploded] = useState(true)
  const [paused, setPaused] = useState(false)
  const [capable] = useState(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    return !connection?.saveData && (navigator.hardwareConcurrency || 4) >= 4
  })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '60px',
    })
    observer.observe(node)
    const update = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  const render3d = motion && capable
  const active = visible && pageVisible && !paused
  const toggleView = () => setExploded((value) => !value)
  return (
    <div
      className="hero-visual device-showcase"
      ref={ref}
      data-view={exploded ? 'exploded' : 'assembled'}
      data-paused={paused}
    >
      <div className="device-showcase-heading" aria-hidden="true">
        <span className="device-live-dot" />
        <span dir="ltr">SUN CITY / DEVICE ATELIER</span>
        <span className="device-edition">01</span>
      </div>
      <div
        className="hero-model device-stage"
        role="button"
        tabIndex={0}
        aria-label="تغییر نمای موبایل"
        aria-pressed={!exploded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!event.repeat) toggleView()
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') return
          const rect = event.currentTarget.getBoundingClientRect()
          pointer.current.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
          pointer.current.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
        }}
        onPointerLeave={() => {
          pointer.current = { x: 0, y: 0 }
        }}
      >
        {render3d ? (
          <SceneBoundary exploded={exploded} onToggle={toggleView}>
            <Suspense fallback={<PhoneFallback exploded={exploded} onToggle={toggleView} />}>
              <PhoneScene
                exploded={exploded}
                active={active}
                compact={compact}
                pointer={pointer}
                onToggle={toggleView}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <PhoneFallback exploded={exploded} onToggle={toggleView} />
        )}
      </div>
      <div className="device-showcase-footer">
        <div className="device-hint">
          <Pointer size={16} aria-hidden="true" />
          <span>برای باز و بسته شدن اجزا، روی گوشی بزنید</span>
        </div>
        <div className="device-controls" aria-label="کنترل نمای سه‌بعدی">
          {render3d && (
            <button
              type="button"
              className="device-pause"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'ادامهٔ حرکت سه‌بعدی' : 'توقف حرکت سه‌بعدی'}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
