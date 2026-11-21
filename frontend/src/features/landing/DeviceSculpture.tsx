import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import { MathUtils, Shape, type Group, type Mesh } from 'three'
import { createBoardTexture, createScreenTexture } from './deviceTextures'

export type DevicePointer = { x: number; y: number }
export type SculptureProps = {
  exploded: boolean
  active: boolean
  compact: boolean
  pointer: RefObject<DevicePointer>
  onToggle: () => void
}

function Plate({
  width = 2.16,
  height = 4.4,
  depth = 0.12,
  color = '#4d6966',
  metalness = 0.9,
}: {
  width?: number
  height?: number
  depth?: number
  color?: string
  metalness?: number
}) {
  const shape = useMemo(() => {
    const r = 0.27,
      x = -width / 2,
      y = -height / 2
    return new Shape()
      .moveTo(x + r, y)
      .lineTo(x + width - r, y)
      .quadraticCurveTo(x + width, y, x + width, y + r)
      .lineTo(x + width, y + height - r)
      .quadraticCurveTo(x + width, y + height, x + width - r, y + height)
      .lineTo(x + r, y + height)
      .quadraticCurveTo(x, y + height, x, y + height - r)
      .lineTo(x, y + r)
      .quadraticCurveTo(x, y, x + r, y)
  }, [width, height])
  const options = useMemo(
    () => ({
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 12,
    }),
    [depth],
  )
  return (
    <mesh position-z={-depth / 2}>
      <extrudeGeometry args={[shape, options]} />
      <meshPhysicalMaterial
        color={color}
        metalness={metalness}
        roughness={0.23}
        clearcoat={0.65}
        clearcoatRoughness={0.18}
      />
    </mesh>
  )
}

function Lens({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0.15]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.23, 0.23, 0.12, 40]} />
        <meshStandardMaterial color="#76948b" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position-z={0.075}>
        <circleGeometry args={[0.185, 40]} />
        <meshPhysicalMaterial color="#030c15" metalness={0.65} roughness={0.08} clearcoat={1} />
      </mesh>
      <mesh position-z={0.079}>
        <ringGeometry args={[0.07, 0.1, 32]} />
        <meshBasicMaterial color="#467eac" />
      </mesh>
      <mesh position={[-0.045, 0.05, 0.081]}>
        <circleGeometry args={[0.025, 16]} />
        <meshBasicMaterial color="#b3e7ef" />
      </mesh>
    </group>
  )
}

function Core() {
  return (
    <group position={[0.18, 0.58, 0.18]}>
      <RoundedBox args={[1.02, 1.03, 0.16]} radius={0.06} smoothness={3}>
        <meshPhysicalMaterial color="#172925" metalness={0.9} roughness={0.24} clearcoat={0.6} />
      </RoundedBox>
      <mesh position-z={0.09}>
        <planeGeometry args={[0.8, 0.81]} />
        <meshStandardMaterial color="#b9a374" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position-z={0.1}>
        <planeGeometry args={[0.64, 0.64]} />
        <meshStandardMaterial color="#1b302d" metalness={0.75} roughness={0.2} />
      </mesh>
      <mesh position-z={0.11}>
        <torusGeometry args={[0.19, 0.012, 6, 40]} />
        <meshBasicMaterial color="#a8efd6" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) =>
        [-1, 1].map((side) => (
          <mesh key={`${i}-${side}`} position={[side * 0.56, -0.4 + i * 0.115, 0]}>
            <boxGeometry args={[0.11, 0.035, 0.055]} />
            <meshStandardMaterial color="#c9ad70" metalness={1} roughness={0.25} />
          </mesh>
        )),
      )}
    </group>
  )
}

