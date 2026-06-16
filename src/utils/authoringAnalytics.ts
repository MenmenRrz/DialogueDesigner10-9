import type { Cell } from '@antv/x6'
import { stripCrossTopicArtifacts } from './crossTopicJumps'
import { buildTopicScriptFromCells } from './topicScript'
import type { TopicRoutingPlan } from './topicRouting'

type StageMenuEntry = {
  title?: string
  nextStage?: string
  next_state?: string
}

type StageCell = Cell.Properties & {
  id?: string
  children?: Array<string | { id?: string }>
  data?: {
    name?: string
    agent?: string
    menus?: StageMenuEntry[]
  }
}

type EdgeCell = Cell.Properties & {
  source?: {
    cell?: string | { id?: string }
  }
  target?: {
    cell?: string | { id?: string }
  }
}

export type AnalyticsEventType =
  | 'session_started'
  | 'session_resumed'
  | 'plan_generate_requested'
  | 'plan_generated'
  | 'plan_generation_failed'
  | 'topic_generate_requested'
  | 'topic_generated'
  | 'topic_generation_failed'
  | 'topic_regenerate_requested'
  | 'suggest_options_requested'
  | 'suggest_options_applied'
  | 'state_rewrite_requested'
  | 'state_rewrite_applied'
  | 'manual_text_edit_commit'
  | 'route_changed'
  | 'state_added'
  | 'state_deleted'
  | 'option_added'
  | 'option_deleted'
  | 'edge_changed'
  | 'preview_run_success'
  | 'export_final'

export type AnalyticsEventSource = 'manual' | 'ai' | 'system'

export type AnalyticsEvent = {
  id: string
  type: AnalyticsEventType
  source: AnalyticsEventSource
  timestamp: number
  topicName?: string
  stateName?: string
  field?: string
  durationMs?: number
  beforeLength?: number
  afterLength?: number
  charDelta?: number
  meta?: Record<string, unknown>
}

export type TopicGraphSnapshot = {
  topicName: string
  stateCount: number
  optionCount: number
  utteranceCount: number
  edgeCount: number
  branchingFactorAvg: number
  branchingFactorMax: number
  maxDepth: number
  avgDepth: number
  deadEndCount: number
  orphanStateCount: number
  utteranceWordCount: number
  utteranceCharCount: number
  avgUtteranceWords: number
  startState: string | null
  stateTexts: Record<string, string>
  optionTexts: Record<string, string[]>
  edgeKeys: string[]
  scriptText: string
}

export type PlanBaselineSnapshot = {
  createdAt: number
  allTopicsJson: string
  routingJson: string
}

export type TopicAiTextBaselineOverride = {
  stateTexts: Record<string, string>
  optionTexts: Record<string, string[]>
}

export type AuthoringAnalyticsState = {
  schemaVersion: number
  sessionId: string
  userName: string
  startedAt: number
  lastActivityAt: number
  events: AnalyticsEvent[]
  planBaseline: PlanBaselineSnapshot | null
  topicBaselines: Record<string, TopicGraphSnapshot>
  topicAiTextBaselines: Record<string, TopicAiTextBaselineOverride>
  latestSummary: AuthoringAnalyticsSummary | null
}

export type AuthoringAnalyticsSummary = {
  generatedAt: number
  sessionDurationMs: number
  effectiveEditingDurationMs: number
  timeToFirstPreviewMs: number | null
  planGenerateWaitMs: number
  topicGenerateWaitMsTotal: number
  aiWaitRatio: number
  planGenerateCount: number
  topicRegenerateCount: number
  suggestOptionsRequestCount: number
  suggestOptionsApplyCount: number
  stateRewriteRequestCount: number
  stateRewriteApplyCount: number
  stateRewritePromptCount: number
  stateRewritePromptCharCount: number
  avgStateRewritePromptChars: number
  suggestionAcceptanceRate: number
  aiAcceptanceRate: number
  manualEditBurstCount: number
  manualAgentEditCount: number
  manualOptionEditCount: number
  manualRouteEditCount: number
  stateAddedCount: number
  stateDeletedCount: number
  edgeChangedCount: number
  manualTextDelta: number
  directEditingIntensity: number
  overwriteRatio: number
  aiContributionRatio: number
  modifiedStateCount: number
  modifiedOptionCount: number
  finalTextModificationRatio: number
  stateTextModificationRatio: number
  optionTextModificationRatio: number
  textChangeRatio: number
  stateChangedRatio: number
  optionChangedRatio: number
  structureChangeRatio: number
  routeChangeRatio: number
  finalVsAiDistance: number
  currentGraph: {
    stateCount: number
    optionCount: number
    utteranceCount: number
    edgeCount: number
    branchingFactorAvg: number
    branchingFactorMax: number
    maxDepth: number
    avgDepth: number
    deadEndCount: number
    orphanStateCount: number
    utteranceWordCount: number
    utteranceCharCount: number
    avgUtteranceWords: number
  }
}

