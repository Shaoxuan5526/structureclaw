'use client'

/**
 * Scene2DFallback
 * ---------------
 * Pure SVG 2D renderer for StructuralScene.
 * Activated automatically when WebGL is unavailable.
 * Drop this file next to structural-scene.tsx and import it there.
 *
 * Design goals:
 *  - Zero new dependencies
 *  - Modular: only replaces the Canvas render, all props stay identical
 *  - Supports click-select for nodes & elements
 *  - Mirrors color logic from the 3D version
 */

import { useMemo, useState } from 'react'
import type { VisualizationCase, VisualizationPlane, VisualizationSnapshot, VisualizationViewMode } from './types'

// ─── re-used from structural-scene ────────────────────────────────────────────
type ForceMetric = 'axial' | 'shear' | 'moment'

function getElementMetric(activeCase: VisualizationCase, elementId: string, forceMetric: ForceMetric) {
  const result = activeCase.elementResults[elementId]
  if (!result) return 0
  if (activeCase.kind === 'envelope') {
    if (forceMetric === 'axial') return Number(result.envelope?.maxAbsAxialForce || 0)
    if (forceMetric === 'shear') return Number(result.envelope?.maxAbsShearForce || 0)
    return Number(result.envelope?.maxAbsMoment || 0)
  }
  if (forceMetric === 'axial') return Number(result.axial || 0)
  if (forceMetric === 'shear') return Number(result.shear || 0)
  return Number(result.moment || 0)
}

function getCaseNodeDisplacement(activeCase: VisualizationCase, nodeId: string) {
  const d = activeCase.nodeResults[nodeId]?.displacement
  return { x: d?.ux ?? 0, y: d?.uy ?? 0, z: d?.uz ?? 0 }
}

function createColorScale(value: number, maxValue: number): string {
  const ratio = maxValue <= 0 ? 0 : Math.min(Math.abs(value) / maxValue, 1)
  const r = Math.round((0.18 + ratio * 0.72) * 255)
  const g = Math.round((0.82 - ratio * 0.32) * 255)
  const b = Math.round((0.92 - ratio * 0.55) * 255)
  return `rgb(${r},${g},${b})`
}

// ─── coordinate helpers ───────────────────────────────────────────────────────

interface Point2D { x: number; y: number }

/**
 * Project a 3D structural node to a 2D SVG point.
 * Structural Y = "height", so we map:
 *   plane xz  →  SVG-x = struct-x,  SVG-y = struct-z  (typical frame in XZ)
 *   plane xy  →  SVG-x = struct-x,  SVG-y = struct-y
 */
function project(
  pos: { x: number; y: number; z: number },
  plane: VisualizationPlane
): Point2D {
  if (plane === 'xz') return { x: pos.x, y: pos.z }
  if (plane === 'yz') return { x: pos.y, y: pos.z }
  return { x: pos.x, y: pos.y } // xy
}

interface ViewBox { minX: number; minY: number; width: number; height: number }

function computeViewBox(points: Point2D[], padding = 0.15): ViewBox {
  if (!points.length) return { minX: -1, minY: -1, width: 2, height: 2 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const w = Math.max(maxX - minX, 0.1)
  const h = Math.max(maxY - minY, 0.1)
  const pad = Math.max(w, h) * padding
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: w + 2 * pad,
    height: h + 2 * pad,
  }
}

// ─── props (same surface as StructuralScene) ──────────────────────────────────

export interface Scene2DFallbackProps {
  snapshot: VisualizationSnapshot
  plane: VisualizationPlane
  activeCase: VisualizationCase
  deformationScale: number
  forceMetric: ForceMetric
  selectedElementId: string | null
  selectedNodeId: string | null
  showElementLabels: boolean
  showLoads: boolean
  showNodeLabels: boolean
  showUndeformed: boolean
  view: VisualizationViewMode
  onSelectElement: (id: string | null) => void
  onSelectNode: (id: string | null) => void
  onClearSelection: () => void
}

// ─── main component ───────────────────────────────────────────────────────────

