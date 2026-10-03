import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import type { Group } from 'three'
function Phone() {
  const group = useRef<Group>(null)
  const target = useRef({ x: 0.25, y: -0.48 })
  const { invalidate } = useThree()
  useEffect(() => {
    const move = (event: PointerEvent) => {
      target.current = {
        x: 0.25 + (event.clientY / innerHeight - 0.5) * 0.12,
        y: -0.48 + (event.clientX / innerWidth - 0.5) * 0.18,
      }
      invalidate()
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [invalidate])
  useFrame(() => {
    if (!group.current) return
    group.current.rotation.x += (target.current.x - group.current.rotation.x) * 0.08
    group.current.rotation.y += (target.current.y - group.current.rotation.y) * 0.08
    if (
      Math.abs(target.current.x - group.current.rotation.x) +
        Math.abs(target.current.y - group.current.rotation.y) >
      0.001
    )
      invalidate()
  })
  return (
    <group ref={group} rotation={[0.25, -0.48, -0.28]}>
      <RoundedBox args={[2.25, 4.35, 0.16]} radius={0.22} smoothness={4} position={[0, 0, -0.6]}>
        <meshStandardMaterial color="#626f73" metalness={0.85} roughness={0.32} />
      </RoundedBox>
      <RoundedBox args={[2.05, 4.1, 0.09]} radius={0.16} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color="#154a42" metalness={0.6} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.66, 2.3, 0.12]} radius={0.08} smoothness={3} position={[0, -0.6, 0.1]}>
        <meshStandardMaterial color="#263238" metalness={0.45} roughness={0.4} />
      </RoundedBox>
      <RoundedBox
        args={[0.68, 0.7, 0.13]}
        radius={0.04}
        smoothness={2}
        position={[0.38, 1.14, 0.11]}
      >
        <meshStandardMaterial color="#adc3b8" metalness={0.8} roughness={0.4} />
      </RoundedBox>
      {[-0.68, -0.36].map((x, i) => (
        <mesh key={x} position={[x, 1.38 - i * 0.65, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.16, 24]} />
          <meshStandardMaterial color="#0b1519" metalness={0.75} roughness={0.15} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-0.83 + i * 0.18, 0.48, 0.09]}>
          <boxGeometry args={[0.025, 0.25, 0.012]} />
          <meshStandardMaterial color="#c29e61" metalness={0.8} />
        </mesh>
      ))}
      <RoundedBox args={[2.25, 4.35, 0.1]} radius={0.22} smoothness={4} position={[0, 0, 0.75]}>
        <meshPhysicalMaterial
          color="#568d8d"
          metalness={0.35}
          roughness={0.18}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.09, 0.03]} radius={0.04} smoothness={2} position={[0, 1.95, 0.81]}>
        <meshStandardMaterial color="#a4b6af" />
      </RoundedBox>
    </group>
  )
}
export default function PhoneScene() {
  return (
    <Canvas
      className="phone-canvas"
      aria-hidden="true"
      frameloop="demand"
      dpr={[1, 1.35]}
      camera={{ position: [0, 0, 8.3], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 7]} intensity={4} color="#e5e9de" />
      <directionalLight position={[-4, 0, 3]} intensity={2.5} color="#51d8c6" />
      <Phone />
    </Canvas>
  )
}
