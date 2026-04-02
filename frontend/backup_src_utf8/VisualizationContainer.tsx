'use client'

import { useState } from 'react'
import { StructuralScene } from './structural-scene'
import { SceneControls } from './SceneControls'
import type { VisualizationSnapshot, VisualizationCase, VisualizationPlane, VisualizationViewMode } from './types'
import type { ForceMetric } from './structural-scene'

interface VisualizationContainerProps {
  snapshot: VisualizationSnapshot
  activeCase: VisualizationCase
  plane: VisualizationPlane
  view: VisualizationViewMode
}

export function VisualizationContainer({
  snapshot,
  activeCase,
  plane,
  view,
}: VisualizationContainerProps) {
  const [forceMetric, setForceMetric] = useState<ForceMetric>('axial')
  const [deformationScale, setDeformationScale] = useState(1)
  const [showUndeformed, setShowUndeformed] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)

  return (
    <div className="relative w-full h-full">
      <StructuralScene
        snapshot={snapshot}
        activeCase={activeCase}
        plane={plane}
        view={view}
        forceMetric={forceMetric}
        deformationScale={deformationScale}
        selectedNodeId={selectedNodeId}
        selectedElementId={selectedElementId}
        onSelectNode={setSelectedNodeId}
        onSelectElement={setSelectedElementId}
        onClearSelection={() => { setSelectedNodeId(null); setSelectedElementId(null) }}
        showNodeLabels={true}
        showElementLabels={true}
        showLoads={true}
        showUndeformed={showUndeformed}
        showLegend={true}
        resetToken={0}
        t={(key) => key}
        enableExtraControls={true}
        onChangeForceMetric={setForceMetric}
        onChangeScale={setDeformationScale}
        onToggleUndeformed={() => setShowUndeformed((prev) => !prev)}
      />

      {/* ¿É²ðÐ¶¿ØÖÆÃæ°å */}
      <SceneControls
        forceMetric={forceMetric}
        onChangeForceMetric={setForceMetric}
        deformationScale={deformationScale}
        onChangeScale={setDeformationScale}
        showUndeformed={showUndeformed}
        onToggleUndeformed={() => setShowUndeformed((prev) => !prev)}
      />
    </div>
  )
}