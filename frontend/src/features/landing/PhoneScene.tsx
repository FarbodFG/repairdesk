import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { DeviceSculpture, type SculptureProps } from './DeviceSculpture'

function FramePump({ active, compact }: { active: boolean; compact: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (!active) return
    let frame = 0,
      last = 0
    const interval = 1000 / (compact ? 30 : 40)
    const tick = (now: number) => {
      const elapsed = now - last
      if (elapsed >= interval) {
        last = now - (elapsed % interval)
        invalidate()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, compact, invalidate])
  return null
}

export default function PhoneScene(props: SculptureProps) {
  return (
    <Canvas
      className="phone-canvas"
      aria-hidden="true"
      orthographic
      frameloop="demand"
      dpr={props.compact ? [1, 1.25] : [1, 1.5]}
      camera={{ position: [0, 0.15, 12], zoom: 60, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <FramePump active={props.active} compact={props.compact} />
      <DeviceSculpture {...props} />
    </Canvas>
  )
}
