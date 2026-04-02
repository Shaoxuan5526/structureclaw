'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, Bot, BrainCircuit, Clock3, Cuboid, FileText, Loader2, MessageSquarePlus, Orbit, Sparkles, Trash2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { buildVisualizationSnapshot } from '@/components/visualization/adapter'
import type { VisualizationSnapshot } from '@/components/visualization/types'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { AppLocale } from '@/lib/stores/slices/preferences'
import { fetchLatestModel, type LatestModelResponse } from '@/lib/api'
import { API_BASE } from '@/lib/api-base'
import { cn, formatDate, formatNumber } from '@/lib/utils'

const StructuralVisualizationModal = dynamic(
  () => import('@/components/visualization/modal').then((mod) => mod.StructuralVisualizationModal),
  { ssr: false }
)

type AnalysisType = 'static' | 'dynamic' | 'seismic' | 'nonlinear'
type PanelTab = 'analysis' | 'report'
type ComposerAction = 'chat' | 'execute'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: 'streaming' | 'done' | 'error'
  timestamp: string
  debugDetails?: MessageDebugDetails
}

type AgentToolCall = {
  tool: string
  input?: Record<string, unknown>
  status: 'success' | 'error'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  output?: unknown
  error?: string
}

type MessageDebugDetails = {
  promptSnapshot: string
  skillIds: string[]
  routing?: {
    selectedSkillIds: string[]
    structuralSkillId?: string
    structuralScenarioKey?: string
    analysisSkillId?: string
    analysisSkillIds?: string[]
  }
  responseSummary: string
  plan: string[]
  toolCalls: AgentToolCall[]
}

type MessageMetadata = {
  debugDetails?: MessageDebugDetails
}

type AgentInteraction = {
  detectedScenario?: string
  detectedScenarioLabel?: string
  conversationStage?: string
  missingCritical?: string[]
  missingOptional?: string[]
  fallbackSupportNote?: string
  recommendedNextStep?: string
  questions?: Array<{ question?: string; label?: string }>
  pending?: { criticalMissing?: string[]; nonCriticalMissing?: string[] }
}

type AgentResult = {
  response?: string
  traceId?: string
  success?: boolean
  needsModelInput?: boolean
  plan?: string[]
  toolCalls?: AgentToolCall[]
  interaction?: AgentInteraction
  analysis?: Record<string, unknown>
  report?: {
    summary?: string
    markdown?: string
  }
  clarification?: {
    question?: string
    missingFields?: string[]
  }
  model?: Record<string, unknown>
  data?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  durationMs?: number
  requestedEngineId?: string
  routing?: MessageDebugDetails['routing']
}

type StreamPayload =
  | { type: 'start'; content?: { traceId?: string; conversationId?: string; startedAt?: string } }
  | { type: 'token'; content?: string }
  | { type: 'interaction_update'; content?: AgentInteraction }
  | { type: 'result'; content?: AgentResult }
  | { type: 'done' }
  | { type: 'error'; error?: string }

type ConversationSummary = {
  id: string
  title: string
  type?: string
  createdAt?: string
  updatedAt?: string
}

type AgentSessionSnapshot = {
  draft?: Record<string, unknown>
  resolved?: {
    analysisType?: AnalysisType
    designCode?: string
    autoCodeCheck?: boolean
    includeReport?: boolean
    reportFormat?: 'json' | 'markdown' | 'both'
    reportOutput?: 'inline' | 'file'
  }
  interaction?: AgentInteraction
  model?: Record<string, unknown>
  updatedAt?: number
}

type ConversationDetail = ConversationSummary & {
  messages?: Array<{ id: string; role: string; content: string; createdAt: string; metadata?: MessageMetadata }>
  session?: AgentSessionSnapshot | null
  snapshots?: {
    modelSnapshot?: VisualizationSnapshot | null
    resultSnapshot?: VisualizationSnapshot | null
    latestResult?: AgentResult | null
  } | null
}