export function Scene2DFallback({
  snapshot,
  plane,
  activeCase,
  deformationScale,
  forceMetric,
  selectedElementId,
  selectedNodeId,
  showElementLabels,
  showLoads,
  showNodeLabels,
  showUndeformed,
  view,
  onSelectElement,
  onSelectNode,
  onClearSelection,
}: Scene2DFallbackProps) {
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // ── max metric for colour scale ──────────────────────────────────────────
  const maxElementMetric = useMemo(() =>
    Math.max(1, ...snapshot.elements.map((el) => Math.abs(getElementMetric(activeCase, el.id, forceMetric)))),
    [activeCase, forceMetric, snapshot.elements]
  )

  // ── node positions (with optional deformation) ───────────────────────────
  const nodeMap = useMemo(() => {
    const map = new Map<string, { base: Point2D; deformed: Point2D }>()
    for (const node of snapshot.nodes) {
      const d = getCaseNodeDisplacement(activeCase, node.id)
      const base3 = node.position
      const def3 = {
        x: base3.x + d.x * deformationScale,
        y: base3.y + d.y * deformationScale,
        z: base3.z + d.z * deformationScale,
      }
      map.set(node.id, {
        base: project(base3, plane),
        deformed: project(def3, plane),
      })
    }
    return map
  }, [snapshot.nodes, activeCase, deformationScale, plane])

  // ── viewBox – fit all nodes ───────────────────────────────────────────────
  const viewBox = useMemo(() => {
    const pts = Array.from(nodeMap.values()).map((n) =>
      view === 'deformed' ? n.deformed : n.base
    )
    return computeViewBox(pts)
  }, [nodeMap, view])

  const vbStr = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`

  // ── visual scale helpers ──────────────────────────────────────────────────
  const modelSpan = Math.max(viewBox.width, viewBox.height, 0.1)
  const nodeR = modelSpan * 0.022          // node circle radius
  const strokeW = modelSpan * 0.012        // element stroke width
  const hitW = modelSpan * 0.055           // invisible hit-area stroke width
  const labelOffset = nodeR * 1.6
  const fontSize = modelSpan * 0.045

  // ── load arrow scale ──────────────────────────────────────────────────────
  const arrowLen = modelSpan * 0.12

  return (
    <svg
      className="w-full h-full select-none"
      viewBox={vbStr}
      // SVG Y grows downward; structural Z/Y grows upward → flip
      style={{ transform: 'scaleY(-1)' }}
      onClick={() => onClearSelection()}
    >
      {/* ── grid lines (subtle) ────────────────────────────────────────── */}
      <GridLines viewBox={viewBox} modelSpan={modelSpan} />

      {/* ── elements ───────────────────────────────────────────────────── */}
      {snapshot.elements.map((element) => {
        const startData = nodeMap.get(element.nodeIds[0])
        const endData   = nodeMap.get(element.nodeIds[1])
        if (!startData || !endData) return null

        const start = view === 'deformed' ? startData.deformed : startData.base
        const end   = view === 'deformed' ? endData.deformed   : endData.base

        const isSelected = selectedElementId === element.id
        const isHovered  = hoveredElementId === element.id

        const forceColor = createColorScale(getElementMetric(activeCase, element.id, forceMetric), maxElementMetric)
        const color =
          view === 'forces'  ? forceColor :
          isSelected         ? '#fb923c' :
          isHovered          ? '#67e8f9' :
                               '#38bdf8'

        // label midpoint (in SVG coords, before Y-flip, so we un-flip text)
        const mx = (start.x + end.x) / 2
        const my = (start.y + end.y) / 2

        return (
          <g key={element.id}>
            {/* undeformed ghost */}
            {view === 'deformed' && showUndeformed && (
              <line
                x1={startData.base.x} y1={startData.base.y}
                x2={endData.base.x}   y2={endData.base.y}
                stroke="#64748b" strokeWidth={strokeW * 0.6}
                strokeOpacity={0.45} strokeDasharray={`${strokeW * 2} ${strokeW * 2}`}
                pointerEvents="none"
              />
            )}

            {/* visible element */}
            <line
              x1={start.x} y1={start.y}
              x2={end.x}   y2={end.y}
              stroke={color}
              strokeWidth={isSelected ? strokeW * 1.6 : strokeW}
              strokeLinecap="round"
              pointerEvents="none"
            />

            {/* wide invisible hit area */}
            <line
              x1={start.x} y1={start.y}
              x2={end.x}   y2={end.y}
              stroke="transparent"
              strokeWidth={hitW}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectElement(element.id)
                onSelectNode(null)
              }}
              onMouseEnter={() => setHoveredElementId(element.id)}
              onMouseLeave={() => setHoveredElementId(null)}
            />

            {/* load arrows on elements */}
            {showLoads && view === 'model' && snapshot.loads
              .filter((l) => l.kind === 'distributed' && l.elementId === element.id)
              .map((load, i) => (
                <LoadArrow
                  key={i}
                  origin={{ x: mx, y: my }}
                  vec={project(load.vector, plane)}
                  len={arrowLen}
                  color="#22c55e"
                  strokeW={strokeW}
                />
              ))
            }

            {/* element label (un-flip Y so text is readable) */}
            {showElementLabels && (
              <text
                x={mx} y={my}
                fontSize={fontSize}
                fill="currentColor"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ transform: `translate(0,0) scaleY(-1)`, transformOrigin: `${mx}px ${my}px`, pointerEvents: 'none', opacity: 0.85 }}
              >
                {element.id}
              </text>
            )}
          </g>
        )
      })}

      {/* ── nodes ──────────────────────────────────────────────────────── */}
      {snapshot.nodes.map((node) => {
        const pts = nodeMap.get(node.id)
        if (!pts) return null
        const pos = view === 'deformed' ? pts.deformed : pts.base
        const isSelected = selectedNodeId === node.id
        const isHovered  = hoveredNodeId  === node.id
        const color =
          isSelected ? '#fb923c' :
          isHovered  ? '#67e8f9' :
                       '#f8fafc'

        // support triangle indicator
        const hasRestraints = node.restraints && node.restraints.some(Boolean)

        return (
          <g key={node.id}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectNode(node.id)
              onSelectElement(null)
            }}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
          >
            {/* support marker */}
            {hasRestraints && (
              <SupportMarker cx={pos.x} cy={pos.y} r={nodeR} />
            )}

            {/* node circle */}
            <circle
              cx={pos.x} cy={pos.y}
              r={isSelected ? nodeR * 1.3 : nodeR}
              fill={color}
              stroke={isSelected ? '#f97316' : '#0f172a'}
              strokeWidth={nodeR * 0.25}
            />

            {/* load arrows on nodes */}
            {showLoads && view === 'model' && snapshot.loads
              .filter((l) => l.nodeId === node.id)
              .map((load, i) => (
                <LoadArrow
                  key={i}
                  origin={pos}
                  vec={project(load.vector, plane)}
                  len={arrowLen}
                  color="#22c55e"
                  strokeW={strokeW}
                />
              ))
            }

            {/* node label */}
            {showNodeLabels && (
              <text
                x={pos.x + labelOffset}
                y={pos.y}
                fontSize={fontSize * 0.9}
                fill="currentColor"
                textAnchor="start"
                dominantBaseline="middle"
                style={{
                  transform: `scaleY(-1)`,
                  transformOrigin: `${pos.x}px ${pos.y}px`,
                  pointerEvents: 'none',
                  opacity: 0.9,
                }}
              >
                {node.id}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function GridLines({ viewBox, modelSpan }: { viewBox: ViewBox; modelSpan: number }) {
  const step = Math.pow(10, Math.floor(Math.log10(modelSpan))) / 2
  const lines: JSX.Element[] = []
  const startX = Math.floor(viewBox.minX / step) * step
  const endX   = viewBox.minX + viewBox.width
  const startY = Math.floor(viewBox.minY / step) * step
  const endY   = viewBox.minY + viewBox.height
  const gridColor = 'rgba(100,116,139,0.18)'

  for (let x = startX; x <= endX; x += step) {
    lines.push(
      <line key={`gx${x}`}
        x1={x} y1={viewBox.minY}
        x2={x} y2={viewBox.minY + viewBox.height}
        stroke={gridColor} strokeWidth={modelSpan * 0.002}
      />
    )
  }
  for (let y = startY; y <= endY; y += step) {
    lines.push(
      <line key={`gy${y}`}
        x1={viewBox.minX} y1={y}
        x2={viewBox.minX + viewBox.width} y2={y}
        stroke={gridColor} strokeWidth={modelSpan * 0.002}
      />
    )
  }
  return <g pointerEvents="none">{lines}</g>
}

function SupportMarker({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const size = r * 1.8
  const pts = `${cx},${cy - r} ${cx - size},${cy - r - size} ${cx + size},${cy - r - size}`
  return (
    <polygon
      points={pts}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={r * 0.35}
      pointerEvents="none"
    />
  )
}

function LoadArrow({
  origin,
  vec,
  len,
  color,
  strokeW,
}: {
  origin: Point2D
  vec: Point2D
  len: number
  color: string
  strokeW: number
}) {
  const mag = Math.sqrt(vec.x ** 2 + vec.y ** 2)
  if (mag < 1e-10) return null
  const nx = (vec.x / mag) * len
  const ny = (vec.y / mag) * len
  const tip: Point2D = { x: origin.x + nx, y: origin.y + ny }
  const hw = len * 0.22  // arrowhead half-width
  const hl = len * 0.28  // arrowhead length
  // perpendicular
  const px = (-ny / len) * hw
  const py = (nx / len) * hw
  const base: Point2D = { x: tip.x - (nx / len) * hl, y: tip.y - (ny / len) * hl }

  return (
    <g pointerEvents="none">
      <line
        x1={origin.x} y1={origin.y}
        x2={base.x}   y2={base.y}
        stroke={color} strokeWidth={strokeW * 0.7} strokeLinecap="round"
      />
      <polygon
        points={`${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`}
        fill={color}
      />
    </g>
  )
}
