import type { MessageKey } from '@/lib/i18n'
import type { VisualizationCase, VisualizationElement, VisualizationSnapshot, VisualizationViewMode } from './types'

export type ForceMetric = 'axial' | 'shear' | 'moment'

export function getCaseMaxDisplacementMagnitude(activeCase: VisualizationCase | null) {
  if (!activeCase) return 0

  return Object.values(activeCase.nodeResults).reduce((max, result) => {
    const magnitude =
      activeCase.kind === 'envelope'
        ? Number(result.envelope?.maxAbsDisplacement || 0)
        : Math.sqrt(
            (result.displacement?.ux || 0) ** 2 +
            (result.displacement?.uy || 0) ** 2 +
            (result.displacement?.uz || 0) ** 2
          )
    return Math.max(max, magnitude)
  }, 0)
}

export function getCaseMaxReactionMagnitude(activeCase: VisualizationCase | null) {
  if (!activeCase) return 0

  return Object.values(activeCase.nodeResults).reduce((max, result) => {
    const magnitude =
      activeCase.kind === 'envelope'
        ? Number(result.envelope?.maxAbsReaction || 0)
        : Math.sqrt(
            (result.reaction?.fx || 0) ** 2 +
            (result.reaction?.fy || 0) ** 2 +
            (result.reaction?.fz || 0) ** 2
          )
    return Math.max(max, magnitude)
  }, 0)
}

export function getCaseMaxElementMetric(
  activeCase: VisualizationCase | null,
  forceMetric: ForceMetric
) {
  if (!activeCase) return 0

  return Object.values(activeCase.elementResults).reduce((max, result) => {
    let value = 0

    if (activeCase.kind === 'envelope') {
      if (forceMetric === 'axial') value = Number(result.envelope?.maxAbsAxialForce || 0)
      else if (forceMetric === 'shear') value = Number(result.envelope?.maxAbsShearForce || 0)
      else value = Number(result.envelope?.maxAbsMoment || 0)
    } else {
      if (forceMetric === 'axial') value = Number(result.axial || 0)
      else if (forceMetric === 'shear') value = Number(result.shear || 0)
      else value = Number(result.moment || 0)
    }

    return Math.max(max, Math.abs(value))
  }, 0)
}

export function formatRestraints(restraints?: boolean[]) {
  if (!restraints || restraints.length < 6) return '-'

  const labels = ['UX', 'UY', 'UZ', 'RX', 'RY', 'RZ']
  return labels
    .map((label, index) => `${label}=${restraints[index] ? 'Fixed' : 'Free'}`)
    .join(', ')
}

export function resolveElementDisplayTypeLabel(
  element: VisualizationElement,
  t: (key: MessageKey) => string
) {
  const displayType = element.displayType || 'other'

  if (displayType === 'beam') return t('visualizationDisplayTypeBeam')
  if (displayType === 'column') return t('visualizationDisplayTypeColumn')
  if (displayType === 'brace') return t('visualizationDisplayTypeBrace')
  if (displayType === 'truss') return t('visualizationDisplayTypeTruss')
  return t('visualizationDisplayTypeOther')
}

export function resolveViewLabel(
  view: VisualizationViewMode,
  t: (key: MessageKey) => string
) {
  if (view === 'model') return t('visualizationViewModel')
  if (view === 'deformed') return t('visualizationViewDeformed')
  if (view === 'forces') return t('visualizationViewForces')
  return t('visualizationViewReactions')
}

export function resolveForceMetricLabel(
  forceMetric: ForceMetric,
  t: (key: MessageKey) => string
) {
  if (forceMetric === 'axial') return t('visualizationForceAxial')
  if (forceMetric === 'shear') return t('visualizationForceShear')
  return t('visualizationForceMoment')
}

export function isSteelFrameLike(snapshot: VisualizationSnapshot | null) {
  if (!snapshot) return false

  const frameLikeTypes = new Set(['beam', 'truss'])
  const frameLikeCount = snapshot.elements.filter((element) => frameLikeTypes.has(element.type)).length

  return frameLikeCount > 0
}