async function saveConversationSnapshotToBackend(
  conversationId: string,
  params: {
    modelSnapshot?: VisualizationSnapshot | null
    resultSnapshot?: VisualizationSnapshot | null
    latestResult?: AgentResult | null
  }
): Promise<void> {
  if (!conversationId) return

  try {
    await fetch(`${API_BASE}/api/v1/chat/conversation/${conversationId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelSnapshot: params.modelSnapshot,
        resultSnapshot: params.resultSnapshot,
        latestResult: params.latestResult,
      }),
    });
  } catch (error) {
    console.warn('Failed to save snapshot to backend:', error);
  }
}

type PersistedConversation = ConversationSummary & {
  messages: Message[]
  modelText?: string
  designCode?: string
  selectedSkillIds?: string[]
  modelSyncMessage?: string
  activePanel?: PanelTab
  latestResult?: AgentResult | null
  modelVisualizationSnapshot?: VisualizationSnapshot | null
  resultVisualizationSnapshot?: VisualizationSnapshot | null
  visualizationSnapshot?: VisualizationSnapshot | null
}

type AgentSkillSummary = {
  id: string
  name: { zh?: string; en?: string }
  description: { zh?: string; en?: string }
  structureType?: string
  stages?: string[]
  triggers?: string[]
  autoLoadByDefault?: boolean
}

type SkillDomain =
  | 'analysis'
  | 'code-check'
  | 'data-input'
  | 'design'
  | 'drawing'
  | 'general'
  | 'load-boundary'
  | 'material'
  | 'report-export'
  | 'result-postprocess'
  | 'section'
  | 'structure-type'
  | 'validation'
  | 'visualization'
  | 'unknown'

const ALL_SKILL_DOMAINS: SkillDomain[] = [
  'analysis',
  'code-check',
  'data-input',
  'design',
  'drawing',
  'general',
  'load-boundary',
  'material',
  'report-export',
  'result-postprocess',
  'section',
  'structure-type',
  'validation',
  'visualization',
]

type CapabilitySkillSummary = {
  id: string
  domain?: SkillDomain
}

type CapabilityDomainSummary = {
  domain: SkillDomain
  skillIds?: string[]
  autoLoadSkillIds?: string[]
}

type CapabilityMatrixPayload = {
  skills?: CapabilitySkillSummary[]
  domainSummaries?: CapabilityDomainSummary[]
  skillDomainById?: Record<string, SkillDomain>
  validEngineIdsBySkill?: Record<string, string[]>
  filteredEngineReasonsBySkill?: Record<string, Record<string, string[]>>
}

type SkillHubCatalogItem = {
  id: string
  version?: string
  domain?: SkillDomain
  name?: { zh?: string; en?: string }
  description?: { zh?: string; en?: string }
  installed?: boolean
  enabled?: boolean
}

type SkillHubInstalledItem = {
  id: string
  version?: string
  enabled?: boolean
}

function normalizeSkillDomain(value: unknown): SkillDomain {
  const raw = typeof value === 'string' ? value : ''
  if (ALL_SKILL_DOMAINS.includes(raw as SkillDomain)) {
    return raw as SkillDomain
  }
  if (raw === 'analysis-strategy') {
    return 'analysis'
  }
  if (raw === 'generic-fallback') {
    return 'general'
  }
  if (raw === 'geometry-input') {
    return 'data-input'
  }
  if (raw === 'material-constitutive') {
    return 'material'
  }
  return 'unknown'
}

function resolveSkillDomainLabel(domain: SkillDomain, t: (key: MessageKey) => string) {
  if (domain === 'analysis') return t('skillDomainAnalysis')
  if (domain === 'data-input') return t('skillDomainDataInput')
  if (domain === 'design') return t('skillDomainDesign')
  if (domain === 'drawing') return t('skillDomainDrawing')
  if (domain === 'general') return t('skillDomainGeneral')
  if (domain === 'material') return t('skillDomainMaterial')
  if (domain === 'section') return t('skillDomainSection')
  if (domain === 'structure-type') return t('skillDomainStructureType')
  if (domain === 'load-boundary') return t('skillDomainLoadBoundary')
  if (domain === 'code-check') return t('skillDomainCodeCheck')
  if (domain === 'result-postprocess') return t('skillDomainResultPostprocess')
  if (domain === 'visualization') return t('skillDomainVisualization')
  if (domain === 'report-export') return t('skillDomainReportExport')
  if (domain === 'validation') return t('skillDomainValidation')
  return t('skillDomainUnknown')
}

const STORAGE_KEY = 'structureclaw.console.conversations'

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildPromptSnapshot(message: string, context: Record<string, unknown>) {
  return JSON.stringify({ message, context }, null, 2)
}

function toObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function normalizeToolCalls(value: unknown): AgentToolCall[] {
  const rawToolCalls = Array.isArray(value) ? value : []
  return rawToolCalls.map((call) => {
    const status: AgentToolCall['status'] = call?.status === 'error' ? 'error' : 'success'
    return {
      tool: typeof call?.tool === 'string' ? call.tool : 'unknown_tool',
      input: toObjectRecord(call?.input),
      status,
      startedAt: typeof call?.startedAt === 'string' ? call.startedAt : undefined,
      completedAt: typeof call?.completedAt === 'string' ? call.completedAt : undefined,
      durationMs: typeof call?.durationMs === 'number' ? call.durationMs : undefined,
      output: call?.output,
      error: typeof call?.error === 'string' ? call.error : undefined,
    }
  })
}

function parsePersistedDebugDetails(metadata: unknown): MessageDebugDetails | undefined {
  const metadataRecord = toObjectRecord(metadata)
  const debugRecord = toObjectRecord(metadataRecord?.debugDetails)
  if (!debugRecord) {
    return undefined
  }

  const promptSnapshot = typeof debugRecord.promptSnapshot === 'string'
    ? debugRecord.promptSnapshot
    : ''
  const skillIds = Array.isArray(debugRecord.skillIds)
    ? debugRecord.skillIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  const responseSummary = typeof debugRecord.responseSummary === 'string' ? debugRecord.responseSummary : ''
  const plan = Array.isArray(debugRecord.plan) ? debugRecord.plan.filter((item): item is string => typeof item === 'string') : []
  const toolCalls = normalizeToolCalls(debugRecord.toolCalls)
  const routingRecord = toObjectRecord(debugRecord.routing)
  const routing = routingRecord
    ? {
        selectedSkillIds: Array.isArray(routingRecord.selectedSkillIds)
          ? routingRecord.selectedSkillIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : skillIds,
        structuralSkillId: typeof routingRecord.structuralSkillId === 'string' ? routingRecord.structuralSkillId : undefined,
        structuralScenarioKey: typeof routingRecord.structuralScenarioKey === 'string' ? routingRecord.structuralScenarioKey : undefined,
        analysisSkillId: typeof routingRecord.analysisSkillId === 'string' ? routingRecord.analysisSkillId : undefined,
        analysisSkillIds: Array.isArray(routingRecord.analysisSkillIds)
          ? routingRecord.analysisSkillIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : undefined,
      }
    : undefined

  if (!promptSnapshot && skillIds.length === 0 && !routing && !responseSummary && plan.length === 0 && toolCalls.length === 0) {
    return undefined
  }

  return {
    promptSnapshot,
    skillIds,
    routing,
    responseSummary,
    plan,
    toolCalls,
  }
}

function buildMessageDebugDetails(promptSnapshot: string, skillIds: string[], result: AgentResult): MessageDebugDetails {
  const safeToolCalls = normalizeToolCalls(result.toolCalls)

  return {
    promptSnapshot,
    skillIds,
    routing: result.routing,
    responseSummary: result.response || '',
    plan: Array.isArray(result.plan) ? result.plan : [],
    toolCalls: safeToolCalls,
  }
}

function formatDebugPayload(value: unknown, fallback: string) {
  if (value === undefined) {
    return fallback
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toModelText(model?: Record<string, unknown> | null) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return ''
  }
  return JSON.stringify(model, null, 2)
}

function toModelFromVisualizationSnapshot(snapshot?: VisualizationSnapshot | null): Record<string, unknown> | null {
  if (!snapshot) {
    return null
  }

  const model: Record<string, unknown> = {
    schema_version: '1.0.0',
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
      ...(Array.isArray(node.restraints) ? { restraints: node.restraints } : {}),
    })),
    elements: snapshot.elements.map((element) => ({
      id: element.id,
      type: element.type,
      nodes: element.nodeIds,
      ...(typeof element.material === 'string' ? { material: element.material } : {}),
      ...(typeof element.section === 'string' ? { section: element.section } : {}),
    })),
  }

  if (Array.isArray(snapshot.loads) && snapshot.loads.length > 0) {
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    snapshot.loads.forEach((load) => {
      const key = load.caseId || 'default'
      const bucket = grouped.get(key) || []
      if (load.kind === 'distributed' && load.elementId) {
        bucket.push({ element: load.elementId, wy: load.vector.y, wz: load.vector.z })
      } else if (load.nodeId) {
        bucket.push({ node: load.nodeId, fx: load.vector.x, fy: load.vector.y, fz: load.vector.z })
      }
      grouped.set(key, bucket)
    })

    const loadCases = Array.from(grouped.entries())
      .filter(([, loads]) => loads.length > 0)
      .map(([id, loads]) => ({ id, loads }))

    if (loadCases.length > 0) {
      model.load_cases = loadCases
    }
  }

  return model
}

function toModelTextFromSnapshot(snapshot?: VisualizationSnapshot | null) {
  return toModelText(toModelFromVisualizationSnapshot(snapshot))
}

function loadConversationArchive(): Record<string, PersistedConversation> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const migrated: Record<string, PersistedConversation> = {}

    Object.entries(parsed as Record<string, PersistedConversation>).forEach(([conversationId, value]) => {
      const archived = value as PersistedConversation
      const normalizedLatestResult = normalizeAgentResultPayload(archived.latestResult || null)
      const preferredStoredResultSnapshot = pickPreferredResultSnapshot(
        archived.resultVisualizationSnapshot,
        archived.visualizationSnapshot
      )
      const synthesizedResultSnapshot = buildResultSnapshotFromResult(
        normalizedLatestResult,
        archived.title || 'Conversation',
        toModelFromVisualizationSnapshot(archived.modelVisualizationSnapshot || preferredStoredResultSnapshot)
      )
      const repairedResultSnapshot = pickPreferredResultSnapshot(preferredStoredResultSnapshot, synthesizedResultSnapshot)

      migrated[conversationId] = {
        ...archived,
        latestResult: normalizedLatestResult,
        resultVisualizationSnapshot: repairedResultSnapshot,
        visualizationSnapshot: repairedResultSnapshot || archived.visualizationSnapshot || null,
      }
    })

    return migrated
  } catch {
    return {}
  }
}

function parseModelJson(modelText: string, t: (key: MessageKey) => string): { model?: Record<string, unknown>; error?: string } {
  const trimmed = modelText.trim()
  if (!trimmed) {
    return {}
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: t('modelJsonMustBeObject') }
    }
    return { model: parsed as Record<string, unknown> }
  } catch (error) {
    return {
      error: error instanceof Error ? `${t('modelJsonParseFailed')}: ${error.message}` : `${t('modelJsonParseFailed')}.`,
    }
  }
}

function buildInteractionMessage(
  payload: Extract<StreamPayload, { type: 'interaction_update' }>,
  t: (key: MessageKey) => string,
  locale: AppLocale
) {
  const questions = payload.content?.questions || []
  const detectedScenario = payload.content?.detectedScenarioLabel
  const conversationStage = payload.content?.conversationStage
  const fallbackSupportNote = payload.content?.fallbackSupportNote
  const recommendedNextStep = payload.content?.recommendedNextStep
  const criticalMissing = payload.content?.pending?.criticalMissing || []
  const lines: string[] = []

  if (detectedScenario) {
    lines.push(`${t('guidanceDetectedScenario')}: ${detectedScenario}`)
  }
  if (conversationStage) {
    lines.push(`${t('guidanceCurrentStage')}: ${conversationStage}`)
  }
  if (fallbackSupportNote) {
    lines.push(fallbackSupportNote)
  }

  if (questions.length > 0) {
    lines.push(...questions
      .map((item) => item.question || item.label)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  }

  if (criticalMissing.length > 0) {
    lines.push(`${t('interactionMissingInfo')}: ${criticalMissing.join(locale === 'zh' ? '銆?' : ', ')}`)
  }

  if (recommendedNextStep) {
    lines.push(`${t('guidanceRecommendedNextStep')}: ${recommendedNextStep}`)
  }

  return lines.length > 0 ? lines.join('\n') : t('interactionNeedMoreParams')
}

function normalizeAgentResultPayload(result: AgentResult | null | undefined): AgentResult | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const record = result as Record<string, unknown>
  const wrapped = record.result
  if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
    const wrappedRecord = wrapped as Record<string, unknown>
    const hasTopLevelResultData = Boolean(
      result.analysis
      || result.data
      || result.model
      || result.response
      || result.report
    )
    const hasWrappedResultData = Boolean(
      wrappedRecord.analysis
      || wrappedRecord.data
      || wrappedRecord.model
      || wrappedRecord.response
      || wrappedRecord.report
    )
    if (!hasTopLevelResultData && hasWrappedResultData) {
      return wrapped as AgentResult
    }
  }

  return result
}

function extractAnalysis(result: AgentResult | null) {
  if (!result) return null
  const normalized = normalizeAgentResultPayload(result)
  if (!normalized) return null
  if (normalized.analysis && typeof normalized.analysis === 'object') {
    return normalized.analysis
  }
  if (normalized.data && typeof normalized.data === 'object') {
    return normalized.data
  }
  return null
}

function hasAnalysisPayload(result: AgentResult | null | undefined) {
  return Boolean(extractAnalysis(result ?? null))
}

function pickPreferredLatestResult(
  primary: AgentResult | null | undefined,
  secondary: AgentResult | null | undefined
) {
  const normalizedPrimary = normalizeAgentResultPayload(primary ?? null)
  const normalizedSecondary = normalizeAgentResultPayload(secondary ?? null)

  const primaryHasAnalysis = hasAnalysisPayload(normalizedPrimary)
  const secondaryHasAnalysis = hasAnalysisPayload(normalizedSecondary)

  if (primaryHasAnalysis && secondaryHasAnalysis) {
    return normalizedPrimary
  }
  if (primaryHasAnalysis) {
    return normalizedPrimary
  }
  if (secondaryHasAnalysis) {
    return normalizedSecondary
  }

  return normalizedPrimary ?? normalizedSecondary ?? null
}

function buildVisualizationTitle(result: AgentResult | null, conversationTitle: string) {
  const analysis = extractAnalysis(result)
  const meta = analysis && typeof analysis.meta === 'object' && analysis.meta ? (analysis.meta as Record<string, unknown>) : null
  const analysisType = typeof meta?.analysisType === 'string' ? meta.analysisType : typeof analysis?.analysis_type === 'string' ? analysis.analysis_type : ''
  return analysisType ? `${conversationTitle} 路 ${analysisType}` : conversationTitle
}

function buildModelVisualizationTitle(baseTitle: string, t: (key: MessageKey) => string) {
  return `${baseTitle} 路 ${t('visualizationSourceModel')}`
}

function snapshotHasResultData(snapshot?: VisualizationSnapshot | null) {
  if (!snapshot || !Array.isArray(snapshot.cases)) {
    return false
  }

  return snapshot.cases.some((item) => {
    const nodeResults = item && typeof item === 'object' && item.nodeResults && typeof item.nodeResults === 'object'
      ? Object.values(item.nodeResults)
      : []
    const elementResults = item && typeof item === 'object' && item.elementResults && typeof item.elementResults === 'object'
      ? Object.values(item.elementResults)
      : []

    const hasNodeResult = nodeResults.some((entry) => {
      const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
      const displacement = record?.displacement && typeof record.displacement === 'object'
        ? (record.displacement as Record<string, unknown>)
        : null
      const reaction = record?.reaction && typeof record.reaction === 'object'
        ? (record.reaction as Record<string, unknown>)
        : null
      const envelope = record?.envelope && typeof record.envelope === 'object'
        ? (record.envelope as Record<string, unknown>)
        : null
      return Boolean(displacement || reaction || envelope)
    })

    const hasElementResult = elementResults.some((entry) => {
      const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
      return Boolean(
        record
        && (
          typeof record.axial === 'number'
          || typeof record.shear === 'number'
          || typeof record.moment === 'number'
          || typeof record.torsion === 'number'
          || (record.envelope && typeof record.envelope === 'object')
        )
      )
    })

    return hasNodeResult || hasElementResult
  })
}

function isResultVisualizationSnapshot(snapshot?: VisualizationSnapshot | null) {
  if (!snapshot) {
    return false
  }
  const hasResultViews = snapshot.availableViews.some((view) => view === 'deformed' || view === 'forces' || view === 'reactions')
  const hasResultData = snapshotHasResultData(snapshot)
  if (snapshot.source === 'result') {
    return true
  }
  // Legacy archives may carry model snapshots with unexpected case kinds.
  // For model-source snapshots, rely on actual result views/data only.
  if (snapshot.source === 'model') {
    return hasResultViews || hasResultData
  }
  return hasResultViews
    || snapshot.cases.some((item) => item.kind === 'result' || item.kind === 'envelope')
    || hasResultData
}

function pickPreferredResultSnapshot(
  primary?: VisualizationSnapshot | null,
  secondary?: VisualizationSnapshot | null
): VisualizationSnapshot | null {
  const primaryIsResult = isResultVisualizationSnapshot(primary)
  const secondaryIsResult = isResultVisualizationSnapshot(secondary)

  if (primaryIsResult && secondaryIsResult) {
    return primary ?? null
  }
  if (primaryIsResult) {
    return primary ?? null
  }
  if (secondaryIsResult) {
    return secondary ?? null
  }
  return primary ?? secondary ?? null
}

function buildResultSnapshotFromResult(
  result: AgentResult | null | undefined,
  title: string,
  fallbackModel?: Record<string, unknown> | null
): VisualizationSnapshot | null {
  const normalizedResult = normalizeAgentResultPayload(result ?? null)
  if (!normalizedResult) {
    console.log('visualization result = null')
    return null
  }

  const modelFromResult =
    normalizedResult.model && typeof normalizedResult.model === 'object' && !Array.isArray(normalizedResult.model)
      ? normalizedResult.model
      : null

  console.log('visualization result =', normalizedResult)
  console.log('visualization model from result =', modelFromResult)
  console.log('visualization fallback model =', fallbackModel)
  console.log('visualization final model =', modelFromResult ?? fallbackModel ?? null)

  return buildVisualizationSnapshot({
    title: buildVisualizationTitle(normalizedResult, title),
    model: modelFromResult ?? fallbackModel ?? null,
    analysis: extractAnalysis(normalizedResult),
    mode: 'analysis-result',
  })
}

function extractSummaryStats(
  analysis: Record<string, unknown> | null,
  t: (key: MessageKey) => string,
  locale: AppLocale
) {
  if (!analysis) return []
  const data = typeof analysis.data === 'object' && analysis.data ? (analysis.data as Record<string, unknown>) : analysis
  const meta = typeof analysis.meta === 'object' && analysis.meta ? (analysis.meta as Record<string, unknown>) : null
  const summary = typeof data.summary === 'object' && data.summary ? (data.summary as Record<string, unknown>) : null

  const stats: Array<{ label: string; value: string }> = []

  const candidatePairs: Array<[string, unknown]> = [
    [t('analysisOverviewCountsNodes'), summary?.nodeCount ?? meta?.nodeCount],
    [t('analysisOverviewCountsElements'), summary?.elementCount ?? meta?.elementCount],
    [t('analysisOverviewCountsLoadCases'), summary?.loadCaseCount ?? meta?.loadCaseCount],
    [t('analysisOverviewCountsCombinations'), summary?.combinationCount ?? meta?.combinationCount],
  ]

  candidatePairs.forEach(([label, value]) => {
    if (typeof value === 'number') {
      stats.push({ label, value: formatNumber(value, locale) })
    }
  })

  return stats
}

function extractEngineLabel(
  analysis: Record<string, unknown> | null,
  result: AgentResult | null,
  t: (key: MessageKey) => string
) {
  if (!analysis) return null
  const meta = typeof analysis.meta === 'object' && analysis.meta ? (analysis.meta as Record<string, unknown>) : null
  if (!meta) return null

  const requestedEngineId = typeof result?.requestedEngineId === 'string' ? result.requestedEngineId.trim() : ''
  const engineName = typeof meta.engineName === 'string' ? meta.engineName.trim() : ''
  const engineVersion = typeof meta.engineVersion === 'string' ? meta.engineVersion.trim() : ''
  const engineId = typeof meta.engineId === 'string' ? meta.engineId.trim() : ''
  const selectionMode = typeof meta.selectionMode === 'string' ? meta.selectionMode.trim() : ''
  const fallbackFrom = typeof meta.fallbackFrom === 'string' ? meta.fallbackFrom.trim() : ''
  const unavailableReason = typeof meta.unavailableReason === 'string' ? meta.unavailableReason.trim() : ''

  if (!engineName && !engineVersion) {
    return null
  }

  const value = engineName && engineVersion ? `${engineName} v${engineVersion}` : engineName || engineVersion
  const modeLabel =
    selectionMode === 'manual'
      ? t('analysisEngineModeManual')
      : selectionMode === 'fallback'
        ? t('analysisEngineModeFallback')
        : t('analysisEngineModeAuto')
  return {
    label: t('analysisEngineLabel'),
    value,
    engineId,
    requestedEngineId,
    modeLabel,
    fallbackFrom,
    unavailableReason,
  }
}

function AnalysisPanel({
  result,
  modelVisualizationSnapshot,
  visualizationSnapshot,
  onOpenVisualization,
  activeTab,
  onTabChange,
  t,
  locale,
}: {
  result: AgentResult | null
  modelVisualizationSnapshot: VisualizationSnapshot | null
  visualizationSnapshot: VisualizationSnapshot | null
  onOpenVisualization: (source: 'result' | 'model') => void
  activeTab: PanelTab
  onTabChange: (tab: PanelTab) => void
  t: (key: MessageKey) => string
  locale: AppLocale
}) {
  const analysis = extractAnalysis(result)
  const stats = extractSummaryStats(analysis, t, locale)
  const engineInfo = extractEngineLabel(analysis, result, t)
  const reportMarkdown = result?.report?.markdown?.trim()
  const reportSummary = result?.report?.summary?.trim()
  const guidance = result?.interaction
  const hasVisualizationData = Boolean(visualizationSnapshot || modelVisualizationSnapshot)
  const showVisualizationAction = Boolean(result || visualizationSnapshot)

  return (
    <div
      data-testid="console-output-panel"
      className="flex h-full min-h-[320px] flex-col rounded-[28px] border border-border/70 bg-card/80 backdrop-blur-xl xl:min-h-0 dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-700/80 dark:text-cyan-200/70">{t('workspaceOutput')}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{t('analysisAndReport')}</h2>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[220px] sm:items-end">
          {showVisualizationAction && (
            <Button
              className="h-11 w-full justify-center rounded-2xl border border-cyan-300/35 bg-cyan-300/10 px-4 text-cyan-800 hover:bg-cyan-300/20 sm:w-auto dark:text-cyan-100"
              disabled={!hasVisualizationData}
              onClick={() => onOpenVisualization('result')}
              title={
                !visualizationSnapshot && !modelVisualizationSnapshot
                  ? t('visualizationMissingModel')
                  : !visualizationSnapshot && modelVisualizationSnapshot
                    ? t('visualizationFallbackToModel')
                    : t('visualizationOpen')
              }
              type="button"
              variant="outline"
            >
              <Cuboid className="h-4 w-4" />
              {!visualizationSnapshot && modelVisualizationSnapshot ? t('visualizationPreviewModel') : t('visualizationOpen')}
            </Button>
          )}
          <div className="grid w-full grid-cols-2 rounded-2xl border border-border/70 bg-background/70 p-1 sm:w-auto dark:border-white/10 dark:bg-white/5">
            <button
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-medium transition',
                activeTab === 'analysis'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onTabChange('analysis')}
              type="button"
            >
              {t('analysisTab')}
            </button>
            <button
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-medium transition',
                activeTab === 'report'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onTabChange('report')}
              type="button"
            >
              {t('reportTab')}
            </button>
          </div>
        </div>
      </div>

      <div data-testid="console-output-scroll" className="flex-1 overflow-auto p-5 xl:min-h-0">
        {!result && (
          <Card className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <Orbit className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
                {t('analysisPanelIdleTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('analysisPanelIdleBody')}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {result && activeTab === 'analysis' && (
          <div className="space-y-4">
            <Card className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/50">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-400/30 bg-emerald-400/15 text-emerald-200" variant="outline">
                    {result.success ? t('analysisDone') : result.needsModelInput ? t('needsMoreInfo') : t('returnedResult')}
                  </Badge>
                  {!visualizationSnapshot && (
                    <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-800 dark:text-amber-200" variant="outline">
                      {modelVisualizationSnapshot ? t('visualizationFallbackToModel') : t('visualizationMissingModel')}
                    </Badge>
                  )}
                  {result.traceId && (
                    <Badge className="border-border/70 bg-background/70 text-muted-foreground dark:border-white/10 dark:bg-white/5" variant="outline">
                      Trace {result.traceId.slice(0, 8)}
                    </Badge>
                  )}
                  {typeof result.durationMs === 'number' && (
                    <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200" variant="outline">
                      {result.durationMs} ms
                    </Badge>
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl text-foreground">{t('executionSummary')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {result.response || t('noNaturalLanguageSummary')}
                  </CardDescription>
                </div>
              </CardHeader>
              {(stats.length > 0 || result.plan?.length) && (
                <CardContent className="space-y-4">
                  {engineInfo && (
                    <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 dark:border-cyan-200/20 dark:bg-cyan-300/5">
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">{engineInfo.label}</div>
                      <div className="mt-2 text-base font-semibold text-foreground">{engineInfo.value}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{engineInfo.modeLabel}</div>
                      {engineInfo.requestedEngineId ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('analysisEngineRequestedLabel')} {engineInfo.requestedEngineId}
                        </div>
                      ) : null}
                      {engineInfo.engineId ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('analysisEngineActualLabel')} {engineInfo.engineId}
                        </div>
                      ) : null}
                      {engineInfo.fallbackFrom ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('analysisEngineFallbackFrom')} {engineInfo.fallbackFrom}
                        </div>
                      ) : null}
                      {engineInfo.unavailableReason ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {engineInfo.unavailableReason}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {stats.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {stats.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                          <div className="mt-2 text-2xl font-semibold text-foreground">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.plan?.length ? (
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="mb-3 text-sm font-medium text-foreground">{t('executionPath')}</div>
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        {result.plan.map((step, index) => (
                          <li key={`${index}-${step}`} className="flex gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] text-cyan-700 dark:text-cyan-200">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </CardContent>
              )}
            </Card>

            {result.clarification?.question && (
              <Card className="border-amber-300/30 bg-amber-100/70 text-amber-950 shadow-none dark:bg-amber-300/10 dark:text-amber-50">
                <CardHeader>
                  <CardTitle className="text-lg">{t('clarificationTitle')}</CardTitle>
                  <CardDescription className="text-amber-900/80 dark:text-amber-100/80">
                    {result.clarification.question}
                  </CardDescription>
                </CardHeader>
                {result.clarification.missingFields?.length ? (
                  <CardContent className="flex flex-wrap gap-2">
                    {result.clarification.missingFields.map((field) => (
                      <Badge key={field} className="border-amber-300/40 bg-amber-50/80 text-amber-950 dark:border-amber-200/20 dark:bg-black/10 dark:text-amber-50" variant="outline">
                        {field}
                      </Badge>
                    ))}
                  </CardContent>
                ) : null}
              </Card>
            )}

            {guidance && (
              <Card
                data-testid="console-guidance-panel"
                className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/50"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{t('guidancePanelTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {result.response || t('guidancePanelBody')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {guidance.detectedScenarioLabel && (
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('guidanceDetectedScenario')}</div>
                        <div className="mt-2 text-base font-semibold text-foreground">{guidance.detectedScenarioLabel}</div>
                      </div>
                    )}
                    {guidance.conversationStage && (
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('guidanceCurrentStage')}</div>
                        <div className="mt-2 text-base font-semibold text-foreground">{guidance.conversationStage}</div>
                      </div>
                    )}
                  </div>

                  {guidance.fallbackSupportNote && (
                    <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm leading-6 text-foreground">
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">{t('guidanceSupportNote')}</div>
                      <div>{guidance.fallbackSupportNote}</div>
                    </div>
                  )}

                  {guidance.missingCritical?.length ? (
                    <div>
                      <div className="mb-3 text-sm font-medium text-foreground">{t('guidanceMissingCritical')}</div>
                      <div className="flex flex-wrap gap-2">
                        {guidance.missingCritical.map((field) => (
                          <Badge key={field} className="border-amber-300/40 bg-amber-100/80 text-amber-950 dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-50" variant="outline">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {guidance.missingOptional?.length ? (
                    <div>
                      <div className="mb-3 text-sm font-medium text-foreground">{t('guidanceMissingOptional')}</div>
                      <div className="flex flex-wrap gap-2">
                        {guidance.missingOptional.map((field) => (
                          <Badge key={field} className="border-border/70 bg-background/70 text-muted-foreground dark:border-white/10 dark:bg-white/5" variant="outline">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {guidance.recommendedNextStep && (
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('guidanceRecommendedNextStep')}</div>
                      <div className="text-sm leading-6 text-foreground">{guidance.recommendedNextStep}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {analysis && (
              <Card className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/50">
                <CardHeader>
                  <CardTitle className="text-lg">{t('structuredResult')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('structuredResultDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/60 p-4 text-xs leading-6 text-cyan-900 dark:border-white/10 dark:bg-black/30 dark:text-cyan-100">
                    {JSON.stringify(analysis, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {result && activeTab === 'report' && (
          <div className="space-y-4">
            {reportSummary && (
              <Card className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
                    {t('reportSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-muted-foreground">
                  {reportSummary}
                </CardContent>
              </Card>
            )}

            <Card className="border-border/70 bg-card/85 text-foreground shadow-none dark:border-white/10 dark:bg-slate-950/50">
              <CardHeader>
                <CardTitle className="text-lg">{t('markdownReport')}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t('markdownReportDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportMarkdown ? (
                  <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-cyan-700 dark:prose-code:text-cyan-200">
                    <ReactMarkdown>{reportMarkdown}</ReactMarkdown>
                  </article>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
                    {t('noReportBody')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export function AIConsole() {
  const { t, locale } = useI18n()
  const initialAssistantMessage = useMemo<Message>(() => ({
    id: 'welcome',
    role: 'assistant',
    content: t('welcomeMessage'),
    status: 'done',
    timestamp: new Date().toISOString(),
  }), [t])
  const quickPrompts = useMemo(
    () => [t('quickPrompt1'), t('quickPrompt2'), t('quickPrompt3')],
    [t]
  )
  const [messages, setMessages] = useState<Message[]>([initialAssistantMessage])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [serverConversations, setServerConversations] = useState<ConversationSummary[]>([])
  const [conversationArchive, setConversationArchive] = useState<Record<string, PersistedConversation>>({})
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [skillHubOpen, setSkillHubOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(false)
  const [modelText, setModelText] = useState('')
  const [modelSyncMessage, setModelSyncMessage] = useState('')
  const [isAutoLoadingModel, setIsAutoLoadingModel] = useState(false)
  const [availableSkills, setAvailableSkills] = useState<AgentSkillSummary[]>([])
  const [skillHubCatalog, setSkillHubCatalog] = useState<SkillHubCatalogItem[]>([])
  const [skillHubInstalledById, setSkillHubInstalledById] = useState<Record<string, SkillHubInstalledItem>>({})
  const [skillHubKeyword, setSkillHubKeyword] = useState('')
  const [skillHubDomainFilter, setSkillHubDomainFilter] = useState<SkillDomain | 'all'>('all')
  const [skillHubLoading, setSkillHubLoading] = useState(false)
  const [skillHubActionById, setSkillHubActionById] = useState<Record<string, string>>({})
  const [capabilityMatrix, setCapabilityMatrix] = useState<CapabilityMatrixPayload | null>(null)
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [skillDomainView, setSkillDomainView] = useState<SkillDomain>('structure-type')
  const [latestResult, setLatestResult] = useState<AgentResult | null>(null)
  const [latestModelVisualizationSnapshot, setLatestModelVisualizationSnapshot] = useState<VisualizationSnapshot | null>(null)
  const [latestResultVisualizationSnapshot, setLatestResultVisualizationSnapshot] = useState<VisualizationSnapshot | null>(null)
  const [visualizationOpen, setVisualizationOpen] = useState(false)
  const [visualizationSource, setVisualizationSource] = useState<'model' | 'result'>('result')
  const [activePanel, setActivePanel] = useState<PanelTab>('analysis')
  const [pendingDeleteConversationId, setPendingDeleteConversationId] = useState('')
  const [deletingConversationId, setDeletingConversationId] = useState('')
  const [conversationActivityAt, setConversationActivityAt] = useState<Record<string, string>>({})
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const seededDefaultAnalysisStrategySkillsRef = useRef(false)
  // 杩借釜鏈€鍚庢湁鏁堢殑缁撴灉鐢ㄤ簬鎸佷箙鍖栵紙涓嶄細琚