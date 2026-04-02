'use client'

import { useState } from 'react'
import type { ForceMetric } from './structural-scene'

interface SceneControlsProps {
  forceMetric: ForceMetric
  onChangeForceMetric: (metric: ForceMetric) => void
  deformationScale: number
  onChangeScale: (scale: number) => void
  showUndeformed: boolean
  onToggleUndeformed: () => void
}

export function SceneControls({
  forceMetric,
  onChangeForceMetric,
  deformationScale,
  onChangeScale,
  showUndeformed,
  onToggleUndeformed,
}: SceneControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 p-2 rounded-lg border border-border/70 bg-background/90 shadow-lg">
      {/* Force Metric */}
      <div className="flex gap-1">
        <button
          className={`px-2 py-1 text-sm rounded ${forceMetric === 'axial' ? 'bg-blue-500 text-white' : ''}`}
          onClick={() => onChangeForceMetric('axial')}
        >
          Axial
        </button>
        <button
          className={`px-2 py-1 text-sm rounded ${forceMetric === 'shear' ? 'bg-blue-500 text-white' : ''}`}
          onClick={() => onChangeForceMetric('shear')}
        >
          Shear
        </button>
        <button
          className={`px-2 py-1 text-sm rounded ${forceMetric === 'moment' ? 'bg-blue-500 text-white' : ''}`}
          onClick={() => onChangeForceMetric('moment')}
        >
          Moment
        </button>
      </div>

      {/* Deformation Scale Slider */}
      <div className="flex flex-col gap-1">
        <label className="text-xs">Scale: {deformationScale.toFixed(2)}</label>
        <input
          type="range"
          min={0}
          max={5}
          step={0.05}
          value={deformationScale}
          onChange={(e) => onChangeScale(Number(e.target.value))}
        />
      </div>

      {/* Show Undeformed Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showUndeformed}
          onChange={onToggleUndeformed}
        />
        <label className="text-xs">Show Undeformed</label>
      </div>
    </div>
  )
}