'use client'

import type { MessageKey } from '@/lib/i18n'
import type { AppLocale } from '@/lib/stores/slices/preferences'
import { formatNumber } from '@/lib/utils'
import type { VisualizationCase, VisualizationSnapshot, VisualizationViewMode } from './types'
import {
  getCaseMaxDisplacementMagnitude,
  getCaseMaxElementMetric,
  getCaseMaxReactionMagnitude,
  resolveForceMetricLabel,
  resolveViewLabel,
  type ForceMetric,
} from './steel-frame-utils'

type SteelFrameSummaryProps = {
  snapshot: VisualizationSnapshot
  activeCase: VisualizationCase | null
  view: VisualizationViewMode
  forceMetric: ForceMetric
  locale: AppLocale
  t: (key: MessageKey) => string
}

function withUnit(value: string, unit?: string) {
  return unit ? `${value} ${unit}` : value
}

export function SteelFrameSummary({
  snapshot,
  activeCase,
  view,
  forceMetric,
  locale,
  t,
}: SteelFrameSummaryProps) {
  const maxDisplacement =
    getCaseMaxDisplacementMagnitude(activeCase) * (snapshot.displacementDisplayFactor || 1)
  const maxReaction = getCaseMaxReactionMagnitude(activeCase)
  const maxForce = getCaseMaxElementMetric(activeCase, forceMetric)

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {t('visualizationSteelFrameSummary')}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryNodes')}</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {formatNumber(snapshot.nodes.length, locale)}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryElements')}</div>
          <div className="mt-1 text-base font-semibold text-foreground">
            {formatNumber(snapshot.elements.length, locale)}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryView')}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {resolveViewLabel(view, t)}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryMetric')}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {resolveForceMetricLabel(forceMetric, t)}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryMaxDisplacement')}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {withUnit(
              formatNumber(maxDisplacement, locale),
              snapshot.displacementUnit || snapshot.nodeLabelUnit
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryMaxReaction')}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {withUnit(formatNumber(maxReaction, locale), snapshot.resultUnit)}
          </div>
        </div>

        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">{t('visualizationSummaryMaxForce')}</div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {withUnit(
              formatNumber(maxForce, locale),
              forceMetric === 'moment' ? snapshot.momentUnit : snapshot.resultUnit
            )}
          </div>
        </div>
      </div>
    </div>
  )
}