function Device({ exploded, active, pointer, onToggle }: SculptureProps) {
  const body = useRef<Group>(null),
    rear = useRef<Group>(null),
    display = useRef<Group>(null)
  const orbit = useRef<Group>(null),
    sweep = useRef<Mesh>(null)
  const time = useRef(0),
    separation = useRef(exploded ? 1 : 0)
  const { invalidate } = useThree()
  const screen = useMemo(createScreenTexture, [])
  const board = useMemo(createBoardTexture, [])
  useEffect(
    () => () => {
      screen.dispose()
      board.dispose()
    },
    [screen, board],
  )
  useEffect(() => {
    invalidate()
  }, [exploded, active, invalidate])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (active) time.current += dt
    const t = time.current
    const tilt = pointer?.current ?? { x: 0, y: 0 }
    separation.current = MathUtils.damp(separation.current, exploded ? 1 : 0, 5, dt)
    const s = separation.current
    if (body.current) {
      body.current.rotation.x = MathUtils.damp(body.current.rotation.x, 0.12 + tilt.y * 0.13, 4, dt)
      body.current.rotation.y = MathUtils.damp(
        body.current.rotation.y,
        -0.48 + tilt.x * 0.22 + Math.sin(t * 0.3) * 0.08,
        4,
        dt,
      )
      body.current.position.y = 0.25 + Math.sin(t * 0.7) * 0.075
    }
    if (display.current) {
      display.current.position.set(-0.52 * s, 0.12 * s, 0.36 + 0.9 * s)
      display.current.rotation.y = 0.09 * s
    }
    if (rear.current) rear.current.position.set(0.34 * s, -0.08 * s, -0.18 - 0.65 * s)
    if (orbit.current) orbit.current.rotation.z = t * 0.1
    if (sweep.current) sweep.current.position.y = Math.sin(t * 0.6) * 1.7
    if (!active && Math.abs(s - (exploded ? 1 : 0)) > 0.002) invalidate()
  })
  return (
    <>
      <group
        ref={body}
        rotation={[0.12, -0.48, -0.18]}
        position={[0, 0.25, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (event.delta <= 8) onToggle()
        }}
      >
        <group ref={rear} position={[0.34, -0.08, -0.83]}>
          <Plate color="#49756b" />
          <group position={[-0.49, 1.38, 0.06]}>
            <Lens x={0} y={0} />
            <Lens x={0.48} y={0} />
            <Lens x={0} y={0.5} />
          </group>
          <mesh position={[0.68, 1.54, 0.1]}>
            <circleGeometry args={[0.07, 20]} />
            <meshBasicMaterial color="#faeac0" />
          </mesh>
        </group>
        <Plate width={2.02} height={4.22} depth={0.085} color="#102c27" metalness={0.65} />
        <mesh position-z={0.06}>
          <planeGeometry args={[1.95, 4.12]} />
          <meshStandardMaterial
            map={board}
            emissiveMap={board}
            emissive="#50b590"
            emissiveIntensity={0.35}
            transparent
            alphaTest={0.1}
            roughness={0.55}
            metalness={0.4}
          />
        </mesh>
        <Core />
        <RoundedBox
          args={[1.22, 1.56, 0.12]}
          radius={0.07}
          smoothness={3}
          position={[-0.05, -1.05, 0.16]}
        >
          <meshPhysicalMaterial color="#132322" metalness={0.65} roughness={0.3} clearcoat={0.6} />
        </RoundedBox>
        <mesh position={[-0.05, -1.05, 0.23]}>
          <torusGeometry args={[0.44, 0.012, 6, 64]} />
          <meshBasicMaterial color="#559e83" />
        </mesh>
        {[-0.68, -0.43, -0.18, 0.07, 0.32, 0.57].map((x, i) => (
          <RoundedBox
            key={x}
            args={[0.13, 0.22, 0.08]}
            radius={0.015}
            smoothness={2}
            position={[x, 1.72 - (i % 2) * 0.28, 0.13]}
          >
            <meshStandardMaterial
              color={i % 2 ? '#aaa487' : '#405b50'}
              metalness={0.85}
              roughness={0.3}
            />
          </RoundedBox>
        ))}
        <mesh ref={sweep} position-z={0.3}>
          <planeGeometry args={[1.9, 0.013]} />
          <meshBasicMaterial color="#a8f5d8" transparent opacity={0.75} depthWrite={false} />
        </mesh>
        <group ref={display} position={[-0.52, 0.12, 1.26]}>
          <Plate depth={0.11} color="#7d9b90" />
          <mesh position-z={0.087}>
            <planeGeometry args={[2.075, 4.305]} />
            <meshPhysicalMaterial
              map={screen}
              emissiveMap={screen}
              emissive="#ffffff"
              emissiveIntensity={0.45}
              metalness={0.1}
              roughness={0.19}
              clearcoat={1}
              clearcoatRoughness={0.12}
              transparent
              alphaTest={0.1}
            />
          </mesh>
          <RoundedBox
            args={[0.58, 0.12, 0.018]}
            radius={0.05}
            smoothness={4}
            position={[0, 1.97, 0.11]}
          >
            <meshStandardMaterial color="#021111" roughness={0.2} />
          </RoundedBox>
          <mesh position={[0.17, 1.97, 0.125]}>
            <circleGeometry args={[0.025, 20]} />
            <meshBasicMaterial color="#183b48" />
          </mesh>
          <RoundedBox
            args={[0.055, 0.55, 0.08]}
            radius={0.025}
            smoothness={3}
            position={[1.105, 0.8, 0]}
          >
            <meshStandardMaterial color="#8aab9c" metalness={0.9} roughness={0.2} />
          </RoundedBox>
          <RoundedBox
            args={[0.055, 0.35, 0.08]}
            radius={0.025}
            smoothness={3}
            position={[-1.105, 0.9, 0]}
          >
            <meshStandardMaterial color="#8aab9c" metalness={0.9} roughness={0.2} />
          </RoundedBox>
        </group>
      </group>
      <group ref={orbit} rotation={[0, 0, 0]}>
        <group rotation={[0.42, 0.3, 0.28]}>
          <mesh>
            <torusGeometry args={[2.95, 0.014, 6, 128]} />
            <meshStandardMaterial
              color="#bc9a61"
              emissive="#775524"
              emissiveIntensity={0.35}
              metalness={0.8}
              roughness={0.28}
            />
          </mesh>
          <mesh rotation-z={0.5}>
            <torusGeometry args={[2.95, 0.027, 8, 64, 0.7]} />
            <meshBasicMaterial color="#f3d7a2" />
          </mesh>
          <mesh position={[0, 2.95, 0]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshBasicMaterial color="#f4dcad" />
          </mesh>
        </group>
        <mesh rotation={[0.1, -0.5, -0.45]}>
          <torusGeometry args={[3.15, 0.008, 5, 128, Math.PI * 1.45]} />
          <meshBasicMaterial color="#42695e" transparent opacity={0.55} />
        </mesh>
      </group>
      <group position={[0, -2.72, 0]} rotation-x={-Math.PI / 2}>
        <mesh>
          <circleGeometry args={[1.78, 80]} />
          <meshStandardMaterial
            color="#102c25"
            metalness={0.9}
            roughness={0.3}
            transparent
            opacity={0.8}
          />
        </mesh>
        <mesh position-z={0.018}>
          <ringGeometry args={[1.76, 1.79, 96]} />
          <meshBasicMaterial color="#64b79b" transparent opacity={0.55} />
        </mesh>
        <mesh position-z={0.02}>
          <ringGeometry args={[1.48, 1.49, 96]} />
          <meshBasicMaterial color="#b79460" transparent opacity={0.6} />
        </mesh>
      </group>
      {Array.from({ length: 18 }, (_, i) => {
        const a = i * 2.399
        return (
          <mesh
            key={i}
            position={[
              Math.cos(a) * (2.3 + (i % 3) * 0.25),
              Math.sin(a) * 2.5,
              -0.9 - (i % 4) * 0.2,
            ]}
          >
            <sphereGeometry args={[i % 4 === 0 ? 0.035 : 0.015, 8, 6]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? '#e5c18b' : '#6bc7a7'}
              transparent
              opacity={0.65}
            />
          </mesh>
        )
      })}
    </>
  )
}

function FitCamera() {
  const { camera, size, invalidate } = useThree()
  useEffect(() => {
    camera.zoom = Math.min(size.width / 7.6, size.height / 7.4)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size, invalidate])
  return null
}

export function DeviceSculpture(props: SculptureProps) {
  return (
    <>
      <FitCamera />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 6]} intensity={3} color="#effff5" />
      <directionalLight position={[-4, 1, 2]} intensity={2.2} color="#63d7be" />
      <pointLight position={[2, -1, 4]} intensity={10} color="#e9bc78" />
      <Environment resolution={props.compact ? 64 : 128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#f7fff5"
          scale={[5, 9, 1]}
          position={[-4, 3, 5]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#62d4b3"
          scale={[3, 7, 1]}
          position={[4, 0, 2]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={4}
          color="#e6c69c"
          scale={[5, 3, 1]}
          position={[0, 5, -3]}
          target={[0, 0, 0]}
        />
      </Environment>
      <Device {...props} />
    </>
  )
}
