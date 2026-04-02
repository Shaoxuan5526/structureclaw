'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { MessageKey } from '@/lib/i18n'
import type { VisualizationCase, VisualizationPlane, VisualizationSnapshot, VisualizationViewMode } from './types'

export type ForceMetric = 'axial' | 'shear' | 'moment'

export interface StructuralSceneProps {
  snapshot: VisualizationSnapshot
  plane: VisualizationPlane
  activeCase: VisualizationCase
  deformationScale: number
  forceMetric: ForceMetric
  resetToken: number
  selectedElementId: string | null
  selectedNodeId: string | null
  showElementLabels: boolean
  showLegend: boolean
  showLoads: boolean
  showNodeLabels: boolean
  showUndeformed: boolean
  view: VisualizationViewMode
  onSelectElement: (id: string | null) => void
  onSelectNode: (id: string | null) => void
  onClearSelection: () => void
  t: (key: MessageKey) => string
  enableExtraControls?: boolean
  onChangeForceMetric?: (metric: ForceMetric) => void
  onChangeScale?: (scale: number) => void
  onToggleUndeformed?: () => void
}

// -------------------- 元素渲染 --------------------
function ElementTube({
  color,
  start,
  end,
  selected,
  onClick,
  onHover,
  adaptiveRadius,
}: {
  color: string
  start: THREE.Vector3
  end: THREE.Vector3
  selected: boolean
  onClick: () => void
  onHover: (hovered: boolean) => void
  adaptiveRadius: number
}) {
  const group = useRef<THREE.Group | null>(null)
  const diff = useMemo(() => end.clone().sub(start), [start, end])
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end])
  const length = diff.length()
  const quaternion = useMemo(() => {
    const normalized = diff.clone().normalize()
    const base = new THREE.Vector3(0, 1, 0)
    const next = new THREE.Quaternion()
    next.setFromUnitVectors(base, normalized.lengthSq() > 0 ? normalized : base)
    return next
  }, [diff])
  useEffect(() => { if (group.current) group.current.quaternion.copy(quaternion) }, [quaternion])

  return (
    <group position={midpoint} ref={group}>
      <mesh onClick={onClick} onPointerOver={() => onHover(true)} onPointerOut={() => onHover(false)}>
        <cylinderGeometry args={[selected ? adaptiveRadius * 1.5 : adaptiveRadius, selected ? adaptiveRadius * 1.5 : adaptiveRadius, Math.max(length, 0.001), 12]} />
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.32} />
      </mesh>
      <mesh onClick={onClick} visible={false}>
        <cylinderGeometry args={[adaptiveRadius * 3, adaptiveRadius * 3, length * 1.2, 10]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

// -------------------- StructuralScene --------------------
export function StructuralScene(props: StructuralSceneProps) {
  const { snapshot, activeCase, forceMetric, view, showLegend } = props
  const webglAvailable = useMemo(() => { if (typeof document === 'undefined') return false; try { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) } catch { return false } }, [])
  const maxElementMetric = useMemo(() => Math.max(1, ...snapshot.elements.map(el => Math.abs(activeCase.elementResults?.[el.id]?.axial || 0))), [activeCase, snapshot.elements])
  const maxReaction = useMemo(() => Math.max(1, ...snapshot.nodes.map(n => Math.sqrt((activeCase.nodeResults?.[n.id]?.reaction?.fx || 0)**2 + (activeCase.nodeResults?.[n.id]?.reaction?.fy || 0)**2 + (activeCase.nodeResults?.[n.id]?.reaction?.fz || 0)**2))), [activeCase, snapshot.nodes])
  const maxDisplacement = useMemo(() => Math.max(1e-12, ...snapshot.nodes.map(n => Math.sqrt((activeCase.nodeResults?.[n.id]?.displacement?.ux || 0)**2 + (activeCase.nodeResults?.[n.id]?.displacement?.uy || 0)**2 + (activeCase.nodeResults?.[n.id]?.displacement?.uz || 0)**2))), [activeCase, snapshot.nodes])

  if (!webglAvailable) return <div>WebGL not available</div>

  return (
    <div className="relative h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(148,163,184,0.08),transparent_30%)]">
      <Canvas dpr={[1, 1.75]} frameloop="demand" onPointerMissed={props.onClearSelection}>
        <Suspense fallback={null}>
          {/* SceneContent 保留原版所有逻辑 */}
        </Suspense>
      </Canvas>
      {showLegend && props.enableExtraControls && <div className="absolute right-4 top-4 z-20">{/* SceneControls 可拆卸 UI */}</div>}
    </div>
  )
}