type TopicSnapshotSource = {
  topicName: string
  cells: Cell.Properties[]
}

type SummaryInput = {
  analyticsState: AuthoringAnalyticsState
  topicSources: TopicSnapshotSource[]
  topicRouting: TopicRoutingPlan | null
  exportedAt?: number
}

const SCHEMA_VERSION = 1
const ACTIVE_EDIT_GAP_MS = 45_000

const clamp01 = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value >= 1) return 1
  return value
}

const safeAverage = (total: number, count: number) => (count > 0 ? total / count : 0)

const toCellId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : ''
  }
  return ''
}

const normalizeStateName = (value: unknown, fallback: string) => {
  const next = typeof value === 'string' ? value.trim() : ''
  return next.length ? next : fallback
}

const countWords = (value: string) =>
  value
    .replace(/\r?\n/g, ' ')
    .split(/\s+/)
    .filter((entry) => entry.trim().length > 0).length

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const createEventId = (timestamp: number) =>
  `${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const normalizeTextForSimilarity = (value: string) =>
  String(value || '')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildWordBigrams = (value: string) => {
  const normalized = normalizeTextForSimilarity(value)
  if (!normalized.length) {
    return [] as string[]
  }
  const words = normalized.split(' ').filter((entry) => entry.length > 0)
  if (words.length === 1) {
    return words
  }
  const result: string[] = []
  for (let index = 0; index < words.length - 1; index += 1) {
    result.push(`${words[index]} ${words[index + 1]}`)
  }
  return result
}

const tokenizeWords = (value: string) => {
  const normalized = normalizeTextForSimilarity(value)
  return normalized.length
    ? normalized.split(' ').filter((entry) => entry.length > 0)
    : ([] as string[])
}

const computeTokenEditDistance = (leftTokens: string[], rightTokens: string[]) => {
  if (!leftTokens.length) {
    return rightTokens.length
  }
  if (!rightTokens.length) {
    return leftTokens.length
  }

  let previousRow = Array.from({ length: rightTokens.length + 1 }, (_, index) => index)
  let currentRow = Array.from<number>({ length: rightTokens.length + 1 })

  for (let leftIndex = 1; leftIndex <= leftTokens.length; leftIndex += 1) {
    currentRow[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= rightTokens.length; rightIndex += 1) {
      const substitutionCost = leftTokens[leftIndex - 1] === rightTokens[rightIndex - 1] ? 0 : 1
      currentRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      )
    }
    ;[previousRow, currentRow] = [currentRow, previousRow]
  }

  return previousRow[rightTokens.length]
}

const computeApproxTextChangeRatio = (left: string, right: string) => {
  const a = buildWordBigrams(left)
  const b = buildWordBigrams(right)
  if (!a.length && !b.length) {
    return 0
  }
  const counts = new Map<string, number>()
  a.forEach((entry) => counts.set(entry, (counts.get(entry) || 0) + 1))
  let overlap = 0
  b.forEach((entry) => {
    const remaining = counts.get(entry) || 0
    if (remaining > 0) {
      overlap += 1
      counts.set(entry, remaining - 1)
    }
  })
  const similarity = (2 * overlap) / (a.length + b.length)
  return clamp01(1 - similarity)
}

const computeTextModificationMetrics = (baseline: Map<string, string>, current: Map<string, string>) => {
  const keys = [...baseline.keys()].filter((key) => current.has(key))
  if (!keys.length) {
    return {
      modifiedItemCount: 0,
      averageModifiedItemRatio: 0,
      finalTextModificationRatio: 0,
      totalModifiedTokens: 0,
      totalCurrentTokens: 0,
      totalBaselineTokens: 0,
    }
  }

  let perStateRatioTotal = 0
  let modifiedStateCount = 0
  let totalModifiedWords = 0
  let totalCurrentWords = 0
  let totalBaselineWords = 0

  keys.forEach((key) => {
    const baselineWords = tokenizeWords(baseline.get(key) ?? '')
    const currentWords = tokenizeWords(current.get(key) ?? '')
    const modifiedWords = computeTokenEditDistance(baselineWords, currentWords)
    const stateDenominator =
      baselineWords.length > 0 ? baselineWords.length : currentWords.length
    const stateRatio =
      stateDenominator > 0 ? clamp01(modifiedWords / stateDenominator) : 0

    if (stateRatio > 0) {
      perStateRatioTotal += stateRatio
      modifiedStateCount += 1
    }
    totalModifiedWords += modifiedWords
    totalCurrentWords += currentWords.length
    totalBaselineWords += baselineWords.length
  })

  const finalDenominator = totalCurrentWords > 0 ? totalCurrentWords : totalBaselineWords

  return {
    modifiedItemCount: modifiedStateCount,
    averageModifiedItemRatio: clamp01(
      modifiedStateCount > 0 ? perStateRatioTotal / modifiedStateCount : 0,
    ),
    finalTextModificationRatio:
      finalDenominator > 0 ? clamp01(totalModifiedWords / finalDenominator) : 0,
    totalModifiedTokens: totalModifiedWords,
    totalCurrentTokens: totalCurrentWords,
    totalBaselineTokens: totalBaselineWords,
  }
}

const mergeTextSets = (sets: Map<string, string>[]) => {
  const merged = new Map<string, string>()
  sets.forEach((set) => {
    set.forEach((value, key) => {
      merged.set(key, value)
    })
  })
  return merged
}

const resolveNextState = (
  stageIdByName: Map<string, string>,
  edges: EdgeCell[],
  stage: StageCell,
  menu: StageMenuEntry,
  menuIndex: number,
) => {
  const child = stage.children?.[menuIndex]
  const optionCellId = toCellId(child)

  if (optionCellId) {
    const edge = edges.find((entry) => toCellId(entry.source?.cell) === optionCellId)
    const targetCellId = toCellId(edge?.target?.cell)
    if (targetCellId) {
      return stageIdByName.get(targetCellId) ?? targetCellId
    }
  }

  if (typeof menu.nextStage === 'string' && menu.nextStage.length > 0) {
    return stageIdByName.get(menu.nextStage) ?? menu.nextStage
  }

  if (typeof menu.next_state === 'string' && menu.next_state.length > 0) {
    return stageIdByName.get(menu.next_state) ?? menu.next_state
  }

  return ''
}

export const createAnalyticsState = (userName: string, startedAt = Date.now()): AuthoringAnalyticsState => ({
  schemaVersion: SCHEMA_VERSION,
  sessionId: `analytics-${hashText(`${userName}:${startedAt}:${Math.random()}`)}`,
  userName,
  startedAt,
  lastActivityAt: startedAt,
  events: [],
  planBaseline: null,
  topicBaselines: {},
  topicAiTextBaselines: {},
  latestSummary: null,
})

export const createAnalyticsEvent = (
  type: AnalyticsEventType,
  source: AnalyticsEventSource,
  payload: Omit<AnalyticsEvent, 'id' | 'type' | 'source' | 'timestamp'> & {
    timestamp?: number
  } = {},
): AnalyticsEvent => {
  const timestamp = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now()
  return {
    id: createEventId(timestamp),
    type,
    source,
    timestamp,
    topicName: payload.topicName,
    stateName: payload.stateName,
    field: payload.field,
    durationMs: payload.durationMs,
    beforeLength: payload.beforeLength,
    afterLength: payload.afterLength,
    charDelta: payload.charDelta,
    meta: payload.meta,
  }
}

export const createPlanBaselineSnapshot = (
  allTopics: Record<string, unknown> | null | undefined,
  topicRouting: TopicRoutingPlan | null | undefined,
  createdAt = Date.now(),
): PlanBaselineSnapshot => ({
  createdAt,
  allTopicsJson: JSON.stringify(allTopics ?? {}),
  routingJson: JSON.stringify(topicRouting ?? null),
})

export const snapshotTopicGraph = (
  topicName: string,
  cells: Cell.Properties[],
): TopicGraphSnapshot => {
  const localCells = stripCrossTopicArtifacts(cells ?? [])
  const stageCells = localCells.filter((entry) => entry.shape === 'stage-node') as StageCell[]
  const edgeCells = localCells.filter((entry) => entry.shape === 'edge') as EdgeCell[]
  const scriptResult = buildTopicScriptFromCells(topicName, localCells)

  const orderedStages = [...stageCells].sort((a, b) => {
    const ay = typeof a.position?.y === 'number' ? a.position.y : 0
    const by = typeof b.position?.y === 'number' ? b.position.y : 0
    if (ay !== by) return ay - by
    const ax = typeof a.position?.x === 'number' ? a.position.x : 0
    const bx = typeof b.position?.x === 'number' ? b.position.x : 0
    return ax - bx
  })

  const stageIdToName = new Map<string, string>()
  const stateTexts: Record<string, string> = {}
  const optionTexts: Record<string, string[]> = {}

  orderedStages.forEach((stage, index) => {
    const stageId = toCellId(stage.id)
    if (!stageId.length) {
      return
    }
    const stateName = normalizeStateName(stage.data?.name, `state_${index + 1}`)
    stageIdToName.set(stageId, stateName)
    stateTexts[stateName] = typeof stage.data?.agent === 'string' ? stage.data.agent.trim() : ''
    optionTexts[stateName] = Array.isArray(stage.data?.menus)
      ? stage.data!.menus!
          .map((entry: StageMenuEntry) => String(entry?.title ?? '').trim())
          .filter((entry: string) => entry.length > 0)
      : []
  })

  const adjacency = new Map<string, string[]>()
  const outDegrees = new Map<string, number>()
  const edgeKeys = new Set<string>()

  orderedStages.forEach((stage, stageIndex) => {
    const stageId = toCellId(stage.id)
    const stateName =
      stageIdToName.get(stageId) ?? normalizeStateName(stage.data?.name, `state_${stageIndex + 1}`)
    const menus = Array.isArray(stage.data?.menus) ? stage.data.menus : []
    const nextStates = menus.reduce((acc: string[], menu: StageMenuEntry, menuIndex: number) => {
      const nextState = resolveNextState(stageIdToName, edgeCells, stage, menu, menuIndex)
      if (nextState && !acc.includes(nextState)) {
        acc.push(nextState)
        edgeKeys.add(`${stateName}=>${nextState}`)
      }
      return acc
    }, [])
    adjacency.set(stateName, nextStates)
    outDegrees.set(stateName, nextStates.length)
  })

  const orderedStateNames = scriptResult.orderedStates.filter((entry) => adjacency.has(entry) || stateTexts[entry] !== undefined)
  const startState = scriptResult.startState
  const depthByState = new Map<string, number>()
  const queue: Array<{ stateName: string; depth: number }> = []
  if (startState && adjacency.has(startState)) {
    queue.push({ stateName: startState, depth: 0 })
  } else if (orderedStateNames.length) {
    queue.push({ stateName: orderedStateNames[0], depth: 0 })
  }

  while (queue.length) {
    const current = queue.shift()!
    if (depthByState.has(current.stateName)) {
      continue
    }
    depthByState.set(current.stateName, current.depth)
    ;(adjacency.get(current.stateName) ?? []).forEach((nextState) => {
      if (!depthByState.has(nextState)) {
        queue.push({ stateName: nextState, depth: current.depth + 1 })
      }
    })
  }

  const stateNames = Object.keys(stateTexts)
  const depthValues = Array.from(depthByState.values())
  const utteranceTexts = Object.values(stateTexts).filter((entry) => entry.length > 0)
  const utteranceWordCount = utteranceTexts.reduce((sum, entry) => sum + countWords(entry), 0)
  const utteranceCharCount = utteranceTexts.reduce((sum, entry) => sum + entry.length, 0)
  const deadEndCount = stateNames.filter((stateName) => (outDegrees.get(stateName) || 0) === 0).length
  const orphanStateCount = stateNames.filter((stateName) => !depthByState.has(stateName)).length
  const branchValues = stateNames.map((stateName) => outDegrees.get(stateName) || 0)

  return {
    topicName,
    stateCount: stateNames.length,
    optionCount: Object.values(optionTexts).reduce((sum, entries) => sum + entries.length, 0),
    utteranceCount: utteranceTexts.length,
    edgeCount: edgeKeys.size,
    branchingFactorAvg: safeAverage(branchValues.reduce((sum, value) => sum + value, 0), branchValues.length),
    branchingFactorMax: branchValues.length ? Math.max(...branchValues) : 0,
    maxDepth: depthValues.length ? Math.max(...depthValues) : 0,
    avgDepth: safeAverage(depthValues.reduce((sum, value) => sum + value, 0), depthValues.length),
    deadEndCount,
    orphanStateCount,
    utteranceWordCount,
    utteranceCharCount,
    avgUtteranceWords: safeAverage(utteranceWordCount, utteranceTexts.length),
    startState,
    stateTexts,
    optionTexts,
    edgeKeys: Array.from(edgeKeys).sort(),
    scriptText: scriptResult.script,
  }
}

const aggregateTopicSnapshots = (snapshots: TopicGraphSnapshot[]) => {
  const totals = snapshots.reduce(
    (acc, snapshot) => {
      acc.stateCount += snapshot.stateCount
      acc.optionCount += snapshot.optionCount
      acc.utteranceCount += snapshot.utteranceCount
      acc.edgeCount += snapshot.edgeCount
      acc.branchingFactorWeighted += snapshot.branchingFactorAvg * snapshot.stateCount
      acc.branchingFactorMax = Math.max(acc.branchingFactorMax, snapshot.branchingFactorMax)
      acc.maxDepth = Math.max(acc.maxDepth, snapshot.maxDepth)
      acc.depthWeighted += snapshot.avgDepth * snapshot.stateCount
      acc.deadEndCount += snapshot.deadEndCount
      acc.orphanStateCount += snapshot.orphanStateCount
      acc.utteranceWordCount += snapshot.utteranceWordCount
      acc.utteranceCharCount += snapshot.utteranceCharCount
      return acc
    },
    {
      stateCount: 0,
      optionCount: 0,
      utteranceCount: 0,
      edgeCount: 0,
      branchingFactorWeighted: 0,
      branchingFactorMax: 0,
      maxDepth: 0,
      depthWeighted: 0,
      deadEndCount: 0,
      orphanStateCount: 0,
      utteranceWordCount: 0,
      utteranceCharCount: 0,
    },
  )

  return {
    stateCount: totals.stateCount,
    optionCount: totals.optionCount,
    utteranceCount: totals.utteranceCount,
    edgeCount: totals.edgeCount,
    branchingFactorAvg: safeAverage(totals.branchingFactorWeighted, totals.stateCount),
    branchingFactorMax: totals.branchingFactorMax,
    maxDepth: totals.maxDepth,
    avgDepth: safeAverage(totals.depthWeighted, totals.stateCount),
    deadEndCount: totals.deadEndCount,
    orphanStateCount: totals.orphanStateCount,
    utteranceWordCount: totals.utteranceWordCount,
    utteranceCharCount: totals.utteranceCharCount,
    avgUtteranceWords: safeAverage(totals.utteranceWordCount, totals.utteranceCount),
  }
}

const buildStateTextSet = (
  snapshots: TopicGraphSnapshot[],
  overrides: Record<string, TopicAiTextBaselineOverride> = {},
) => {
  const map = new Map<string, string>()
  snapshots.forEach((snapshot) => {
    Object.entries(snapshot.stateTexts).forEach(([stateName, text]) => {
      map.set(`${snapshot.topicName}::${stateName}`, text)
    })

    const topicOverride = overrides[snapshot.topicName]
    if (topicOverride && typeof topicOverride === 'object') {
      Object.entries(topicOverride.stateTexts || {}).forEach(([stateName, text]) => {
        map.set(`${snapshot.topicName}::${stateName}`, String(text || ''))
      })
    }
  })
  return map
}

const removeMapKeysWithPrefix = (map: Map<string, string>, prefix: string) => {
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) {
      map.delete(key)
    }
  }
}

const buildOptionTextSet = (
  snapshots: TopicGraphSnapshot[],
  overrides: Record<string, TopicAiTextBaselineOverride> = {},
) => {
  const map = new Map<string, string>()
  snapshots.forEach((snapshot) => {
    Object.entries(snapshot.optionTexts).forEach(([stateName, entries]) => {
      entries.forEach((text, index) => {
        map.set(`${snapshot.topicName}::${stateName}::${index}`, text)
      })
    })

    const topicOverride = overrides[snapshot.topicName]
    if (topicOverride && typeof topicOverride === 'object') {
      Object.entries(topicOverride.optionTexts || {}).forEach(([stateName, entries]) => {
        const prefix = `${snapshot.topicName}::${stateName}::`
        removeMapKeysWithPrefix(map, prefix)
        ;(Array.isArray(entries) ? entries : []).forEach((text, index) => {
          map.set(`${snapshot.topicName}::${stateName}::${index}`, String(text || ''))
        })
      })
    }
  })
  return map
}

const buildStructureSets = (snapshots: TopicGraphSnapshot[]) => {
  const states = new Set<string>()
  const options = new Set<string>()
  const edges = new Set<string>()

  snapshots.forEach((snapshot) => {
    Object.keys(snapshot.stateTexts).forEach((stateName) => {
      states.add(`${snapshot.topicName}::${stateName}`)
    })
    Object.entries(snapshot.optionTexts).forEach(([stateName, entries]) => {
      entries.forEach((text, index) => {
        options.add(`${snapshot.topicName}::${stateName}::${index}::${hashText(text)}`)
      })
    })
    snapshot.edgeKeys.forEach((edgeKey) => {
      edges.add(`${snapshot.topicName}::${edgeKey}`)
    })
  })

  return { states, options, edges }
}

const computeChangedRatio = <T>(baseline: Map<string, T>, current: Map<string, T>) => {
  const keys = new Set<string>([...baseline.keys(), ...current.keys()])
  if (!keys.size) {
    return 0
  }
  let changed = 0
  keys.forEach((key) => {
    if (baseline.get(key) !== current.get(key)) {
      changed += 1
    }
  })
  return clamp01(changed / keys.size)
}

const computeSetDiffRatio = (baseline: Set<string>, current: Set<string>) => {
  const keys = new Set<string>([...baseline, ...current])
  if (!keys.size) {
    return 0
  }
  let changed = 0
  keys.forEach((key) => {
    if (baseline.has(key) !== current.has(key)) {
      changed += 1
    }
  })
  return clamp01(changed / keys.size)
}

const computeEffectiveEditingDuration = (events: AnalyticsEvent[]) => {
  const activity = [...events]
    .filter(
      (event) =>
        event.type !== 'session_started' &&
        event.type !== 'session_resumed' &&
        event.type !== 'plan_generate_requested' &&
        event.type !== 'plan_generated' &&
        event.type !== 'plan_generation_failed' &&
        event.type !== 'topic_generate_requested' &&
        event.type !== 'topic_generated' &&
        event.type !== 'topic_generation_failed',
    )
    .map((event) => event.timestamp)
    .sort((left, right) => left - right)
  if (activity.length < 2) {
    return 0
  }
  let total = 0
  for (let index = 1; index < activity.length; index += 1) {
    total += Math.min(activity[index] - activity[index - 1], ACTIVE_EDIT_GAP_MS)
  }
  return total
}

export const buildAuthoringAnalyticsSummary = ({
  analyticsState,
  topicSources,
  topicRouting,
  exportedAt = Date.now(),
}: SummaryInput): AuthoringAnalyticsSummary => {
  const currentSnapshots = topicSources.map((entry) => snapshotTopicGraph(entry.topicName, entry.cells))
  const aggregate = aggregateTopicSnapshots(currentSnapshots)
  const baselineSnapshots = Object.values(analyticsState.topicBaselines)
  const topicAiTextBaselines =
    analyticsState.topicAiTextBaselines && typeof analyticsState.topicAiTextBaselines === 'object'
      ? analyticsState.topicAiTextBaselines
      : {}

  const initialBaselineStateTexts = buildStateTextSet(baselineSnapshots)
  const latestAiBaselineStateTexts = buildStateTextSet(baselineSnapshots, topicAiTextBaselines)
  const currentStateTexts = buildStateTextSet(currentSnapshots)
  const initialBaselineOptionTexts = buildOptionTextSet(baselineSnapshots)
  const latestAiBaselineOptionTexts = buildOptionTextSet(baselineSnapshots, topicAiTextBaselines)
  const currentOptionTexts = buildOptionTextSet(currentSnapshots)
  const baselineStructures = buildStructureSets(baselineSnapshots)
  const currentStructures = buildStructureSets(currentSnapshots)

  const baselineScript = baselineSnapshots.map((entry) => entry.scriptText).join('\n\n')
  const currentScript = currentSnapshots.map((entry) => entry.scriptText).join('\n\n')

  const textChangeRatio = computeApproxTextChangeRatio(baselineScript, currentScript)
  const initialCombinedTextMetrics = computeTextModificationMetrics(
    mergeTextSets([initialBaselineStateTexts, initialBaselineOptionTexts]),
    mergeTextSets([currentStateTexts, currentOptionTexts]),
  )
  const {
    modifiedItemCount: modifiedStateCount,
    averageModifiedItemRatio: stateTextModificationRatio,
  } = computeTextModificationMetrics(
    latestAiBaselineStateTexts,
    currentStateTexts,
  )
  const {
    modifiedItemCount: modifiedOptionCount,
    averageModifiedItemRatio: optionTextModificationRatio,
  } = computeTextModificationMetrics(latestAiBaselineOptionTexts, currentOptionTexts)
  const combinedTextMetrics = computeTextModificationMetrics(
    mergeTextSets([latestAiBaselineStateTexts, latestAiBaselineOptionTexts]),
    mergeTextSets([currentStateTexts, currentOptionTexts]),
  )
  const finalTextModificationRatio = combinedTextMetrics.finalTextModificationRatio
  const stateChangedRatio = computeChangedRatio(latestAiBaselineStateTexts, currentStateTexts)
  const optionChangedRatio = computeChangedRatio(latestAiBaselineOptionTexts, currentOptionTexts)
  const structureChangeRatio =
    (computeSetDiffRatio(baselineStructures.states, currentStructures.states) +
      computeSetDiffRatio(baselineStructures.options, currentStructures.options) +
      computeSetDiffRatio(baselineStructures.edges, currentStructures.edges)) /
    3
  const routeChangeRatio = computeApproxTextChangeRatio(
    analyticsState.planBaseline?.routingJson ?? '',
    JSON.stringify(topicRouting ?? null),
  )
  const finalVsAiDistance = clamp01(
    initialCombinedTextMetrics.finalTextModificationRatio * 0.5 + structureChangeRatio * 0.35 + routeChangeRatio * 0.15,
  )

  const countByType = (type: AnalyticsEventType) =>
    analyticsState.events.filter((event) => event.type === type).length

  const manualTextEdits = analyticsState.events.filter((event) => event.type === 'manual_text_edit_commit')
  const manualAgentEditCount = new Set(
    manualTextEdits
      .filter((event) => event.field === 'agent')
      .map((event) => `${event.topicName || ''}::${event.stateName || ''}`),
  ).size
  const manualOptionEditCount = new Set(
    manualTextEdits
      .filter((event) => event.field === 'option')
      .map((event) => `${event.topicName || ''}::${event.stateName || ''}::${event.meta?.optionId || ''}`),
  ).size
  const manualRouteEditCount = countByType('route_changed')
  const manualTextDelta = manualTextEdits.reduce((sum, event) => sum + Math.abs(event.charDelta || 0), 0)

  const getMetaNumber = (event: AnalyticsEvent, key: string) => {
    const value = event.meta?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const suggestRequests = countByType('suggest_options_requested')
  const suggestApplies = countByType('suggest_options_applied')
  const rewriteRequestEvents = analyticsState.events.filter((event) => event.type === 'state_rewrite_requested')
  const rewriteRequests = rewriteRequestEvents.length
  const rewriteApplies = countByType('state_rewrite_applied')
  const rewritePromptEvents = rewriteRequestEvents.filter((event) => {
    const instructionLength = getMetaNumber(event, 'instructionLength')
    return instructionLength === null || instructionLength > 0
  })
  const stateRewritePromptCount = rewritePromptEvents.length
  const stateRewritePromptCharCount = rewritePromptEvents.reduce(
    (sum, event) => sum + Math.max(0, getMetaNumber(event, 'instructionLength') ?? 0),
    0,
  )
  const totalAiRequests = suggestRequests + rewriteRequests
  const totalAiApplies = suggestApplies + rewriteApplies
  const hasAiTopicBaseline = baselineSnapshots.length > 0

  const firstPreviewSuccess = analyticsState.events
    .filter((event) => event.type === 'preview_run_success')
    .sort((left, right) => left.timestamp - right.timestamp)[0]
  const planGenerateWaitMs = analyticsState.events
    .filter((event) => event.type === 'plan_generated' || event.type === 'plan_generation_failed')
    .reduce((sum, event) => sum + Math.max(0, event.durationMs || 0), 0)
  const topicGenerateWaitMsTotal = analyticsState.events
    .filter((event) => event.type === 'topic_generated' || event.type === 'topic_generation_failed')
    .reduce((sum, event) => sum + Math.max(0, event.durationMs || 0), 0)
  const sessionDurationMs = Math.max(0, exportedAt - analyticsState.startedAt)
  const aiWaitRatio =
    sessionDurationMs > 0 ? clamp01((planGenerateWaitMs + topicGenerateWaitMsTotal) / sessionDurationMs) : 0

  return {
    generatedAt: exportedAt,
    sessionDurationMs,
    effectiveEditingDurationMs: computeEffectiveEditingDuration(analyticsState.events),
    timeToFirstPreviewMs: firstPreviewSuccess ? firstPreviewSuccess.timestamp - analyticsState.startedAt : null,
    planGenerateWaitMs,
    topicGenerateWaitMsTotal,
    aiWaitRatio,
    planGenerateCount: countByType('plan_generated'),
    topicRegenerateCount: countByType('topic_regenerate_requested'),
    suggestOptionsRequestCount: suggestRequests,
    suggestOptionsApplyCount: suggestApplies,
    stateRewriteRequestCount: rewriteRequests,
    stateRewriteApplyCount: rewriteApplies,
    stateRewritePromptCount,
    stateRewritePromptCharCount,
    avgStateRewritePromptChars:
      stateRewritePromptCount > 0 ? stateRewritePromptCharCount / stateRewritePromptCount : 0,
    suggestionAcceptanceRate: suggestRequests > 0 ? suggestApplies / suggestRequests : 0,
    aiAcceptanceRate: hasAiTopicBaseline
      ? clamp01(1 - finalTextModificationRatio)
      : totalAiRequests > 0
      ? totalAiApplies / totalAiRequests
      : 0,
    manualEditBurstCount: manualTextEdits.length,
    manualAgentEditCount,
    manualOptionEditCount,
    manualRouteEditCount,
    stateAddedCount: countByType('state_added'),
    stateDeletedCount: countByType('state_deleted'),
    edgeChangedCount: countByType('edge_changed'),
    manualTextDelta,
    directEditingIntensity: aggregate.edgeCount > 0 ? manualTextEdits.length / aggregate.edgeCount : manualTextEdits.length,
    overwriteRatio: aggregate.utteranceCount > 0 ? manualAgentEditCount / aggregate.utteranceCount : 0,
    aiContributionRatio:
      hasAiTopicBaseline
        ? clamp01(1 - finalTextModificationRatio)
        : totalAiApplies + manualTextEdits.length > 0
        ? totalAiApplies / (totalAiApplies + manualTextEdits.length)
        : 0,
    modifiedStateCount,
    modifiedOptionCount,
    finalTextModificationRatio,
    stateTextModificationRatio,
    optionTextModificationRatio,
    textChangeRatio,
    stateChangedRatio,
    optionChangedRatio,
    structureChangeRatio,
    routeChangeRatio,
    finalVsAiDistance,
    currentGraph: aggregate,
  }
}
