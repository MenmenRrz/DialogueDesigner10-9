import { ref } from 'vue'
import { defineStore } from 'pinia'
import { watch } from 'vue'
import { message as msgSrv } from 'ant-design-vue'
import { formatGeneticCounseling, type DialogueParseIssue, type StageNode } from '@/utils/formatGeneticCounseling'
import { transform2AntvJson } from '@/utils/transform2AntvJson'
import {
  buildDefaultTopicChoiceLabel,
  buildOrderedPlanTopicNames,
  getTopicRouteContext,
  isLegacyTopicChoiceLabel,
  normalizeTopicRouting,
} from '@/utils/topicRouting'
import type { TopicRouteChoice, TopicRoutingPlan, TopicRouteTransition } from '@/utils/topicRouting'
import type { Cell, Graph } from '@antv/x6'
import { parseAiTaskError, requestAiTask } from '@/services/aiOrchestrator'
import {
  requestWorkspaceLoad,
  requestWorkspaceSave,
  type ServerWorkspaceSnapshot,
} from '@/services/workspaceStorage'
import {
  buildAuthoringAnalyticsSummary,
  createAnalyticsEvent,
  createAnalyticsState,
  createPlanBaselineSnapshot,
  snapshotTopicGraph,
  type AnalyticsEvent,
  type AnalyticsEventSource,
  type AnalyticsEventType,
  type AuthoringAnalyticsState,
} from '@/utils/authoringAnalytics'

export enum AuthoringGoal {
  EDUCATION = 'Education',
  PERSUASION = 'Persuasion',
  BOTH = 'Education & Persuasion',
}
export type Nullable<T> = T | null

export enum ConvertType {
  TEXT,
  IMPORT,
}

export enum AuthoringMode {
  AI = 'ai',
  MANUAL = 'manual',
}

export interface Session {
  name: string
  desc: string
}

export interface Topic {
  name: string
  sessions: Session[]
}

export interface SubtopicSummary {
  name: string
  brief: string
  miTechnique: string
  prompt?: string
}

export interface SuggestedStateDraft {
  agent: string
  subtopic: string
  miTechnique: string
}

export type SessionTopic = {
  sessionName: string
  topics: Array<{
    topicName: string
    list: SubtopicSummary[]
    topicPrompt?: string
  }>
}

export interface ImportedTopicSummary {
  name: string
  stageNames: string[]
}

export type Api1PlanResult = {
  all_topics: Record<string, Array<string | SubtopicSummary>>
  sessions_topics: Record<string, Record<string, Array<string | SubtopicSummary>>>
  topic_routing?: TopicRoutingPlan
  [key: string]: unknown
}

type TopicRouteContextPayload = {
  entryTopic: string
  isEntryTopic: boolean
  incomingTopics: string[]
  nextTopics: string[]
  transition: TopicRouteTransition
  branchMenu: TopicRouteChoice[]
  isTerminalTopic: boolean
}

export interface ApiRes {
  choices: Array<{
    finish_reason: string
    index: number
    logprobs: Nullable<unknown>
    message: {
      content: string
      refusal: Nullable<unknown>
      role: string
    }
  }>
  created: number
  id: string
  model: string
  object: string
  system_fingerprint: Nullable<unknown>
  usage: {
    completion_tokens: number
    completion_tokens_details: {
      accepted_prediction_tokens: number
      audio_tokens: number
      reasoning_tokens: number
      rejected_prediction_tokens: number
    }
    prompt_tokens: number
    prompt_tokens_details: {
      audio_tokens: number
      cached_tokens: number
    }
    total_tokens: number
  }
}

export type TopicJobStatus = "pending" | "running" | "success" | "failed" | "cancelled"

export interface TopicJob {
  id: string
  topicName: string
  sessionName: string
  attempt: number
  status: TopicJobStatus
  error?: string
  startedAt?: number
  finishedAt?: number
  warnings: DialogueParseIssue[]
}

type PlanRegenerationScope = 'topic' | 'subtopic'

const GENERATION_STORAGE_KEY = 'designer-generation-state'
const GENERATION_FINGERPRINT_KEY = 'designer-generation-fingerprint'
const GENERATION_FINGERPRINT_VERSION = '2'
const ANALYTICS_STORAGE_KEY = 'designer-authoring-analytics'
const USER_PROFILE_STORAGE_KEY = 'designer-user-profile'
const USER_REGISTRY_STORAGE_KEY = 'designer-user-registry'
const USER_THREAD_STORAGE_KEY = 'designer-user-thread'
const STORAGE_RESET_MARKER_KEY = 'designer-storage-reset-version'
const STORAGE_RESET_VERSION = '2026-03-15-clear-user-history'
const SERVER_WORKSPACE_SCHEMA_VERSION = 1
const SERVER_WORKSPACE_APP_ID = 'healthdial-dialogue-designer'
const DEFAULT_AUTHORING_CONTEXT = {
  goal: AuthoringGoal.EDUCATION,
  ageMin: null as number | null,
  ageMax: null as number | null,
  gender: '',
  persona: '',
}
const DEFAULT_MANUAL_SESSION_NAME = 'manual_authoring'

type UserThreadSnapshot = {
  step?: number
  type?: ConvertType
  authoringMode?: AuthoringMode
  convertContent?: string
  newConvertContent?: string
  convertFileContent?: string
  stateContent?: string
  authoringContext?: typeof DEFAULT_AUTHORING_CONTEXT
  sessionTopics?: SessionTopic[]
  api1Result?: Api1PlanResult | null
}

type GenerationStateSnapshot = {
  batchId?: string | null
  cancelled?: boolean
  activeTopicId?: string | null
  queue?: Array<TopicJob & { warnings?: DialogueParseIssue[] }>
  scripts?: Array<[string, string]>
  issues?: Array<[string, DialogueParseIssue[]]>
  topicGraph?: Array<[string, Cell.Properties[]]>
  stateContent?: string
  fingerprintVersion?: string
}

type DesignerServerWorkspaceSnapshot<TConvert = unknown> = ServerWorkspaceSnapshot<TConvert> & {
  userThread?: UserThreadSnapshot | null
  generationState?: GenerationStateSnapshot | null
  analyticsState?: AuthoringAnalyticsState | null
}

const normalizeUserName = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizePlanNameKey = (value: string) => String(value || '').trim().toLocaleLowerCase()

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const normalizeEditablePrompt = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n') : ''

const sanitizeOptionalPrompt = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.replace(/\r\n/g, '\n').trim()
  return normalized.length ? normalized : undefined
}

const normalizeTopicGraphCells = (cells: Cell.Properties[] | undefined) => {
  if (!Array.isArray(cells)) {
    return [] as Cell.Properties[]
  }

  return cells.map((cell) => {
    if (!cell || typeof cell !== 'object' || cell.shape !== 'edge') {
      return cell
    }
    const { router: _router, connector: _connector, ...rest } = cell as Cell.Properties & {
      router?: unknown
      connector?: unknown
    }
    return rest as Cell.Properties
  })
}

const GRAPH_HYDRATING_FLAG = '__healthdialHydrating'

const buildUserKeySuffix = (value: string) => {
  const normalized = normalizeUserName(value).toLowerCase()
  return normalized.length ? encodeURIComponent(normalized) : 'default'
}

const cloneDefaultAuthoringContext = () => ({
  ...DEFAULT_AUTHORING_CONTEXT,
})

const USER_DATA_STORAGE_PREFIXES = [
  USER_PROFILE_STORAGE_KEY,
  USER_REGISTRY_STORAGE_KEY,
  USER_THREAD_STORAGE_KEY,
  GENERATION_STORAGE_KEY,
  GENERATION_FINGERPRINT_KEY,
  ANALYTICS_STORAGE_KEY,
  'designer-convert-workspace',
  'designer-convert-fingerprint',
]

const shouldClearUserStorageKey = (key: string) =>
  USER_DATA_STORAGE_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))

export const useDesignerStore = defineStore('designer', () => {
  const step = ref(0)
  const userName = ref('')
  const userSessionReady = ref(false)
  const lastUsedUserName = ref('')
  const knownUserNames = ref<string[]>([])
  const type = ref(ConvertType.TEXT)
  const authoringMode = ref<AuthoringMode>(AuthoringMode.AI)
  const convertContent = ref('')
  const newConvertContent = ref('')
  const convertFileContent = ref('')
  const convertLoading = ref(false)
  const sessionTopics = ref<SessionTopic[]>([])
  const queryTopicStrucLoading = ref(false)
  const api1Result = ref<Api1PlanResult | null>(null)
  const authoringContext = ref(cloneDefaultAuthoringContext())
  const analyticsState = ref<AuthoringAnalyticsState | null>(null)
  let analyticsPersistTimer: number | null = null

  const goalOptions = [
    { label: 'Education', value: AuthoringGoal.EDUCATION },
    { label: 'Persuasion', value: AuthoringGoal.PERSUASION },
    { label: 'Education & Persuasion', value: AuthoringGoal.BOTH },
  ]
  const graph = ref<Graph>()
  const withGraphHydration = (callback: () => void) => {
    if (!graph.value) {
      return
    }

    const graphInstance = graph.value as any
    graphInstance[GRAPH_HYDRATING_FLAG] = true
    try {
      callback()
    } finally {
      graphInstance[GRAPH_HYDRATING_FLAG] = false
    }
  }
  const replaceGraphCells = (cells: unknown) => {
    if (!graph.value) {
      return
    }

    withGraphHydration(() => {
      const clearCells = (graph.value as any).clearCells
      if (typeof clearCells === 'function') {
        clearCells.call(graph.value)
      }
      graph.value?.fromJSON(cells as any)
    })
  }
  const clearGraphCellsSafely = () => {
    if (!graph.value) {
      return
    }

    const clearCells = (graph.value as any).clearCells
    if (typeof clearCells === 'function') {
      withGraphHydration(() => {
        clearCells.call(graph.value)
      })
      return
    }

    replaceGraphCells([] as any)
  }
  const stateContent = ref('')
  const topicGraph = ref<Map<string, Cell.Properties[]>>(new Map())
  const topicGraphSelected = ref<Nullable<string>>(null)
  const newOptionModalShow = ref(false)
  const querySuggestOptionsLoading = ref(false)
  const querySuggestOptionStageName = ref<Nullable<string>>(null)
  const mentorDirections = ref('')
  const newSuggestOptions = ref<string[]>([])
  const newSuggestOptionAgents = ref<Record<string, string>>({})
  const newSuggestOptionStateDrafts = ref<Record<string, SuggestedStateDraft>>({})
  const querySuggestOptionStageId = ref<Nullable<string>>(null)
  const lastApi1Res = ref<any>('')
  const lastApi1Fingerprint = ref('')
  const lastApi2Res = ref<any>(null)
  const topicScripts = ref<Map<string, string>>(new Map())
  const generationQueue = ref<TopicJob[]>([])
  const generationBatchId = ref<string | null>(null)
  const generationActiveTopicId = ref<Nullable<string>>(null)
  const generationCancelled = ref(false)
  const topicIssues = ref<Map<string, DialogueParseIssue[]>>(new Map())
  const generationProcessing = ref(false)
  const cachedServerConvertWorkspace = ref<unknown | null>(null)
  const skipNextConvertWorkspaceRestore = ref(false)

  const updateStep = (val: number) => {
    step.value = val
  }

  const updateAuthoringContext = (patch: Partial<typeof authoringContext.value>) => {
    authoringContext.value = {
      ...authoringContext.value,
      ...patch,
    }
  }

  const updateAuthoringMode = (mode: AuthoringMode) => {
    authoringMode.value = mode === AuthoringMode.MANUAL ? AuthoringMode.MANUAL : AuthoringMode.AI
    if (authoringMode.value === AuthoringMode.MANUAL) {
      generationBatchId.value = null
      generationCancelled.value = false
      generationActiveTopicId.value = null
      generationQueue.value = []
      topicScripts.value = new Map()
      topicIssues.value = new Map()
      generationProcessing.value = false
      queryTopicStrucLoading.value = false
    }
  }

  let pauseUserThreadPersistence = false

  const clearGraphCells = () => {
    clearGraphCellsSafely()
  }

  const resetDesignerStateForUser = () => {
    step.value = 0
    type.value = ConvertType.TEXT
    authoringMode.value = AuthoringMode.AI
    convertContent.value = ''
    newConvertContent.value = ''
    convertFileContent.value = ''
    convertLoading.value = false
    sessionTopics.value = []
    queryTopicStrucLoading.value = false
    api1Result.value = null
    authoringContext.value = cloneDefaultAuthoringContext()
    stateContent.value = ''
    topicGraph.value = new Map()
    topicGraphSelected.value = null
    newOptionModalShow.value = false
    querySuggestOptionsLoading.value = false
    querySuggestOptionStageName.value = null
    mentorDirections.value = ''
    newSuggestOptions.value = []
    newSuggestOptionAgents.value = {}
    newSuggestOptionStateDrafts.value = {}
    querySuggestOptionStageId.value = null
    lastApi1Res.value = ''
    lastApi1Fingerprint.value = ''
    lastApi2Res.value = null
    topicScripts.value = new Map()
    generationQueue.value = []
    generationBatchId.value = null
    generationActiveTopicId.value = null
    generationCancelled.value = false
    topicIssues.value = new Map()
    generationProcessing.value = false
    cachedServerConvertWorkspace.value = null
    skipNextConvertWorkspaceRestore.value = false
    clearAnalyticsState()
    clearGraphCells()
  }

  const markNextConvertWorkspaceRestoreSkipped = () => {
    skipNextConvertWorkspaceRestore.value = true
  }

  const consumeNextConvertWorkspaceRestoreSkipped = () => {
    const shouldSkip = skipNextConvertWorkspaceRestore.value
    skipNextConvertWorkspaceRestore.value = false
    return shouldSkip
  }

  const hasMeaningfulUserThreadState = () =>
    step.value !== 0 ||
    type.value !== ConvertType.TEXT ||
    authoringMode.value !== AuthoringMode.AI ||
    convertContent.value.trim().length > 0 ||
    newConvertContent.value.trim().length > 0 ||
    convertFileContent.value.trim().length > 0 ||
    stateContent.value.trim().length > 0 ||
    sessionTopics.value.length > 0 ||
    api1Result.value !== null ||
    authoringContext.value.goal !== DEFAULT_AUTHORING_CONTEXT.goal ||
    authoringContext.value.ageMin !== DEFAULT_AUTHORING_CONTEXT.ageMin ||
    authoringContext.value.ageMax !== DEFAULT_AUTHORING_CONTEXT.ageMax ||
    authoringContext.value.gender.trim().length > 0 ||
    authoringContext.value.persona.trim().length > 0

  const buildUserScopedKey = (base: string, targetUserName = userName.value) =>
    `${base}:${buildUserKeySuffix(targetUserName)}`

  const persistKnownUserNames = () => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(
        USER_REGISTRY_STORAGE_KEY,
        JSON.stringify(knownUserNames.value),
      )
    } catch (error) {
      console.warn('Failed to persist user registry', error)
    }
  }

  const persistLastUserProfile = () => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(
        USER_PROFILE_STORAGE_KEY,
        JSON.stringify({ name: lastUsedUserName.value }),
      )
    } catch (error) {
      console.warn('Failed to persist user name', error)
    }
  }

  const persistAnalyticsStateNow = (targetUserName = userName.value) => {
    if (
      typeof window === 'undefined' ||
      !analyticsState.value ||
      !normalizeUserName(targetUserName).length
    ) {
      return
    }
    try {
      window.localStorage.setItem(
        buildUserScopedKey(ANALYTICS_STORAGE_KEY, targetUserName),
        JSON.stringify(analyticsState.value),
      )
    } catch (error) {
      console.warn('Failed to persist authoring analytics', error)
    }
  }

  const schedulePersistAnalyticsState = () => {
    if (typeof window === 'undefined') {
      return
    }
    const targetUserName = userName.value
    if (analyticsPersistTimer !== null) {
      window.clearTimeout(analyticsPersistTimer)
    }
    analyticsPersistTimer = window.setTimeout(() => {
      analyticsPersistTimer = null
      persistAnalyticsStateNow(targetUserName)
    }, 250)
  }

  const clearAnalyticsState = () => {
    analyticsState.value = null
  }

  const initializeAnalyticsState = (name: string, options: { resumed?: boolean } = {}) => {
    const normalized = normalizeUserName(name)
    if (!normalized.length) {
      return null
    }

    const now = Date.now()
    const restored = (() => {
      if (typeof window === 'undefined') {
        return null
      }
      try {
        const raw = window.localStorage.getItem(
          buildUserScopedKey(ANALYTICS_STORAGE_KEY, normalized),
        )
        if (!raw) {
          return null
        }
        const parsed = JSON.parse(raw) as AuthoringAnalyticsState
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          parsed.schemaVersion !== 1 ||
          !Array.isArray(parsed.events)
        ) {
          return null
        }
        return {
          ...parsed,
          userName: normalized,
          latestSummary:
            parsed.latestSummary && typeof parsed.latestSummary === 'object'
              ? parsed.latestSummary
              : null,
          topicBaselines:
            parsed.topicBaselines && typeof parsed.topicBaselines === 'object'
              ? parsed.topicBaselines
              : {},
          topicAiTextBaselines:
            parsed.topicAiTextBaselines && typeof parsed.topicAiTextBaselines === 'object'
              ? parsed.topicAiTextBaselines
              : {},
          planBaseline:
            parsed.planBaseline && typeof parsed.planBaseline === 'object'
              ? parsed.planBaseline
              : null,
        } as AuthoringAnalyticsState
      } catch (error) {
        console.warn('Failed to restore authoring analytics', error)
        return null
      }
    })()

    analyticsState.value = restored ?? createAnalyticsState(normalized, now)
    const eventType: AnalyticsEventType = options.resumed || restored ? 'session_resumed' : 'session_started'
    const eventSource: AnalyticsEventSource = restored ? 'system' : 'manual'
    analyticsState.value.events.push(
      createAnalyticsEvent(eventType, eventSource, {
        meta: { restored: Boolean(restored) },
        timestamp: now,
      }),
    )
    analyticsState.value.lastActivityAt = now
    schedulePersistAnalyticsState()
    return analyticsState.value
  }

  const recordAnalyticsEvent = (
    type: AnalyticsEventType,
    source: AnalyticsEventSource,
    payload: Omit<AnalyticsEvent, 'id' | 'type' | 'source' | 'timestamp'> & {
      timestamp?: number
    } = {},
  ) => {
    if (!analyticsState.value) {
      return
    }
    const event = createAnalyticsEvent(type, source, payload)
    analyticsState.value.events.push(event)
    analyticsState.value.lastActivityAt = event.timestamp
    schedulePersistAnalyticsState()
  }

  const setPlanAnalyticsBaseline = (
    allTopics: Record<string, unknown> | null | undefined,
    topicRouting: TopicRoutingPlan | null | undefined,
  ) => {
    if (!analyticsState.value) {
      return
    }
    analyticsState.value.planBaseline = createPlanBaselineSnapshot(allTopics, topicRouting)
    analyticsState.value.topicBaselines = {}
    analyticsState.value.topicAiTextBaselines = {}
    analyticsState.value.latestSummary = null
    schedulePersistAnalyticsState()
  }

  const captureTopicAnalyticsBaselineIfMissing = (topicName: string, cells: Cell.Properties[]) => {
    if (!analyticsState.value) {
      return
    }
    const normalized = topicName.trim()
    if (!normalized.length || analyticsState.value.topicBaselines[normalized]) {
      return
    }
    analyticsState.value.topicBaselines[normalized] = snapshotTopicGraph(normalized, cells)
    schedulePersistAnalyticsState()
  }

  const setAnalyticsStateTextBaseline = (topicName: string, stateName: string, text: string) => {
    if (!analyticsState.value) {
      return
    }
    const normalizedTopic = topicName.trim()
    const normalizedState = stateName.trim()
    if (!normalizedTopic.length || !normalizedState.length) {
      return
    }
    analyticsState.value.topicAiTextBaselines[normalizedTopic] ??= {
      stateTexts: {},
      optionTexts: {},
    }
    analyticsState.value.topicAiTextBaselines[normalizedTopic].stateTexts[normalizedState] = String(
      text || '',
    ).trim()
    analyticsState.value.latestSummary = null
    schedulePersistAnalyticsState()
  }

  const setAnalyticsStateOptionTextsBaseline = (
    topicName: string,
    stateName: string,
    texts: string[],
  ) => {
    if (!analyticsState.value) {
      return
    }
    const normalizedTopic = topicName.trim()
    const normalizedState = stateName.trim()
    if (!normalizedTopic.length || !normalizedState.length) {
      return
    }
    analyticsState.value.topicAiTextBaselines[normalizedTopic] ??= {
      stateTexts: {},
      optionTexts: {},
    }
    analyticsState.value.topicAiTextBaselines[normalizedTopic].optionTexts[normalizedState] = (
      Array.isArray(texts) ? texts : []
    )
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry.length > 0)
    analyticsState.value.latestSummary = null
    schedulePersistAnalyticsState()
  }

  const buildCurrentAnalyticsSummary = (exportedAt = Date.now()) => {
    if (!analyticsState.value) {
      return null
    }
    const topicSources = Array.from(topicGraph.value.entries()).map(([topicName, cells]) => ({
      topicName,
      cells,
    }))
    const summary = buildAuthoringAnalyticsSummary({
      analyticsState: analyticsState.value,
      topicSources,
      topicRouting: getResolvedTopicRoutingPlan(),
      exportedAt,
    })
    analyticsState.value.latestSummary = summary
    schedulePersistAnalyticsState()
    return summary
  }

  const buildUserThreadSnapshot = (): UserThreadSnapshot | null => {
    if (!hasMeaningfulUserThreadState()) {
      return null
    }

    return {
      step: step.value,
      type: type.value,
      authoringMode: authoringMode.value,
      convertContent: convertContent.value,
      newConvertContent: newConvertContent.value,
      convertFileContent: convertFileContent.value,
      stateContent: stateContent.value,
      authoringContext: { ...authoringContext.value },
      sessionTopics: JSON.parse(JSON.stringify(sessionTopics.value)),
      api1Result: api1Result.value ? JSON.parse(JSON.stringify(api1Result.value)) : null,
    }
  }

  const applyUserThreadSnapshot = (snapshot: UserThreadSnapshot | null | undefined) => {
    if (!snapshot || typeof snapshot !== 'object') {
      return false
    }

    step.value = typeof snapshot.step === 'number' ? snapshot.step : 0
    type.value = typeof snapshot.type === 'number' ? snapshot.type : ConvertType.TEXT
    authoringMode.value =
      snapshot.authoringMode === AuthoringMode.MANUAL ? AuthoringMode.MANUAL : AuthoringMode.AI
    convertContent.value =
      typeof snapshot.convertContent === 'string' ? snapshot.convertContent : ''
    newConvertContent.value =
      typeof snapshot.newConvertContent === 'string' ? snapshot.newConvertContent : ''
    convertFileContent.value =
      typeof snapshot.convertFileContent === 'string' ? snapshot.convertFileContent : ''
    stateContent.value = typeof snapshot.stateContent === 'string' ? snapshot.stateContent : ''
    authoringContext.value = {
      ...cloneDefaultAuthoringContext(),
      ...(snapshot.authoringContext && typeof snapshot.authoringContext === 'object'
        ? snapshot.authoringContext
        : {}),
    }
    sessionTopics.value = Array.isArray(snapshot.sessionTopics) ? snapshot.sessionTopics : []
    api1Result.value =
      snapshot.api1Result && typeof snapshot.api1Result === 'object' ? snapshot.api1Result : null
    return true
  }

  const buildAnalyticsStateSnapshot = () => {
    if (!analyticsState.value) {
      return null
    }
    return JSON.parse(JSON.stringify(analyticsState.value)) as AuthoringAnalyticsState
  }

  const applyAnalyticsStateSnapshot = (snapshot: AuthoringAnalyticsState | null | undefined) => {
    if (
      !snapshot ||
      typeof snapshot !== 'object' ||
      snapshot.schemaVersion !== 1 ||
      !Array.isArray(snapshot.events)
    ) {
      return false
    }

    analyticsState.value = {
      ...snapshot,
      userName: normalizeUserName(snapshot.userName || userName.value),
      latestSummary:
        snapshot.latestSummary && typeof snapshot.latestSummary === 'object'
          ? snapshot.latestSummary
          : null,
      topicBaselines:
        snapshot.topicBaselines && typeof snapshot.topicBaselines === 'object'
          ? snapshot.topicBaselines
          : {},
      topicAiTextBaselines:
        snapshot.topicAiTextBaselines && typeof snapshot.topicAiTextBaselines === 'object'
          ? snapshot.topicAiTextBaselines
          : {},
      planBaseline:
        snapshot.planBaseline && typeof snapshot.planBaseline === 'object'
          ? snapshot.planBaseline
          : null,
    } as AuthoringAnalyticsState

    return true
  }

  const buildGenerationStateSnapshot = (): GenerationStateSnapshot | null => {
    flushAllTopicGraphs()

    const queueSnapshot = generationQueue.value.map((job) => ({
      ...job,
      warnings: Array.isArray(job.warnings)
        ? job.warnings.map((warning) => ({ ...warning }))
        : [],
    }))

    const scriptsSnapshot = Array.from(topicScripts.value.entries())

    const issuesSnapshot = Array.from(topicIssues.value.entries()).map(([topicName, issues]) => [
      topicName,
      issues.map((issue) => ({ ...issue })),
    ]) as [string, DialogueParseIssue[]][]

    const topicGraphSnapshot = Array.from(topicGraph.value.entries()).map(([topicName, cells]) => [
      topicName,
      JSON.parse(JSON.stringify(cells)) as Cell.Properties[],
    ]) as [string, Cell.Properties[]][]

    return {
      batchId: generationBatchId.value,
      cancelled: generationCancelled.value,
      activeTopicId: generationActiveTopicId.value,
      queue: queueSnapshot,
      scripts: scriptsSnapshot,
      issues: issuesSnapshot,
      topicGraph: topicGraphSnapshot,
      stateContent: stateContent.value,
      fingerprintVersion: GENERATION_FINGERPRINT_VERSION,
    }
  }

  const applyGenerationStateSnapshot = (snapshot: GenerationStateSnapshot | null | undefined) => {
    if (authoringMode.value === AuthoringMode.MANUAL) {
      generationBatchId.value = null
      generationCancelled.value = false
      generationActiveTopicId.value = null
      generationQueue.value = []
      topicScripts.value = new Map()
      topicIssues.value = new Map()
      generationProcessing.value = false
      queryTopicStrucLoading.value = false
      return false
    }

    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.queue)) {
      generationBatchId.value = null
      generationCancelled.value = false
      generationActiveTopicId.value = null
      generationQueue.value = []
      topicScripts.value = new Map()
      topicIssues.value = new Map()
      generationProcessing.value = false
      queryTopicStrucLoading.value = false
      return false
    }

    generationBatchId.value = snapshot.batchId ?? null
    generationCancelled.value = Boolean(snapshot.cancelled)
    generationActiveTopicId.value = snapshot.activeTopicId ?? null

    generationQueue.value = snapshot.queue.map((job) => ({
      ...job,
      status: job.status === 'running' ? 'pending' : job.status,
      warnings: Array.isArray(job.warnings)
        ? job.warnings.map((warning) => ({ ...warning }))
        : [],
    })) as TopicJob[]

    topicScripts.value = new Map(
      Array.isArray(snapshot.scripts)
        ? snapshot.scripts.map(([topicName, script]) => [topicName, script])
        : [],
    )

    topicIssues.value = new Map(
      Array.isArray(snapshot.issues)
        ? snapshot.issues.map(([topicName, issues]) => [
            topicName,
            Array.isArray(issues) ? issues.map((issue) => ({ ...issue })) : [],
          ])
        : [],
    )

    topicGraph.value.clear()
    if (Array.isArray(snapshot.topicGraph)) {
      snapshot.topicGraph.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) {
          return
        }
        const [topicName, cells] = entry as [unknown, unknown]
        if (typeof topicName === 'string' && Array.isArray(cells)) {
          topicGraph.value.set(topicName, normalizeTopicGraphCells(cells as Cell.Properties[]))
        }
      })
    }

    hydrateTopicGraphsFromScripts()
    stateContent.value = snapshot.stateContent ?? stateContent.value
    generationProcessing.value = false
    queryTopicStrucLoading.value = false
    rebuildStateContent()
    return true
  }

  const persistAllUserScopedState = () => {
    persistUserThreadState()
    persistGenerationState()
    persistAnalyticsStateNow()
  }

  const persistUserThreadState = () => {
    if (
      typeof window === 'undefined' ||
      pauseUserThreadPersistence ||
      !userSessionReady.value ||
      !normalizeUserName(userName.value).length
    ) {
      return false
    }

    const storageKey = buildUserScopedKey(USER_THREAD_STORAGE_KEY)
    const payload = buildUserThreadSnapshot()
    if (!payload) {
      window.localStorage.removeItem(storageKey)
      return false
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
      return true
    } catch (error) {
      console.warn('Failed to persist user thread state', error)
      return false
    }
  }

  const restoreUserThreadState = () => {
    if (
      typeof window === 'undefined' ||
      !userSessionReady.value ||
      !normalizeUserName(userName.value).length
    ) {
      return false
    }

    const storageKey = buildUserScopedKey(USER_THREAD_STORAGE_KEY)
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return false
    }

    try {
      const parsed = JSON.parse(raw) as UserThreadSnapshot
      return applyUserThreadSnapshot(parsed)
    } catch (error) {
      console.warn('Failed to restore user thread state', error)
      window.localStorage.removeItem(storageKey)
      return false
    }
  }

  const switchUserSession = (name: string) => {
    const normalized = normalizeUserName(name)
    if (!normalized.length) {
      throw new Error('User name is required.')
    }

    const currentKey = userSessionReady.value ? buildUserKeySuffix(userName.value) : ''
    const nextKey = buildUserKeySuffix(normalized)
    const threadChanged = !userSessionReady.value || currentKey !== nextKey

    if (threadChanged) {
      persistAnalyticsStateNow(userName.value)
      persistUserThreadState()
    }

    const existed = knownUserNames.value.some((entry) => buildUserKeySuffix(entry) === nextKey)
    const existingName =
      knownUserNames.value.find((entry) => buildUserKeySuffix(entry) === nextKey) ?? normalized
    if (!existed) {
      knownUserNames.value = [...knownUserNames.value, existingName]
      persistKnownUserNames()
    }

    userName.value = existingName
    lastUsedUserName.value = existingName
    userSessionReady.value = true
    persistLastUserProfile()

    let restored = false
    if (threadChanged) {
      pauseUserThreadPersistence = true
      try {
        resetDesignerStateForUser()
        restored = restoreUserThreadState()
      } finally {
        pauseUserThreadPersistence = false
      }
    }

    initializeAnalyticsState(existingName, {
      resumed: Boolean(restored || existed),
    })

    return {
      userName: existingName,
      existed,
      threadChanged,
      restored,
    }
  }

  const normalizeTopicList = (value: unknown): SubtopicSummary[] => {
    const createSummary = (
      name: string,
      brief?: string,
      miTechnique?: string,
      prompt?: string,
    ): SubtopicSummary => {
      const normalizedPrompt = sanitizeOptionalPrompt(prompt)
      return {
        name: name.trim(),
        brief: typeof brief === 'string' ? brief.trim() : '',
        miTechnique: typeof miTechnique === 'string' ? miTechnique.trim() : '',
        ...(normalizedPrompt ? { prompt: normalizedPrompt } : {}),
      }
    }

    const takeFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
      for (const key of keys) {
        const candidate = record[key]
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim()
          if (trimmed.length > 0) {
            return trimmed
          }
        }
      }

      return null
    }

    const fromRecord = (record: Record<string, unknown>): SubtopicSummary | null => {
      const name =
        takeFirstString(record, ['name', 'title', 'topic', 'subtopic']) ??
        takeFirstString(record, ['text', 'value', 'content'])

      if (!name) {
        return null
      }

      const brief =
        takeFirstString(record, ['brief', 'summary', 'description']) ?? ''

      const miTechnique =
        takeFirstString(record, ['mi_technique', 'miTechnique', 'mi']) ?? ''

      const prompt = takeFirstString(record, ['prompt']) ?? ''

      return createSummary(name, brief, miTechnique, prompt)
    }

    const normalize = (input: unknown): SubtopicSummary[] => {
      if (!input) {
        return []
      }

      if (Array.isArray(input)) {
        const results: SubtopicSummary[] = []
        for (const entry of input) {
          results.push(...normalize(entry))
        }
        return results
      }

      if (typeof input === 'string') {
        return input
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .map((entry) => createSummary(entry))
      }

      if (typeof input === 'object') {
        const summary = fromRecord(input as Record<string, unknown>)
        return summary ? [summary] : []
      }

      return []
    }

    return normalize(value)
  }

  const pickNormalizedSubtopics = (topicName: string): SubtopicSummary[] => {
    const fromAllTopics = api1Result.value?.all_topics?.[topicName]
    return normalizeTopicList(fromAllTopics)
  }

  const updatePromptInSubtopicList = (
    list: Array<string | SubtopicSummary> | undefined,
    subtopicName: string,
    promptValue: string,
  ) => {
    if (!Array.isArray(list)) {
      return false
    }

    const targetKey = normalizePlanNameKey(subtopicName)
    if (!targetKey) {
      return false
    }

    const prompt = normalizeEditablePrompt(promptValue)
    let updated = false

    list.forEach((entry, index) => {
      if (typeof entry === 'string') {
        if (normalizePlanNameKey(entry) !== targetKey) {
          return
        }

        list[index] = {
          name: entry.trim(),
          brief: '',
          miTechnique: '',
          ...(prompt.length ? { prompt } : {}),
        }
        updated = true
        return
      }

      if (!entry || typeof entry !== 'object') {
        return
      }

      const normalizedEntry = entry as SubtopicSummary
      if (normalizePlanNameKey(normalizedEntry.name) !== targetKey) {
        return
      }

      list[index] = {
        name: normalizedEntry.name?.trim() || subtopicName.trim(),
        brief: normalizedEntry.brief ?? '',
        miTechnique: normalizedEntry.miTechnique ?? '',
        ...(prompt.length ? { prompt } : {}),
      }
      updated = true
    })

    return updated
  }

  const updateTopicPrompt = (sessionName: string, topicName: string, promptValue: string) => {
    const targetSessionKey = normalizePlanNameKey(sessionName)
    const targetTopicKey = normalizePlanNameKey(topicName)
    const prompt = normalizeEditablePrompt(promptValue)

    sessionTopics.value.forEach((session) => {
      if (normalizePlanNameKey(session.sessionName) !== targetSessionKey) {
        return
      }

      session.topics.forEach((topic) => {
        if (normalizePlanNameKey(topic.topicName) !== targetTopicKey) {
          return
        }

        if (prompt.length) {
          topic.topicPrompt = prompt
        } else {
          delete topic.topicPrompt
        }
      })
    })
  }

  const updateSubtopicPrompt = (
    sessionName: string,
    topicName: string,
    subtopicName: string,
    promptValue: string,
  ) => {
    const targetSessionKey = normalizePlanNameKey(sessionName)
    const targetTopicKey = normalizePlanNameKey(topicName)
    const prompt = normalizeEditablePrompt(promptValue)

    sessionTopics.value.forEach((session) => {
      if (normalizePlanNameKey(session.sessionName) !== targetSessionKey) {
        return
      }

      session.topics.forEach((topic) => {
        if (normalizePlanNameKey(topic.topicName) !== targetTopicKey) {
          return
        }

        topic.list = topic.list.map((subtopic) => {
          if (normalizePlanNameKey(subtopic.name) !== normalizePlanNameKey(subtopicName)) {
            return subtopic
          }

          return {
            name: subtopic.name?.trim() || subtopicName.trim(),
            brief: subtopic.brief ?? '',
            miTechnique: subtopic.miTechnique ?? '',
            ...(prompt.length ? { prompt } : {}),
          }
        })
      })
    })

    const allTopicsList = api1Result.value?.all_topics?.[topicName]
    updatePromptInSubtopicList(allTopicsList, subtopicName, promptValue)

    const sessionTopicList = api1Result.value?.sessions_topics?.[sessionName]?.[topicName]
    updatePromptInSubtopicList(sessionTopicList, subtopicName, promptValue)
  }

  const normalizeSubtopicSummaryInput = (input: {
    name: string
    brief?: string
    miTechnique?: string
    prompt?: string
  }): SubtopicSummary | null => {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name.length) {
      return null
    }

    const prompt = sanitizeOptionalPrompt(input.prompt)
    return {
      name,
      brief: typeof input.brief === 'string' ? input.brief.trim() : '',
      miTechnique: typeof input.miTechnique === 'string' ? input.miTechnique.trim() : '',
      ...(prompt ? { prompt } : {}),
    }
  }

  const upsertSubtopicSummaryList = (
    list: SubtopicSummary[],
    summary: SubtopicSummary,
    options: { afterSubtopicName?: string } = {},
  ) => {
    const targetKey = normalizePlanNameKey(summary.name)
    const afterKey = normalizePlanNameKey(options.afterSubtopicName || '')
    const next = list.map((entry) => ({ ...entry }))
    const index = next.findIndex((entry) => normalizePlanNameKey(entry.name) === targetKey)

    const mergeSummary = (current?: SubtopicSummary): SubtopicSummary => {
      const prompt =
        sanitizeOptionalPrompt(summary.prompt) ?? sanitizeOptionalPrompt(current?.prompt) ?? undefined
      return {
        name: summary.name,
        brief: summary.brief || current?.brief || '',
        miTechnique: summary.miTechnique || current?.miTechnique || '',
        ...(prompt ? { prompt } : {}),
      }
    }

    if (index >= 0) {
      const merged = mergeSummary(next[index])
      const previous = next[index]
      const changed =
        previous.name !== merged.name ||
        previous.brief !== merged.brief ||
        previous.miTechnique !== merged.miTechnique ||
        (previous.prompt ?? '') !== (merged.prompt ?? '')
      next[index] = merged
      return {
        next,
        changed,
      }
    }

    const insertIndex = afterKey
      ? Math.max(
          0,
          next.findIndex((entry) => normalizePlanNameKey(entry.name) === afterKey) + 1,
        )
      : next.length
    next.splice(insertIndex, 0, mergeSummary())
    return {
      next,
      changed: true,
    }
  }

  const withDefaultStateMetadata = (topicName: string, stages: StageNode[]): StageNode[] => {
    if (!Array.isArray(stages) || !stages.length) {
      return []
    }

    const subtopics = pickNormalizedSubtopics(topicName)
    if (!subtopics.length) {
      return stages
    }

    const nonTerminalStates = stages.filter(
      (stage) => stage.stageName && stage.stageName.toLowerCase() !== 'end_conversation',
    )
    const terminalStates = stages.filter(
      (stage) => stage.stageName && stage.stageName.toLowerCase() === 'end_conversation',
    )

    const chunkSize = Math.max(1, Math.ceil(nonTerminalStates.length / subtopics.length))
    const fallback = subtopics[0]

    const resolveSubtopicForIndex = (index: number) =>
      subtopics[Math.min(subtopics.length - 1, Math.floor(index / chunkSize))] || fallback

    const updatedNonTerminal = nonTerminalStates.map((stage, index) => {
      const target = resolveSubtopicForIndex(index)
      const nextSubtopic =
        typeof stage.subtopic === 'string' && stage.subtopic.trim().length > 0
          ? stage.subtopic.trim()
          : target.name
      const nextMiTechnique =
        typeof stage.miTechnique === 'string' && stage.miTechnique.trim().length > 0
          ? stage.miTechnique.trim()
          : target.miTechnique || target.brief || ''

      return {
        ...stage,
        subtopic: nextSubtopic,
        miTechnique: nextMiTechnique,
      }
    })

    const updatedTerminal = terminalStates.map((stage) => ({
      ...stage,
      subtopic:
        typeof stage.subtopic === 'string' && stage.subtopic.trim().length > 0
          ? stage.subtopic.trim()
          : 'Wrap-up',
      miTechnique:
        typeof stage.miTechnique === 'string' && stage.miTechnique.trim().length > 0
          ? stage.miTechnique.trim()
          : 'Summary',
    }))

    const lookup = new Map<string, StageNode>()
    ;[...updatedNonTerminal, ...updatedTerminal].forEach((entry) => {
      lookup.set(entry.stageName, entry)
    })

    return stages.map((stage, index) => {
      const normalizedStage = lookup.get(stage.stageName) ?? stage
      const nextStageName = stages[index + 1]?.stageName?.trim() || ''
      const hasMenus = Array.isArray(normalizedStage.menus) && normalizedStage.menus.length > 0

      if (
        hasMenus ||
        !nextStageName.length ||
        normalizedStage.stageName.toLowerCase() === 'end_conversation'
      ) {
        return normalizedStage
      }

      return {
        ...normalizedStage,
        menus: [
          {
            title: 'Continue',
            fromStage: normalizedStage.stageName,
            nextStage: nextStageName,
            id: `${normalizedStage.stageName}__auto_continue`,
          },
        ],
      }
    })
  }

  const parseSuggestionStateDrafts = (content: string): Record<string, SuggestedStateDraft> => {
    const drafts: Record<string, SuggestedStateDraft> = {}
    const lines = content.split(/\r?\n/)
    let currentState: string | null = null
    let collectingAgent = false
    let agentLines: string[] = []

    const flushAgent = () => {
      if (collectingAgent && currentState) {
        const text = agentLines.join('\n').trim()
        if (text) {
          drafts[currentState] = {
            ...(drafts[currentState] ?? { agent: '', subtopic: '', miTechnique: '' }),
            agent: text,
          }
        }
      }
      agentLines = []
      collectingAgent = false
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        if (collectingAgent) {
          agentLines.push('')
        }
        continue
      }

      const upper = line.toUpperCase()
      if (upper.startsWith('STATE:')) {
        flushAgent()
        currentState = line.slice(6).trim()
        if (currentState && !drafts[currentState]) {
          drafts[currentState] = {
            agent: '',
            subtopic: '',
            miTechnique: '',
          }
        }
        continue
      }

      if (upper.startsWith('SUBTOPIC:') || upper.startsWith('SUBTOPIC_LABEL:')) {
        flushAgent()
        if (currentState) {
          drafts[currentState] = {
            ...(drafts[currentState] ?? { agent: '', subtopic: '', miTechnique: '' }),
            subtopic: line.slice(line.indexOf(':') + 1).trim(),
          }
        }
        continue
      }

      if (
        upper.startsWith('MI_TECHNIQUE:') ||
        upper.startsWith('MI TECHNIQUE:') ||
        upper.startsWith('MI:')
      ) {
        flushAgent()
        if (currentState) {
          drafts[currentState] = {
            ...(drafts[currentState] ?? { agent: '', subtopic: '', miTechnique: '' }),
            miTechnique: line.slice(line.indexOf(':') + 1).trim(),
          }
        }
        continue
      }

      if (upper.startsWith('AGENT:')) {
        collectingAgent = true
        agentLines = [line.slice(6).trim()]
        continue
      }

      if (upper.startsWith('USERMENU:') || upper.startsWith('ACTION:') || line.startsWith('//')) {
        flushAgent()
        continue
      }

      if (collectingAgent) {
        agentLines.push(line)
        continue
      }
    }

    flushAgent()
    return drafts
  }

  const parseSuggestionAgents = (content: string): Record<string, string> => {
    const drafts = parseSuggestionStateDrafts(content)
    return Object.entries(drafts).reduce(
      (acc, [stateName, draft]) => {
        if (draft.agent.trim()) {
          acc[stateName] = draft.agent
        }
        return acc
      },
      {} as Record<string, string>,
    )
  }

  const buildAuthoringContext = () => {
    const parts: string[] = []
    parts.push(`Goal: ${authoringContext.value.goal || 'Not specified'}`)
    const { ageMin, ageMax, gender, persona } = authoringContext.value
    if (ageMin !== null || ageMax !== null) {
      const minLabel = ageMin !== null ? ageMin : '?'
      const maxLabel = ageMax !== null ? ageMax : '?'
      parts.push(`Age Range: ${minLabel} - ${maxLabel}`)
    }
    if (gender && gender.trim().length) parts.push(`Gender: ${gender.trim()}`)
    if (persona && persona.trim().length) parts.push(`Persona: ${persona.trim()}`)
    return parts.join('\n')
  }

  const buildApi1Fingerprint = (desc: string) => {
    const normalizedDesc = (desc || '').trim()
    const ctx = authoringContext.value
    return JSON.stringify({
      desc: normalizedDesc,
      goal: ctx.goal,
      ageMin: ctx.ageMin,
      ageMax: ctx.ageMax,
      gender: (ctx.gender || '').trim(),
      persona: (ctx.persona || '').trim(),
    })
  }

  const buildAiSessionId = () => {
    const user = userName.value.trim() || 'default'
    return `healthdial:${user}`
  }

  const getResolvedTopicRoutingPlan = (planResult: Api1PlanResult | null = api1Result.value) => {
    const orderedTopicNames = buildOrderedPlanTopicNames(
      planResult?.all_topics ?? null,
      planResult?.sessions_topics ?? null,
    )
    return normalizeTopicRouting(planResult?.topic_routing ?? null, orderedTopicNames)
  }

  const buildAvailableRoutingTopicNames = () =>
    buildOrderedPlanTopicNames(api1Result.value?.all_topics ?? null, api1Result.value?.sessions_topics ?? null)

  const buildEmptyPlanResult = (): Api1PlanResult => ({
    all_topics: {},
    sessions_topics: {},
    topic_routing: normalizeTopicRouting(null, []),
  })

  const initializeManualAuthoringPlan = (sessionName = DEFAULT_MANUAL_SESSION_NAME) => {
    const normalizedSessionName = sessionName.trim() || DEFAULT_MANUAL_SESSION_NAME

    if (!api1Result.value) {
      api1Result.value = buildEmptyPlanResult()
    }

    if (
      !sessionTopics.value.some(
        (entry) => normalizePlanNameKey(entry.sessionName) === normalizePlanNameKey(normalizedSessionName),
      )
    ) {
      sessionTopics.value = [
        ...sessionTopics.value,
        {
          sessionName: normalizedSessionName,
          topics: [],
        },
      ]
    }

    api1Result.value = {
      ...(api1Result.value ?? buildEmptyPlanResult()),
      all_topics: {
        ...api1Result.value?.all_topics,
      },
      sessions_topics: {
        ...api1Result.value?.sessions_topics,
        [normalizedSessionName]: {
          ...api1Result.value?.sessions_topics?.[normalizedSessionName],
        },
      },
      topic_routing: normalizeTopicRouting(
        api1Result.value?.topic_routing ?? null,
        buildOrderedPlanTopicNames(
          api1Result.value?.all_topics ?? null,
          {
            ...api1Result.value?.sessions_topics,
            [normalizedSessionName]: {
              ...api1Result.value?.sessions_topics?.[normalizedSessionName],
            },
          },
        ),
      ),
    }

    lastApi1Res.value = buildPlanPreviousResponse()
    lastApi1Fingerprint.value = buildApi1Fingerprint(convertContent.value)
    return normalizedSessionName
  }

  const renameTopicRoutingReferences = (
    routing: TopicRoutingPlan,
    originalTopicName: string,
    nextTopicName: string,
  ): TopicRoutingPlan => {
    const originalKey = normalizePlanNameKey(originalTopicName)
    const rewriteTopic = (value: string) =>
      normalizePlanNameKey(value) === originalKey ? nextTopicName : value

    return {
      entryTopic:
        normalizePlanNameKey(routing.entryTopic) === originalKey ? nextTopicName : routing.entryTopic,
      routes: routing.routes.map((route) => ({
        ...route,
        topicName: rewriteTopic(route.topicName),
        nextTopics: route.nextTopics.map(rewriteTopic),
        branchMenu: route.branchMenu.map((choice) => ({
          ...choice,
          targetTopic: rewriteTopic(choice.targetTopic),
        })),
      })),
    }
  }

  const buildRouteChoiceDefaults = (
    targetTopics: string[],
    existingChoices: TopicRouteChoice[] | undefined,
  ) => {
    const existingLabels = new Map(
      (existingChoices ?? []).map((choice) => [
        normalizePlanNameKey(choice.targetTopic),
        typeof choice.label === 'string' ? choice.label.trim() : '',
      ]),
    )

    return targetTopics.map((targetTopic) => ({
      targetTopic,
      label: (() => {
        const existingLabel = existingLabels.get(normalizePlanNameKey(targetTopic)) || ''
        return existingLabel && !isLegacyTopicChoiceLabel(existingLabel)
          ? existingLabel
          : buildDefaultTopicChoiceLabel(targetTopic)
      })(),
    }))
  }

  const applyEditedTopicRouting = (nextRouting: TopicRoutingPlan) => {
    if (!api1Result.value) {
      return
    }

    const orderedTopicNames = buildAvailableRoutingTopicNames()
    const previousRoutingJson = JSON.stringify(getResolvedTopicRoutingPlan())
    const normalizedRouting = normalizeTopicRouting(nextRouting, orderedTopicNames)
    const nextRoutingJson = JSON.stringify(normalizedRouting)

    api1Result.value = {
      ...api1Result.value,
      topic_routing: normalizedRouting,
    }

    lastApi1Res.value = buildPlanPreviousResponse()
    lastApi1Fingerprint.value = buildApi1Fingerprint(convertContent.value)
    if (previousRoutingJson !== nextRoutingJson) {
      recordAnalyticsEvent('route_changed', 'manual', {
        field: 'topic_routing',
        meta: {
          beforeHash: hashText(previousRoutingJson),
          afterHash: hashText(nextRoutingJson),
        },
      })
    }
  }

  const updateTopicRouting = (
    updater: (routing: TopicRoutingPlan, orderedTopicNames: string[]) => TopicRoutingPlan,
  ) => {
    if (!api1Result.value) {
      return
    }

    const orderedTopicNames = buildAvailableRoutingTopicNames()
    const currentRouting = getResolvedTopicRoutingPlan()
    const nextRouting = updater(currentRouting, orderedTopicNames)
    applyEditedTopicRouting(nextRouting)
  }

  const updateTopicRoutingEntryTopic = (topicName: string) => {
    updateTopicRouting((routing, orderedTopicNames) => {
      const resolvedTopicName =
        orderedTopicNames.find(
          (candidate) => normalizePlanNameKey(candidate) === normalizePlanNameKey(topicName),
        ) ?? orderedTopicNames[0] ?? ''

      return {
        ...routing,
        entryTopic: resolvedTopicName,
      }
    })
  }

  const updateTopicRoutingTransition = (
    topicName: string,
    transition: TopicRouteTransition,
  ) => {
    updateTopicRouting((routing, orderedTopicNames) => {
      const topicKey = normalizePlanNameKey(topicName)
      const currentRoute =
        routing.routes.find((route) => normalizePlanNameKey(route.topicName) === topicKey) ??
        routing.routes[0]

      if (!currentRoute) {
        return routing
      }

      const availableTargets = orderedTopicNames.filter(
        (candidate) => normalizePlanNameKey(candidate) !== topicKey,
      )

      const existingTargets = currentRoute.nextTopics.filter(
        (candidate, index, entries) =>
          normalizePlanNameKey(candidate) !== topicKey &&
          entries.findIndex(
            (entry) => normalizePlanNameKey(entry) === normalizePlanNameKey(candidate),
          ) === index,
      )

      let nextTopics: string[] = []
      if (transition === 'direct') {
        nextTopics = existingTargets.slice(0, 1)
        if (!nextTopics.length && availableTargets.length) {
          nextTopics = [availableTargets[0]]
        }
      } else if (transition === 'branch') {
        nextTopics = existingTargets.slice(0, 2)
        if (nextTopics.length < 2) {
          availableTargets.forEach((candidate) => {
            if (
              nextTopics.length < 2 &&
              !nextTopics.some(
                (entry) => normalizePlanNameKey(entry) === normalizePlanNameKey(candidate),
              )
            ) {
              nextTopics.push(candidate)
            }
          })
        }
      }

      return {
        ...routing,
        routes: routing.routes.map((route) => {
          if (normalizePlanNameKey(route.topicName) !== topicKey) {
            return route
          }

          return {
            ...route,
            transition,
            nextTopics,
            branchMenu:
              transition === 'branch'
                ? buildRouteChoiceDefaults(nextTopics, route.branchMenu)
                : [],
          }
        }),
      }
    })
  }

  const updateTopicRoutingNextTopics = (
    topicName: string,
    nextTopics: string[],
  ) => {
    updateTopicRouting((routing, orderedTopicNames) => {
      const topicKey = normalizePlanNameKey(topicName)
      const currentRoute =
        routing.routes.find((route) => normalizePlanNameKey(route.topicName) === topicKey) ??
        routing.routes[0]

      if (!currentRoute) {
        return routing
      }

      const normalizedNextTopics = nextTopics.reduce((acc, rawTopic) => {
        const resolved =
          orderedTopicNames.find(
            (candidate) => normalizePlanNameKey(candidate) === normalizePlanNameKey(rawTopic),
          ) ?? ''

        if (
          !resolved.length ||
          normalizePlanNameKey(resolved) === topicKey ||
          acc.some((entry) => normalizePlanNameKey(entry) === normalizePlanNameKey(resolved))
        ) {
          return acc
        }

        acc.push(resolved)
        return acc
      }, [] as string[])

      const transition: TopicRouteTransition =
        currentRoute.transition === 'branch'
          ? normalizedNextTopics.length > 1
            ? 'branch'
            : normalizedNextTopics.length === 1
              ? 'direct'
              : 'end'
          : normalizedNextTopics.length > 1
            ? 'branch'
            : normalizedNextTopics.length === 1
              ? 'direct'
              : 'end'

      return {
        ...routing,
        routes: routing.routes.map((route) => {
          if (normalizePlanNameKey(route.topicName) !== topicKey) {
            return route
          }

          return {
            ...route,
            transition,
            nextTopics: normalizedNextTopics,
            branchMenu:
              transition === 'branch'
                ? buildRouteChoiceDefaults(normalizedNextTopics, route.branchMenu)
                : [],
          }
        }),
      }
    })
  }

  const updateTopicRoutingBranchLabel = (
    topicName: string,
    targetTopic: string,
    label: string,
  ) => {
    updateTopicRouting((routing) => {
      const topicKey = normalizePlanNameKey(topicName)
      const targetKey = normalizePlanNameKey(targetTopic)

      return {
        ...routing,
        routes: routing.routes.map((route) => {
          if (
            normalizePlanNameKey(route.topicName) !== topicKey ||
            route.transition !== 'branch'
          ) {
            return route
          }

          const nextChoices = buildRouteChoiceDefaults(route.nextTopics, route.branchMenu).map(
            (choice) => {
              if (normalizePlanNameKey(choice.targetTopic) !== targetKey) {
                return choice
              }

              const trimmedLabel = label.trim()
              return {
                ...choice,
                label: trimmedLabel || choice.label,
              }
            },
          )

          return {
            ...route,
            branchMenu: nextChoices,
          }
        }),
      }
    })
  }

  const buildTopicRouteContextPayload = (topicName: string): TopicRouteContextPayload => {
    const normalizedTopicName = typeof topicName === 'string' ? topicName.trim() : ''
    if (!normalizedTopicName.length) {
      return {
        entryTopic: '',
        isEntryTopic: false,
        incomingTopics: [],
        nextTopics: [],
        transition: 'end',
        branchMenu: [],
        isTerminalTopic: true,
      }
    }

    return getTopicRouteContext(getResolvedTopicRoutingPlan(), normalizedTopicName)
  }

  const toRecordOutput = (value: unknown): Record<string, unknown> | null => {
    if (!value) {
      return null
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>
        }
      } catch {
        return null
      }
      return null
    }

    if (typeof value === 'object') {
      return value as Record<string, unknown>
    }

    return null
  }

  const clearTopicPlanResult = () => {
    api1Result.value = null
    sessionTopics.value = []
  }

  const normalizePlanResult = (parsedRecord: Record<string, unknown>) => {
    const rawAllTopics = parsedRecord['all_topics']
    const rawSessionsTopics = parsedRecord['sessions_topics']

    const normalizedAllTopics =
      rawAllTopics && typeof rawAllTopics === 'object'
        ? Object.entries(rawAllTopics as Record<string, unknown>).reduce(
            (acc, [topicName, subtopics]) => {
              acc[topicName] = normalizeTopicList(subtopics)
              return acc
            },
            {} as Record<string, SubtopicSummary[]>,
          )
        : {}

    const normalizedSessions =
      rawSessionsTopics && typeof rawSessionsTopics === 'object'
        ? Object.entries(rawSessionsTopics as Record<string, unknown>).reduce(
            (sessionAcc, [sessionName, sessionTopicsRaw]) => {
              if (sessionTopicsRaw && typeof sessionTopicsRaw === 'object') {
                const topicsRecord = sessionTopicsRaw as Record<string, unknown>

                sessionAcc[sessionName] = Object.entries(topicsRecord).reduce(
                  (topicAcc, [topicName, subtopicsRaw]) => {
                    topicAcc[topicName] = normalizeTopicList(subtopicsRaw)
                    return topicAcc
                  },
                  {} as Record<string, SubtopicSummary[]>,
                )
              } else {
                sessionAcc[sessionName] = {}
              }

              return sessionAcc
            },
            {} as Record<string, Record<string, SubtopicSummary[]>>,
          )
        : {}

    const normalizedTopicRouting = normalizeTopicRouting(
      parsedRecord['topic_routing'],
      buildOrderedPlanTopicNames(normalizedAllTopics, normalizedSessions),
    )

    return {
      api1: {
        ...parsedRecord,
        all_topics: normalizedAllTopics,
        sessions_topics: normalizedSessions,
        topic_routing: normalizedTopicRouting,
      } as Api1PlanResult,
      sessions: Object.entries(normalizedSessions).map(([sessionName, topics]) => ({
        sessionName,
        topics: Object.entries(topics).map(([topicName, subtopics]) => ({
          topicName,
          list: subtopics,
        })),
      })) as SessionTopic[],
    }
  }

  const applyNormalizedPlanResult = (normalized: ReturnType<typeof normalizePlanResult>) => {
    api1Result.value = normalized.api1
    sessionTopics.value = normalized.sessions
  }

  const buildPlanPreviousResponse = () => {
    if (!api1Result.value) {
      return ''
    }

    const toSerializableList = (entries: Array<string | SubtopicSummary> | undefined) =>
      (entries ?? []).map((entry) => {
        if (typeof entry === 'string') {
          return entry
        }

        return {
          name: entry.name,
          brief: entry.brief,
          mi_technique: entry.miTechnique,
        }
      })

    const allTopics = Object.entries(api1Result.value.all_topics ?? {}).reduce(
      (acc, [topicName, entries]) => {
        acc[topicName] = toSerializableList(entries)
        return acc
      },
      {} as Record<string, Array<string | Record<string, string>>>,
    )

    const sessionsTopics = Object.entries(api1Result.value.sessions_topics ?? {}).reduce(
      (sessionAcc, [sessionName, topics]) => {
        sessionAcc[sessionName] = Object.entries(topics ?? {}).reduce(
          (topicAcc, [topicName, entries]) => {
            topicAcc[topicName] = toSerializableList(entries)
            return topicAcc
          },
          {} as Record<string, Array<string | Record<string, string>>>,
        )
        return sessionAcc
      },
      {} as Record<string, Record<string, Array<string | Record<string, string>>>>,
    )

    return {
      all_topics: allTopics,
      sessions_topics: sessionsTopics,
      topic_routing: getResolvedTopicRoutingPlan(api1Result.value),
    }
  }

  const requestPlanResult = async (input: {
    sourceContent: string
    mentorDirections: string
    previousResponse: unknown
  }) => {
    const response = await requestAiTask<Record<string, unknown>>({
      taskTag: 'plan.generate',
      sessionId: buildAiSessionId(),
      input: {
        sourceContent: input.sourceContent,
        authoringContext: buildAuthoringContext(),
        mentorDirections: input.mentorDirections,
        previousResponse: input.previousResponse,
      },
      trace: {
        clientVersion: 'web-2026.02',
      },
    })

    const parsedRecord = toRecordOutput(response.output)
    if (!parsedRecord) {
      throw new Error('Plan response was empty or not valid JSON.')
    }

    return {
      parsedRecord,
      normalized: normalizePlanResult(parsedRecord),
    }
  }

  const replaceTopicPlanFromResult = (
    sessionName: string,
    topicName: string,
    normalized: ReturnType<typeof normalizePlanResult>,
    options: { clearPromptForSubtopicName?: string } = {},
  ) => {
    const nextTopicPlan = normalizeTopicList(
      normalized.api1.sessions_topics?.[sessionName]?.[topicName] ??
        normalized.api1.all_topics?.[topicName],
    )

    if (!nextTopicPlan.length) {
      throw new Error(`Updated plan did not include topic "${topicName}".`)
    }

    const currentSession = sessionTopics.value.find(
      (entry) => normalizePlanNameKey(entry.sessionName) === normalizePlanNameKey(sessionName),
    )
    const currentTopic = currentSession?.topics.find(
      (entry) => normalizePlanNameKey(entry.topicName) === normalizePlanNameKey(topicName),
    )

    if (!currentSession || !currentTopic || !api1Result.value) {
      throw new Error(`Current plan is missing topic "${topicName}".`)
    }

    const promptBySubtopic = new Map(
      (currentTopic.list ?? []).map((subtopic) => [
        normalizePlanNameKey(subtopic.name),
        subtopic.prompt ?? '',
      ]),
    )

    const mergedSubtopics = nextTopicPlan.map((subtopic) => {
      const subtopicKey = normalizePlanNameKey(subtopic.name)
      const shouldClearPrompt =
        typeof options.clearPromptForSubtopicName === 'string' &&
        normalizePlanNameKey(options.clearPromptForSubtopicName) === subtopicKey
      const preservedPrompt = shouldClearPrompt ? '' : promptBySubtopic.get(subtopicKey)
      return {
        ...subtopic,
        ...(preservedPrompt && preservedPrompt.length ? { prompt: preservedPrompt } : {}),
      }
    })

    api1Result.value = {
      ...api1Result.value,
      all_topics: {
        ...api1Result.value.all_topics,
        [topicName]: mergedSubtopics,
      },
      sessions_topics: {
        ...api1Result.value.sessions_topics,
        [sessionName]: {
          ...api1Result.value.sessions_topics?.[sessionName],
          [topicName]: mergedSubtopics,
        },
      },
      topic_routing:
        normalized.api1.topic_routing ?? api1Result.value.topic_routing ?? getResolvedTopicRoutingPlan(api1Result.value),
    }

    sessionTopics.value = sessionTopics.value.map((session) => {
      if (normalizePlanNameKey(session.sessionName) !== normalizePlanNameKey(sessionName)) {
        return session
      }

      return {
        ...session,
        topics: session.topics.map((topic) => {
          if (normalizePlanNameKey(topic.topicName) !== normalizePlanNameKey(topicName)) {
            return topic
          }

          return {
            ...topic,
            list: mergedSubtopics,
          }
        }),
      }
    })

    lastApi1Res.value = buildPlanPreviousResponse()
    lastApi1Fingerprint.value = buildApi1Fingerprint(convertContent.value)
  }

  const buildScopedPlanMentorDirections = (request: {
    scope: PlanRegenerationScope
    sessionName: string
    topicName: string
    subtopicName?: string
    revisionNote: string
    baseMentorDirections?: string
  }) => {
    const sections: string[] = []
    const baseMentor = typeof request.baseMentorDirections === 'string'
      ? request.baseMentorDirections.trim()
      : ''

    if (baseMentor.length) {
      sections.push(baseMentor)
    }

    if (request.scope === 'topic') {
      sections.push(
        [
          'Use PREVIOUS_RESPONSE as the current approved plan.',
          `Revise only the topic "${request.topicName}" in session "${request.sessionName}".`,
          'Keep all other topics and subtopics unchanged unless a minimal consistency fix is required.',
          'Keep topic_routing unchanged unless the revision makes a minimal routing consistency fix necessary.',
          'Keep existing topic and subtopic identifiers stable unless the revision note explicitly asks to rename them.',
          'Return the full JSON plan in the same schema after applying this targeted revision.',
          'Revision notes for this topic:',
          request.revisionNote.trim(),
        ].join('\n'),
      )
    } else {
      sections.push(
        [
          'Use PREVIOUS_RESPONSE as the current approved plan.',
          `Revise only the subtopic "${request.subtopicName}" under topic "${request.topicName}" in session "${request.sessionName}".`,
          'Keep all other topics and subtopics unchanged unless a minimal consistency fix is required.',
          'Keep topic_routing unchanged unless the revision makes a minimal routing consistency fix necessary.',
          'Keep existing topic and subtopic identifiers stable unless the revision note explicitly asks to rename them.',
          'If the revision note implies a better name for the target subtopic, rename that subtopic and keep the new name consistent in both all_topics and sessions_topics.',
          'Return the full JSON plan in the same schema after applying this targeted revision.',
          'Revision notes for this subtopic:',
          request.revisionNote.trim(),
        ].join('\n'),
      )
    }

    return sections.join('\n\n').trim()
  }

  const regeneratePlanTopic = async (request: {
    sessionName: string
    topicName: string
    revisionNote: string
    baseMentorDirections?: string
  }) => {
    if (!convertContent.value.trim().length) {
      throw new Error('Source content is missing.')
    }
    if (!api1Result.value) {
      throw new Error('Generate a topic plan before revising a topic.')
    }

    try {
      const { normalized } = await requestPlanResult({
        sourceContent: convertContent.value.trim(),
        mentorDirections: buildScopedPlanMentorDirections({
          scope: 'topic',
          sessionName: request.sessionName,
          topicName: request.topicName,
          revisionNote: request.revisionNote,
          baseMentorDirections: request.baseMentorDirections,
        }),
        previousResponse: buildPlanPreviousResponse(),
      })

      replaceTopicPlanFromResult(request.sessionName, request.topicName, normalized)
    } catch (error) {
      const payload = parseAiTaskError(error, `Failed to regenerate topic "${request.topicName}".`)
      throw new Error(payload.detail ? `${payload.message} (${payload.detail})` : payload.message)
    }
  }

  const regeneratePlanSubtopic = async (request: {
    sessionName: string
    topicName: string
    subtopicName: string
    revisionNote: string
    baseMentorDirections?: string
  }) => {
    if (!convertContent.value.trim().length) {
      throw new Error('Source content is missing.')
    }
    if (!api1Result.value) {
      throw new Error('Generate a topic plan before revising a subtopic.')
    }

    try {
      const { normalized } = await requestPlanResult({
        sourceContent: convertContent.value.trim(),
        mentorDirections: buildScopedPlanMentorDirections({
          scope: 'subtopic',
          sessionName: request.sessionName,
          topicName: request.topicName,
          subtopicName: request.subtopicName,
          revisionNote: request.revisionNote,
          baseMentorDirections: request.baseMentorDirections,
        }),
        previousResponse: buildPlanPreviousResponse(),
      })

      replaceTopicPlanFromResult(request.sessionName, request.topicName, normalized, {
        clearPromptForSubtopicName: request.subtopicName,
      })
    } catch (error) {
      const payload = parseAiTaskError(
        error,
        `Failed to regenerate subtopic "${request.subtopicName}".`,
      )
      throw new Error(payload.detail ? `${payload.message} (${payload.detail})` : payload.message)
    }
  }

  const convert2topic = async (desc: string, mentor: string = '') => {
    const normalizedDesc = (desc || '').trim()
    convertContent.value = desc
    convertLoading.value = true
    clearTopicPlanResult()
    const planRequestStartedAt = Date.now()
    recordAnalyticsEvent('plan_generate_requested', 'ai')

    const currentFingerprint = buildApi1Fingerprint(desc)
    const canReusePreviousResponse =
      Boolean(mentor.trim().length) &&
      Boolean(lastApi1Res.value) &&
      currentFingerprint === lastApi1Fingerprint.value

    if (!canReusePreviousResponse) {
      lastApi1Res.value = ''
      lastApi1Fingerprint.value = currentFingerprint
    }

    try {
      const { parsedRecord, normalized } = await requestPlanResult({
        sourceContent: normalizedDesc,
        mentorDirections: mentor,
        previousResponse: canReusePreviousResponse ? lastApi1Res.value : '',
      })
      lastApi1Res.value = parsedRecord
      lastApi1Fingerprint.value = currentFingerprint
      applyNormalizedPlanResult(normalized)
      setPlanAnalyticsBaseline(normalized.api1.all_topics ?? null, normalized.api1.topic_routing ?? null)
      recordAnalyticsEvent('plan_generated', 'ai', {
        durationMs: Math.max(0, Date.now() - planRequestStartedAt),
        meta: {
          topicCount: Object.keys(normalized.api1.all_topics ?? {}).length,
        },
      })

      convertLoading.value = false
    } catch (error) {
      convertLoading.value = false
      clearTopicPlanResult()
      updateStep(0)
      recordAnalyticsEvent('plan_generation_failed', 'ai', {
        durationMs: Math.max(0, Date.now() - planRequestStartedAt),
      })
      const payload = parseAiTaskError(error, 'Failed to generate topic plan.')
      msgSrv.error(payload.detail ? `${payload.message} (${payload.detail})` : payload.message)
    }
  }
  const clearGraphView = () => {
    clearGraphCellsSafely()
  }

  const buildTopicJobs = (): TopicJob[] => {
    const jobs: TopicJob[] = []
    const seen = new Set<string>()
    const topicEntries = new Map<
      string,
      {
        sessionName: string
        topicName: string
      }
    >()

    sessionTopics.value.forEach((session) => {
      session.topics.forEach((topic) => {
        const key = normalizePlanNameKey(topic.topicName)
        if (!key.length || topicEntries.has(key)) {
          return
        }
        topicEntries.set(key, {
          sessionName: session.sessionName,
          topicName: topic.topicName,
        })
      })
    })

    const orderedTopicNames = normalizeTopicRouting(
      api1Result.value?.topic_routing ?? null,
      buildOrderedPlanTopicNames(api1Result.value?.all_topics ?? null, api1Result.value?.sessions_topics ?? null),
    ).routes.map((route) => route.topicName)

    const enqueueTopic = (entry: { sessionName: string; topicName: string }) => {
      const identifier = `${entry.sessionName}::${entry.topicName}`
      if (seen.has(identifier)) {
        return
      }
      seen.add(identifier)
      jobs.push({
        id: identifier,
        topicName: entry.topicName,
        sessionName: entry.sessionName,
        attempt: 0,
        status: 'pending',
        warnings: [],
      })
    }

    orderedTopicNames.forEach((topicName) => {
      const entry = topicEntries.get(normalizePlanNameKey(topicName))
      if (entry) {
        enqueueTopic(entry)
      }
    })

    sessionTopics.value.forEach((session) => {
      session.topics.forEach((topic) => {
        enqueueTopic({
          sessionName: session.sessionName,
          topicName: topic.topicName,
        })
      })
    })

    return jobs
  }

  const findTopicPlanEntry = (topicName: string) => {
    const targetKey = normalizePlanNameKey(topicName)
    if (!targetKey.length) {
      return null
    }

    for (const session of sessionTopics.value) {
      const topic = session.topics.find(
        (entry) => normalizePlanNameKey(entry.topicName) === targetKey,
      )
      if (topic) {
        return {
          sessionName: session.sessionName,
          topicName: topic.topicName,
        }
      }
    }

    return null
  }

  const ensureTopicSubtopic = (
    topicName: string,
    input: {
      name: string
      brief?: string
      miTechnique?: string
      prompt?: string
    },
    options: {
      sessionName?: string
      afterSubtopicName?: string
    } = {},
  ) => {
    const normalizedTopicName = typeof topicName === 'string' ? topicName.trim() : ''
    const summary = normalizeSubtopicSummaryInput(input)
    if (!normalizedTopicName.length || !summary) {
      return false
    }

    const planEntry = findTopicPlanEntry(normalizedTopicName)
    const resolvedTopicName = planEntry?.topicName ?? normalizedTopicName
    const resolvedSessionName =
      (typeof options.sessionName === 'string' ? options.sessionName.trim() : '') ||
      planEntry?.sessionName ||
      ''

    let changed = false

    if (api1Result.value) {
      const existingAllTopics = normalizeTopicList(
        api1Result.value.all_topics?.[resolvedTopicName] ?? api1Result.value.all_topics?.[normalizedTopicName],
      )
      const nextAllTopics = upsertSubtopicSummaryList(existingAllTopics, summary, {
        afterSubtopicName: options.afterSubtopicName,
      })

      let nextSessionsTopics = api1Result.value.sessions_topics ?? {}
      if (resolvedSessionName) {
        const existingSessionList = normalizeTopicList(
          api1Result.value.sessions_topics?.[resolvedSessionName]?.[resolvedTopicName],
        )
        const nextSessionList = upsertSubtopicSummaryList(existingSessionList, summary, {
          afterSubtopicName: options.afterSubtopicName,
        })
        changed = changed || nextSessionList.changed
        nextSessionsTopics = {
          ...api1Result.value.sessions_topics,
          [resolvedSessionName]: {
            ...api1Result.value.sessions_topics?.[resolvedSessionName],
            [resolvedTopicName]: nextSessionList.next,
          },
        }
      }

      changed = changed || nextAllTopics.changed
      api1Result.value = {
        ...api1Result.value,
        all_topics: {
          ...api1Result.value.all_topics,
          [resolvedTopicName]: nextAllTopics.next,
        },
        sessions_topics: nextSessionsTopics,
      }
    }

    if (resolvedSessionName) {
      sessionTopics.value = sessionTopics.value.map((session) => {
        if (normalizePlanNameKey(session.sessionName) !== normalizePlanNameKey(resolvedSessionName)) {
          return session
        }

        return {
          ...session,
          topics: session.topics.map((topic) => {
            if (normalizePlanNameKey(topic.topicName) !== normalizePlanNameKey(resolvedTopicName)) {
              return topic
            }
            const nextList = upsertSubtopicSummaryList(topic.list, summary, {
              afterSubtopicName: options.afterSubtopicName,
            })
            changed = changed || nextList.changed
            return {
              ...topic,
              list: nextList.next,
            }
          }),
        }
      })
    }

    return changed
  }

  const upsertManualTopicPlan = (input: {
    sessionName?: string
    topicName: string
    originalTopicName?: string
    topicPrompt?: string
    subtopics: Array<{
      name: string
      brief?: string
      miTechnique?: string
      prompt?: string
    }>
  }) => {
    const topicName = typeof input.topicName === 'string' ? input.topicName.trim() : ''
    const originalTopicName =
      typeof input.originalTopicName === 'string' && input.originalTopicName.trim().length
        ? input.originalTopicName.trim()
        : topicName

    if (!topicName.length) {
      throw new Error('Topic name is required.')
    }

    const subtopics = input.subtopics
      .map((entry) => normalizeSubtopicSummaryInput(entry))
      .filter((entry): entry is SubtopicSummary => Boolean(entry))

    if (!subtopics.length) {
      throw new Error('Please add at least one subtopic.')
    }

    const resolvedSessionName = initializeManualAuthoringPlan(input.sessionName)
    const topicKey = normalizePlanNameKey(topicName)
    const originalTopicKey = normalizePlanNameKey(originalTopicName)
    const topicPrompt = sanitizeOptionalPrompt(input.topicPrompt)

    let changed = false

    sessionTopics.value = sessionTopics.value.map((session) => {
      if (normalizePlanNameKey(session.sessionName) !== normalizePlanNameKey(resolvedSessionName)) {
        return session
      }

      const existingIndex = session.topics.findIndex(
        (topic) => normalizePlanNameKey(topic.topicName) === originalTopicKey,
      )

      const nextTopic = {
        topicName,
        list: subtopics,
        ...(topicPrompt ? { topicPrompt } : {}),
      }

      if (existingIndex === -1) {
        changed = true
        return {
          ...session,
          topics: [...session.topics, nextTopic],
        }
      }

      const nextTopics = [...session.topics]
      const previous = nextTopics[existingIndex]
      nextTopics.splice(existingIndex, 1, nextTopic)
      changed =
        changed ||
        previous.topicName !== nextTopic.topicName ||
        JSON.stringify(previous.list) !== JSON.stringify(nextTopic.list) ||
        (previous.topicPrompt ?? '') !== (nextTopic.topicPrompt ?? '')

      return {
        ...session,
        topics: nextTopics,
      }
    })

    const nextAllTopics = { ...api1Result.value?.all_topics }
    if (originalTopicKey !== topicKey) {
      Object.keys(nextAllTopics).forEach((entry) => {
        if (normalizePlanNameKey(entry) === originalTopicKey) {
          delete nextAllTopics[entry]
        }
      })
    }
    nextAllTopics[topicName] = subtopics

    const nextSessionsTopics = {
      ...api1Result.value?.sessions_topics,
      [resolvedSessionName]: {
        ...api1Result.value?.sessions_topics?.[resolvedSessionName],
      },
    }
    if (originalTopicKey !== topicKey) {
      Object.keys(nextSessionsTopics[resolvedSessionName]).forEach((entry) => {
        if (normalizePlanNameKey(entry) === originalTopicKey) {
          delete nextSessionsTopics[resolvedSessionName][entry]
        }
      })
    }
    nextSessionsTopics[resolvedSessionName][topicName] = subtopics

    const nextRouting = normalizeTopicRouting(
      originalTopicKey !== topicKey
        ? renameTopicRoutingReferences(getResolvedTopicRoutingPlan(), originalTopicName, topicName)
        : getResolvedTopicRoutingPlan(),
      buildOrderedPlanTopicNames(nextAllTopics, nextSessionsTopics),
    )

    api1Result.value = {
      ...(api1Result.value ?? buildEmptyPlanResult()),
      all_topics: nextAllTopics,
      sessions_topics: nextSessionsTopics,
      topic_routing: nextRouting,
    }

    lastApi1Res.value = buildPlanPreviousResponse()
    lastApi1Fingerprint.value = buildApi1Fingerprint(convertContent.value)
    return {
      changed,
      sessionName: resolvedSessionName,
      topicName,
    }
  }

  const deleteManualTopicPlan = (
    topicName: string,
    options: {
      sessionName?: string
    } = {},
  ) => {
    const normalizedTopicName = typeof topicName === 'string' ? topicName.trim() : ''
    const topicKey = normalizePlanNameKey(normalizedTopicName)
    if (!topicKey.length) {
      return false
    }

    const planEntry = findTopicPlanEntry(normalizedTopicName)
    const resolvedSessionName =
      (typeof options.sessionName === 'string' ? options.sessionName.trim() : '') ||
      planEntry?.sessionName ||
      DEFAULT_MANUAL_SESSION_NAME

    let changed = false
    sessionTopics.value = sessionTopics.value
      .map((session) => {
        if (normalizePlanNameKey(session.sessionName) !== normalizePlanNameKey(resolvedSessionName)) {
          return session
        }
        const nextTopics = session.topics.filter(
          (topic) => normalizePlanNameKey(topic.topicName) !== topicKey,
        )
        changed = changed || nextTopics.length !== session.topics.length
        return {
          ...session,
          topics: nextTopics,
        }
      })
      .filter((session) => session.topics.length > 0)

    if (!api1Result.value) {
      return changed
    }

    const nextAllTopics = Object.fromEntries(
      Object.entries(api1Result.value.all_topics ?? {}).filter(
        ([entry]) => normalizePlanNameKey(entry) !== topicKey,
      ),
    )

    const nextSessionsTopics = Object.entries(api1Result.value.sessions_topics ?? {}).reduce(
      (acc, [sessionName, topics]) => {
        const filtered = Object.fromEntries(
          Object.entries(topics ?? {}).filter(([entry]) => normalizePlanNameKey(entry) !== topicKey),
        )
        if (Object.keys(filtered).length) {
          acc[sessionName] = filtered
        }
        return acc
      },
      {} as Record<string, Record<string, Array<string | SubtopicSummary>>>,
    )

    api1Result.value = {
      ...api1Result.value,
      all_topics: nextAllTopics,
      sessions_topics: nextSessionsTopics,
      topic_routing: normalizeTopicRouting(
        api1Result.value.topic_routing ?? null,
        buildOrderedPlanTopicNames(nextAllTopics, nextSessionsTopics),
      ),
    }

    lastApi1Res.value = buildPlanPreviousResponse()
    lastApi1Fingerprint.value = buildApi1Fingerprint(convertContent.value)
    return true
  }

  const ensureTopicJob = (topicName: string): TopicJob => {
    const planEntry = findTopicPlanEntry(topicName)
    if (!planEntry) {
      throw new Error(`Topic "${topicName}" is missing from the current plan.`)
    }

    const identifier = `${planEntry.sessionName}::${planEntry.topicName}`
    const existing =
      generationQueue.value.find((entry) => entry.id === identifier) ??
      generationQueue.value.find(
        (entry) =>
          normalizePlanNameKey(entry.topicName) === normalizePlanNameKey(planEntry.topicName) &&
          normalizePlanNameKey(entry.sessionName) === normalizePlanNameKey(planEntry.sessionName),
      )

    if (existing) {
      existing.id = identifier
      existing.topicName = planEntry.topicName
      existing.sessionName = planEntry.sessionName
      return existing
    }

    const job: TopicJob = {
      id: identifier,
      topicName: planEntry.topicName,
      sessionName: planEntry.sessionName,
      attempt: 0,
      status: 'pending',
      warnings: [],
    }

    generationQueue.value = [...generationQueue.value, job]
    return job
  }

  const recordTopicIssues = (topicName: string, entries: DialogueParseIssue[]) => {
    if (!entries.length) {
      topicIssues.value.delete(topicName)
      return
    }

    topicIssues.value.set(topicName, entries)
  }

  const ensureTopicGraphFromScript = (topicName: string, script: string | undefined) => {
    if (!script) {
      return false
    }

    const parseResult = formatGeneticCounseling(script)
    const parsedStages = parseResult.topics.get(topicName) ?? []
    const stages = withDefaultStateMetadata(topicName, parsedStages)
    if (!stages.length) {
      return false
    }

    const transformed = transform2AntvJson(new Map([[topicName, stages]]))
    const cells = normalizeTopicGraphCells(transformed.get(topicName) ?? [])
    topicGraph.value.set(topicName, cells)

    const issues = parseResult.issues.filter((issue) => (!issue.topic || issue.topic === topicName))
    recordTopicIssues(topicName, issues)
    return true
  }

  const hydrateTopicGraphsFromScripts = (options: { overwrite?: boolean } = {}) => {
    const overwrite = options.overwrite ?? false

    topicScripts.value.forEach((script, topicName) => {
      if (typeof script !== 'string' || !script.trim().length) {
        return
      }
      if (!overwrite && topicGraph.value.has(topicName)) {
        return
      }
      ensureTopicGraphFromScript(topicName, script)
    })
  }

  const flushAllTopicGraphs = () => {
    const topicsToVisit = new Set<string>()
    generationQueue.value.forEach((job) => topicsToVisit.add(job.topicName))
    topicScripts.value.forEach((_, name) => topicsToVisit.add(name))
    topicGraph.value.forEach((_, name) => topicsToVisit.add(name))

    hydrateTopicGraphsFromScripts()

    topicsToVisit.forEach((topicName) => {
      if (topicGraph.value.has(topicName)) {
        return
      }
      const script = topicScripts.value.get(topicName)
      ensureTopicGraphFromScript(topicName, script)
    })
  }

  const importDialogueFromScript = (
    raw: string,
    options?: { sourceName?: string },
  ): ImportedTopicSummary[] => {
    const cleaned = (raw ?? '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
    if (!cleaned.length) {
      throw new Error('The selected file is empty.')
    }

    const fallbackTopicName =
      options?.sourceName?.replace(/\.[^/.]+$/, '')?.trim() || 'Imported Topic'
    const scriptWithHeader = /^\s*\/\//.test(cleaned)
      ? cleaned.replace(/^\/\/[^\n]*/, `//${fallbackTopicName}`)
      : `//${fallbackTopicName}\n${cleaned}`

    const parserInput = scriptWithHeader.replace(/\n\/\//g, '\n //')
    const parseResult = formatGeneticCounseling(parserInput)
    const rawStages =
      parseResult.topics.get(fallbackTopicName) ?? Array.from(parseResult.topics.values())[0]
    const stages = withDefaultStateMetadata(fallbackTopicName, rawStages ?? [])

    if (!stages || !stages.length) {
      const blockingIssue =
        parseResult.issues.find(
          (issue) => (!issue.topic || issue.topic === fallbackTopicName) && issue.level === 'error',
        ) ?? parseResult.issues.find((issue) => issue.level === 'error')
      if (blockingIssue) {
        throw new Error(blockingIssue.message)
      }
      throw new Error('No valid states were found in this file.')
    }

    topicScripts.value = new Map([[fallbackTopicName, scriptWithHeader]])
    stateContent.value = scriptWithHeader

    topicGraph.value = transform2AntvJson(new Map([[fallbackTopicName, stages]]))
    topicGraphSelected.value = fallbackTopicName

    if (graph.value) {
      const cells = normalizeTopicGraphCells(topicGraph.value.get(fallbackTopicName))
      topicGraph.value.set(fallbackTopicName, cells)
      replaceGraphCells(cells as any)
    }

    topicIssues.value.clear()
    const warningIssues = parseResult.issues.filter(
      (issue) => !issue.topic || issue.topic === fallbackTopicName,
    )
    recordTopicIssues(fallbackTopicName, warningIssues)

    generationQueue.value = []
    generationBatchId.value = null
    generationActiveTopicId.value = null
    generationCancelled.value = false
    generationProcessing.value = false

    return [
      {
        name: fallbackTopicName,
        stageNames: stages.map((stage) => stage.stageName),
      },
    ]
  }

  const buildGenerationFingerprint = () => {
    try {
      const topicKeys = Array.from(topicScripts.value.keys()).sort()
      const promptSnapshot = sessionTopics.value.map((session) => ({
        sessionName: session.sessionName,
        topics: session.topics.map((topic) => ({
          topicName: topic.topicName,
          topicPrompt: topic.topicPrompt ?? '',
          subtopics: topic.list.map((subtopic) => ({
            name: subtopic.name,
            prompt: subtopic.prompt ?? '',
          })),
        })),
      }))
      return JSON.stringify({
        version: GENERATION_FINGERPRINT_VERSION,
        convert: convertContent.value,
        mentor: mentorDirections.value,
        topics: topicKeys,
        prompts: promptSnapshot,
      })
    } catch {
      return `${GENERATION_FINGERPRINT_VERSION}:${convertContent.value.length}:${mentorDirections.value.length}:${sessionTopics.value.length}:${topicScripts.value.size}`
    }
  }

  const clearGenerationState = () => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(buildUserScopedKey(GENERATION_STORAGE_KEY))
    window.localStorage.removeItem(buildUserScopedKey(GENERATION_FINGERPRINT_KEY))
  }

  const persistGenerationState = () => {
    if (typeof window === 'undefined') {
      return
    }

    if (authoringMode.value !== AuthoringMode.AI) {
      clearGenerationState()
      return
    }

    const hasWorkToPersist =
      generationQueue.value.length > 0 ||
      topicScripts.value.size > 0 ||
      topicGraph.value.size > 0 ||
      stateContent.value.trim().length > 0
    if (!hasWorkToPersist) {
      clearGenerationState()
      return
    }

    try {
      const snapshot = buildGenerationStateSnapshot()
      if (!snapshot) {
        clearGenerationState()
        return
      }

      const payload = {
        ...snapshot,
        timestamp: Date.now(),
      }

      window.localStorage.setItem(
        buildUserScopedKey(GENERATION_STORAGE_KEY),
        JSON.stringify(payload),
      )
      window.localStorage.setItem(
        buildUserScopedKey(GENERATION_FINGERPRINT_KEY),
        buildGenerationFingerprint(),
      )
    } catch (error) {
      console.error('Failed to persist generation state', error)
    }
  }

  const restoreGenerationState = () => {
    if (typeof window === 'undefined') {
      return false
    }

    const raw = window.localStorage.getItem(buildUserScopedKey(GENERATION_STORAGE_KEY))
    if (!raw) {
      return false
    }

    const storedFingerprint = window.localStorage.getItem(
      buildUserScopedKey(GENERATION_FINGERPRINT_KEY),
    )
    const currentFingerprint = buildGenerationFingerprint()
    if (storedFingerprint && storedFingerprint !== currentFingerprint) {
      clearGenerationState()
      return false
    }

    try {
      const parsed = JSON.parse(raw) as {
        batchId?: string | null
        cancelled?: boolean
        activeTopicId?: string | null
        queue?: Array<TopicJob & { warnings?: DialogueParseIssue[] }>
        scripts?: Array<[string, string]>
        issues?: Array<[string, DialogueParseIssue[]]>
        topicGraph?: Array<[string, Cell.Properties[]]>
        stateContent?: string
        fingerprintVersion?: string
      }

      if (!Array.isArray(parsed.queue) || !parsed.queue.length) {
        clearGenerationState()
        return false
      }

      const parsedFingerprintVersion = parsed.fingerprintVersion ?? '1'
      if (parsedFingerprintVersion !== GENERATION_FINGERPRINT_VERSION) {
        clearGenerationState()
        return false
      }
      applyGenerationStateSnapshot(parsed)
      persistGenerationState()

      return true
    } catch (error) {
      console.error('Failed to restore generation state', error)
      clearGenerationState()
      return false
    }
  }

  const clearTopicArtifacts = (topicName: string) => {
    topicScripts.value.delete(topicName)
    topicGraph.value.delete(topicName)
    recordTopicIssues(topicName, [])
    if (topicGraphSelected.value === topicName) {
      topicGraphSelected.value = null
      clearGraphView()
    }
  }

  const hasActiveJobs = () =>
    generationQueue.value.some(
      (entry) => entry.status === 'pending' || entry.status === 'running',
    )

  const ensureGenerationBatch = () => {
    if (!generationBatchId.value) {
      generationBatchId.value = `${Date.now()}`
    }
  }

  const rebuildStateContent = () => {
    const sections: string[] = []
    generationQueue.value.forEach((job) => {
      if (job.status !== 'success') {
        return
      }

      const script = topicScripts.value.get(job.topicName)
      if (!script) {
        return
      }

      const normalized = script.replace(/\r\n/g, '\n').trim()
      if (!normalized.length) {
        return
      }

      const header = `//${job.topicName}`
      sections.push(normalized.startsWith(header) ? normalized : `${header}\n${normalized}`)
    })

    stateContent.value = sections.join('\n\n')
  }

  const sanitizeTopicResponse = (raw: string, topicName: string) => {
    const normalized = raw.replace(/\r\n/g, '\n')
    const codeMatch = normalized.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/)
    const content = (codeMatch && codeMatch[1] ? codeMatch[1] : normalized).trim()
    if (!content.length) {
      return `//${topicName}`
    }
    return content.startsWith(`//${topicName}`) ? content : `//${topicName}\n${content}`
  }

  const normalizeTopicLookupKey = (value: string) =>
    String(value || '')
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '')

  const resolveParsedTopicStages = (
    parsedTopics: Map<string, StageNode[]>,
    expectedTopicName: string,
  ): StageNode[] | null => {
    const direct = parsedTopics.get(expectedTopicName)
    if (direct && direct.length) {
      return direct
    }

    const expectedKey = normalizeTopicLookupKey(expectedTopicName)
    if (expectedKey) {
      for (const [parsedTopicName, parsedStages] of parsedTopics.entries()) {
        if (normalizeTopicLookupKey(parsedTopicName) === expectedKey && parsedStages.length) {
          return parsedStages
        }
      }
    }

    if (parsedTopics.size === 1) {
      const onlyTopic = parsedTopics.values().next().value as StageNode[] | undefined
      if (onlyTopic && onlyTopic.length) {
        return onlyTopic
      }
    }

    return null
  }

  type TopicGenerationSuccess = {
    script: string
    stages: StageNode[]
    warnings: DialogueParseIssue[]
  }

  const buildTopicMentorDirections = (
    job: Pick<TopicJob, 'sessionName' | 'topicName'>,
    mentor: string,
  ) => {
    const sections: string[] = []
    const globalMentor = typeof mentor === 'string' ? mentor.trim() : ''
    if (globalMentor.length) {
      sections.push(globalMentor)
    }

    const session = sessionTopics.value.find(
      (entry) => normalizePlanNameKey(entry.sessionName) === normalizePlanNameKey(job.sessionName),
    )
    const topic = session?.topics.find(
      (entry) => normalizePlanNameKey(entry.topicName) === normalizePlanNameKey(job.topicName),
    )

    const topicPrompt = sanitizeOptionalPrompt(topic?.topicPrompt)
    if (topicPrompt) {
      sections.push(`Topic-specific prompt for "${job.topicName}":\n${topicPrompt}`)
    }

    const subtopicPromptLines =
      topic?.list
        .map((subtopic) => {
          const prompt = sanitizeOptionalPrompt(subtopic.prompt)
          if (!prompt) {
            return ''
          }
          return `- ${subtopic.name}: ${prompt}`
        })
        .filter((entry) => entry.length > 0) ?? []

    if (subtopicPromptLines.length) {
      sections.push(
        `Subtopic-specific prompts for "${job.topicName}":\n${subtopicPromptLines.join('\n')}`,
      )
    }

    return sections.join('\n\n').trim()
  }

  const generateTopicDialogue = async (
    job: TopicJob,
    mentor: string,
  ): Promise<TopicGenerationSuccess> => {
    const topicName = job.topicName
    const sessionsTopics = api1Result.value?.sessions_topics ?? {}
    const sessionRecord = sessionsTopics[job.sessionName]
    if (!sessionRecord) {
      throw new Error(`Session "${job.sessionName}" is missing from the plan.`)
    }

    const topicStructure = sessionRecord[topicName]
    if (!topicStructure) {
      throw new Error(`Topic "${topicName}" is missing from session "${job.sessionName}".`)
    }

    const topicSummary = api1Result.value?.all_topics?.[topicName] ?? []
    const topicMentorDirections = buildTopicMentorDirections(job, mentor)
    const topicRouteContext = buildTopicRouteContextPayload(topicName)

    let response
    try {
      response = await requestAiTask<{ script?: string }>({
        taskTag: 'topic.generate',
        sessionId: buildAiSessionId(),
        topicId: topicName,
        input: {
          sourceContent: convertContent.value,
          authoringContext: buildAuthoringContext(),
          topicName,
          sessionName: job.sessionName,
          topicSummary,
          topicStructure,
          mentorDirections: topicMentorDirections,
          topicRouteContext,
        },
        trace: {
          clientVersion: 'web-2026.02',
        },
      })
    } catch (error) {
      const payload = parseAiTaskError(error, `Failed to generate topic "${topicName}".`)
      throw new Error(payload.detail ? `${payload.message} (${payload.detail})` : payload.message)
    }

    lastApi2Res.value = response

    const rawScript = typeof response.output?.script === 'string' ? response.output.script : ''
    if (!rawScript.trim()) {
      throw new Error('Model response was empty.')
    }

    const script = sanitizeTopicResponse(rawScript, topicName)
    const parseResult = formatGeneticCounseling(script)
    const resolvedStages = resolveParsedTopicStages(parseResult.topics, topicName) ?? []
    const stages = withDefaultStateMetadata(topicName, resolvedStages)
    if (!stages.length) {
      const blockingIssue =
        parseResult.issues.find((issue) => issue.topic === topicName && issue.level === 'error') ??
        parseResult.issues.find((issue) => issue.level === 'error')
      if (blockingIssue) {
        throw new Error(blockingIssue.message)
      }
      throw new Error(`Parsed output did not contain the topic "${topicName}".`)
    }

    const blockingIssues = parseResult.issues.filter(
      (issue) => (!issue.topic || issue.topic === topicName) && issue.level === 'error',
    )
    if (blockingIssues.length) {
      throw new Error(blockingIssues[0].message)
    }

    const warnings = parseResult.issues.filter(
      (issue) => (!issue.topic || issue.topic === topicName) && issue.level === 'warning',
    )

    return {
      script,
      stages,
      warnings,
    }
  }
  const processTopicQueue = async (
    mentor: string,
    options?: { jobIds?: string[] },
  ) => {
    if (generationProcessing.value) {
      return
    }

    const allowedJobIds = options?.jobIds ? new Set(options.jobIds) : null

    generationProcessing.value = true
    try {
      for (const job of generationQueue.value) {
        if (generationCancelled.value) {
          break
        }

        if (allowedJobIds && !allowedJobIds.has(job.id)) {
          continue
        }

        if (job.status !== 'pending') {
          continue
        }

        queryTopicStrucLoading.value = true
        job.status = 'running'
        job.error = undefined
        job.startedAt = Date.now()
        job.finishedAt = undefined
        job.attempt += 1
        generationActiveTopicId.value = job.id
        recordAnalyticsEvent('topic_generate_requested', 'ai', {
          topicName: job.topicName,
          meta: {
            sessionName: job.sessionName,
            attempt: job.attempt,
          },
        })

        try {
          const result = await generateTopicDialogue(job, mentor)
          topicScripts.value.set(job.topicName, result.script)
          recordTopicIssues(job.topicName, result.warnings)
          job.warnings = result.warnings
          const transformed = transform2AntvJson(new Map([[job.topicName, result.stages]]))
          topicGraph.value.set(
            job.topicName,
            normalizeTopicGraphCells(transformed.get(job.topicName) ?? []),
          )
          job.status = 'success'
          job.finishedAt = Date.now()
          captureTopicAnalyticsBaselineIfMissing(
            job.topicName,
            normalizeTopicGraphCells(transformed.get(job.topicName) ?? []),
          )
          recordAnalyticsEvent('topic_generated', 'ai', {
            topicName: job.topicName,
            durationMs:
              typeof job.startedAt === 'number' && typeof job.finishedAt === 'number'
                ? Math.max(0, job.finishedAt - job.startedAt)
                : undefined,
            meta: {
              attempt: job.attempt,
              warningCount: result.warnings.length,
            },
          })

          if (!topicGraphSelected.value) {
            selectGraphTopic(job.topicName)
          } else if (topicGraphSelected.value === job.topicName) {
            const cells = normalizeTopicGraphCells(topicGraph.value.get(job.topicName))
            if (cells) {
              topicGraph.value.set(job.topicName, cells)
              replaceGraphCells(cells)
            }
          }

          rebuildStateContent()
        } catch (error) {
          job.status = 'failed'
          job.finishedAt = Date.now()
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
              ? error
              : 'Topic generation failed.'
          job.error = message
          recordAnalyticsEvent('topic_generation_failed', 'ai', {
            topicName: job.topicName,
            durationMs:
              typeof job.startedAt === 'number' && typeof job.finishedAt === 'number'
                ? Math.max(0, job.finishedAt - job.startedAt)
                : undefined,
            meta: {
              attempt: job.attempt,
              message,
            },
          })
          msgSrv.error(message)
          job.warnings = []
          clearTopicArtifacts(job.topicName)
          rebuildStateContent()
        } finally {
          generationActiveTopicId.value = null
          persistGenerationState()
        }
      }
    } finally {
      generationProcessing.value = false
      const stillRunning = hasActiveJobs()
      queryTopicStrucLoading.value = stillRunning
      if (!stillRunning && !generationCancelled.value) {
        rebuildStateContent()
      }
      persistGenerationState()
    }
  }

  const cancelTopicGeneration = () => {
    if (!generationQueue.value.length) {
      return
    }

    generationCancelled.value = true
    queryTopicStrucLoading.value = false
    generationActiveTopicId.value = null
    generationProcessing.value = false

    generationQueue.value.forEach((job) => {
      if (job.status === 'running') {
        job.status = 'cancelled'
        job.finishedAt = Date.now()
        job.error = 'Generation cancelled by user.'
        job.warnings = []
      }
    })
    persistGenerationState()
  }

  const queryTopicStructure = async (mentor: string = '') => {
    mentorDirections.value = mentor
    topicGraph.value.clear()
    topicScripts.value.clear()
    topicIssues.value.clear()
    topicGraphSelected.value = null
    clearGraphView()
    stateContent.value = ''
    generationQueue.value = []
    generationCancelled.value = false
    generationBatchId.value = `${Date.now()}`
    lastApi2Res.value = null
    clearGenerationState()

    const jobs = buildTopicJobs()
    generationQueue.value = jobs
    persistGenerationState()

    if (!jobs.length) {
      stateContent.value = ''
      queryTopicStrucLoading.value = false
      return
    }

    queryTopicStrucLoading.value = true

    try {
      await processTopicQueue(mentor)
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const prepareTopicGeneration = (mentor: string = '') => {
    mentorDirections.value = mentor
    topicGraph.value.clear()
    topicScripts.value.clear()
    topicIssues.value.clear()
    topicGraphSelected.value = null
    clearGraphView()
    stateContent.value = ''
    generationQueue.value = []
    generationCancelled.value = false
    generationBatchId.value = `${Date.now()}`
    generationActiveTopicId.value = null
    generationProcessing.value = false
    queryTopicStrucLoading.value = false
    lastApi2Res.value = null
    clearGenerationState()

    const jobs = buildTopicJobs()
    generationQueue.value = jobs
    persistGenerationState()

    if (!jobs.length) {
      generationBatchId.value = null
    }
  }

  const startGeneration = async (mentor: string = '') => {
    await queryTopicStructure(mentor)
  }

  const processNextTopic = async (mentor: string = '') => {
    const nextJob = generationQueue.value.find((job) => job.status === 'pending')
    if (!nextJob) {
      return
    }

    generationCancelled.value = false
    ensureGenerationBatch()
    persistGenerationState()
    queryTopicStrucLoading.value = true

    try {
      await processTopicQueue(mentor, { jobIds: [nextJob.id] })
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const resumeTopicGeneration = async (mentor: string = '') => {
    const hasWork = generationQueue.value.some(
      (job) => job.status === 'pending' || job.status === 'cancelled',
    )
    if (!hasWork) {
      return
    }

    generationQueue.value.forEach((job) => {
      if (job.status === 'cancelled') {
        job.status = 'pending'
        job.error = undefined
        job.startedAt = undefined
        job.finishedAt = undefined
        job.warnings = []
      }
    })

    persistGenerationState()

    generationCancelled.value = false
    ensureGenerationBatch()
    queryTopicStrucLoading.value = true

    try {
      await processTopicQueue(mentor)
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const retryTopic = async (topicName: string, mentor: string = '') => {
    const job = ensureTopicJob(topicName)
    recordAnalyticsEvent('topic_regenerate_requested', 'manual', {
      topicName: job.topicName,
      meta: {
        sessionName: job.sessionName,
      },
    })

    ;[topicName, job.topicName].forEach((name) => {
      if (typeof name === 'string' && name.trim().length) {
        clearTopicArtifacts(name)
      }
    })
    job.status = 'pending'
    job.error = undefined
    job.startedAt = undefined
    job.finishedAt = undefined
    job.warnings = []

    persistGenerationState()

    generationCancelled.value = false
    ensureGenerationBatch()
    queryTopicStrucLoading.value = true

    try {
      await processTopicQueue(mentor, { jobIds: [job.id] })
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const regenerateTopic = async (topicName: string, mentor: string = '') => {
    await retryTopic(topicName, mentor)
  }

  const querySuggestOptions = async (
    request: {
      mentorDirections?: string
      topicName?: string
      stateName?: string
      subtopic?: string
      miTechnique?: string
      currentAgent?: string
      currentTopicScript?: string
      topicSummary?: Array<string | SubtopicSummary>
      topicStructure?: Array<string | SubtopicSummary>
    } = {},
  ) => {
    querySuggestOptionsLoading.value = true
    setNewSuggestOptionAgents({})
    setNewSuggestOptionStateDrafts({})

    const topicList = stateContent.value.split(/(?=\n\/\/)/g).map((e) => e.replace(/^\n/, ''))
    const topicName =
      typeof request.topicName === 'string' && request.topicName.trim().length > 0
        ? request.topicName.trim()
        : (topicGraphSelected.value ?? '').trim()
    const stateName =
      typeof request.stateName === 'string' && request.stateName.trim().length > 0
        ? request.stateName.trim()
        : (querySuggestOptionStageName.value ?? '').trim()
    const mentorDirectionsText =
      typeof request.mentorDirections === 'string' ? request.mentorDirections : mentorDirections.value
    const curTopic =
      typeof request.currentTopicScript === 'string' && request.currentTopicScript.trim().length > 0
        ? request.currentTopicScript
        : topicList.find((e) => e.startsWith(`//${topicName}`)) ?? ''
    const planEntry = findTopicPlanEntry(topicName)
    const resolvedTopicName = planEntry?.topicName ?? topicName
    const resolvedSessionName = planEntry?.sessionName ?? ''
    const topicSummary =
      request.topicSummary ??
      api1Result.value?.all_topics?.[resolvedTopicName] ??
      api1Result.value?.all_topics?.[topicName] ??
      []
    const topicStructure =
      request.topicStructure ??
      (resolvedSessionName
        ? api1Result.value?.sessions_topics?.[resolvedSessionName]?.[resolvedTopicName]
        : undefined) ??
      []
    try {
      recordAnalyticsEvent('suggest_options_requested', 'manual', {
        topicName,
        stateName,
        meta: {
          subtopic: request.subtopic ?? '',
          miTechnique: request.miTechnique ?? '',
        },
      })
      const response = await requestAiTask<{ content?: string }>({
        taskTag: 'state.menu_suggest',
        sessionId: buildAiSessionId(),
        topicId: topicName || undefined,
        input: {
          sourceContent: convertContent.value,
          authoringContext: buildAuthoringContext(),
          topicName,
          sessionName: resolvedSessionName,
          topicSummary,
          topicStructure,
          stateName,
          subtopic: request.subtopic ?? '',
          miTechnique: request.miTechnique ?? '',
          currentAgent: request.currentAgent ?? '',
          currentTopicScript: curTopic,
          mentorDirections: mentorDirectionsText,
        },
        trace: {
          clientVersion: 'web-2026.02',
        },
      })

      const content = typeof response.output?.content === 'string' ? response.output.content : ''
      const stateDrafts = parseSuggestionStateDrafts(content)
      const agents = parseSuggestionAgents(content)
      setNewSuggestOptionStateDrafts(stateDrafts)
      setNewSuggestOptionAgents(agents)
      const menus = content
        .split('\n')
        .filter((e) => {
          const normalized = e.toLocaleLowerCase().trim()
          return (
            normalized !== 'usermenu:' &&
            normalized !== '' &&
            !e.toLocaleUpperCase().trim().startsWith('"//') &&
            !normalized.startsWith('state:') &&
            !normalized.startsWith('subtopic:') &&
            !normalized.startsWith('subtopic_label:') &&
            !normalized.startsWith('mi_technique:') &&
            !normalized.startsWith('mi technique:') &&
            !normalized.startsWith('mi:') &&
            !normalized.startsWith('agent:') &&
            !normalized.startsWith('action:') &&
            !normalized.startsWith('"state:') &&
            !normalized.startsWith('"subtopic:') &&
            !normalized.startsWith('"subtopic_label:') &&
            !normalized.startsWith('"mi_technique:') &&
            !normalized.startsWith('"mi technique:') &&
            !normalized.startsWith('"mi:') &&
            !normalized.startsWith('"agent:') &&
            !normalized.startsWith('"action:') &&
            !normalized.startsWith('"usermenu:')
          )
        })
        .map((e) => e.trim())
      setNewSuggestOptions([...new Set(menus)])
    } catch (error) {
      setNewSuggestOptionStateDrafts({})
      setNewSuggestOptionAgents({})
      setNewSuggestOptions([])
      const payload = parseAiTaskError(error, 'Failed to suggest state options.')
      msgSrv.error(payload.detail ? `${payload.message} (${payload.detail})` : payload.message)
    } finally {
      querySuggestOptionsLoading.value = false
    }
  }

  const updateSelectedGraphTopic = () => {
    if (topicGraphSelected.value) {
      topicGraph.value.set(
        topicGraphSelected.value,
        normalizeTopicGraphCells(graph.value?.toJSON().cells as Cell.Properties[] | undefined),
      )
    }
  }

  const selectGraphTopic = (topicName: string) => {
    if (topicGraphSelected.value !== null && topicName !== topicGraphSelected.value) {
      topicGraph.value.set(
        topicGraphSelected.value,
        normalizeTopicGraphCells(graph.value?.toJSON().cells as Cell.Properties[] | undefined),
      )
    }

    topicGraphSelected.value = topicName

    const cells = normalizeTopicGraphCells(topicGraph.value.get(topicGraphSelected.value))
    topicGraph.value.set(topicGraphSelected.value, cells)
    replaceGraphCells(cells)
  }

  const createTopicGraph = (topicName: string) => {
    const normalized = topicName.trim()
    if (!normalized) return false
    if (!topicGraph.value.has(normalized)) {
      topicGraph.value.set(normalized, [] as Cell.Properties[])
    }
    selectGraphTopic(normalized)
    return true
  }

  const removeTopicGraph = (topicName: string) => {
    if (!topicGraph.value.has(topicName)) return
    topicGraph.value.delete(topicName)
    if (topicGraphSelected.value === topicName) {
      topicGraphSelected.value = null
      clearGraphCellsSafely()
    }
  }

  const updateConvertContent = (val: string) => {
    convertContent.value = val
  }
  const updateGraph = (obj: any) => {
    graph.value = obj
  }

  const setQuerySuggestOptionStageName = (name: string) => {
    querySuggestOptionStageName.value = name
  }

  const setQuerySuggestOptionStageId = (id: string) => {
    querySuggestOptionStageId.value = id
  }

  const setNewOptionModalShow = (val: boolean) => {
    newOptionModalShow.value = val
  }

  const updateMentorDirections = (val: string) => {
    mentorDirections.value = val
  }

  const setNewSuggestOptions = (val: string[]) => {
    newSuggestOptions.value = val
  }

  const setNewSuggestOptionAgents = (val: Record<string, string>) => {
    newSuggestOptionAgents.value = val
  }

  const setNewSuggestOptionStateDrafts = (val: Record<string, SuggestedStateDraft>) => {
    newSuggestOptionStateDrafts.value = val
  }

  if (typeof window !== 'undefined') {
    try {
      const resetMarker = window.localStorage.getItem(STORAGE_RESET_MARKER_KEY)
      if (resetMarker !== STORAGE_RESET_VERSION) {
        Object.keys(window.localStorage).forEach((key) => {
          if (shouldClearUserStorageKey(key)) {
            window.localStorage.removeItem(key)
          }
        })
        window.localStorage.setItem(STORAGE_RESET_MARKER_KEY, STORAGE_RESET_VERSION)
      }

      const storedRegistry = window.localStorage.getItem(USER_REGISTRY_STORAGE_KEY)
      if (storedRegistry) {
        const parsedRegistry = JSON.parse(storedRegistry)
        if (Array.isArray(parsedRegistry)) {
          knownUserNames.value = parsedRegistry
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => normalizeUserName(entry))
            .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index)
        }
      }

      const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile) as { name?: string }
        if (parsed?.name && typeof parsed.name === 'string') {
          lastUsedUserName.value = normalizeUserName(parsed.name)
          if (
            lastUsedUserName.value.length &&
            !knownUserNames.value.some(
              (entry) => buildUserKeySuffix(entry) === buildUserKeySuffix(lastUsedUserName.value),
            )
          ) {
            knownUserNames.value = [...knownUserNames.value, lastUsedUserName.value]
            persistKnownUserNames()
          }
        }
      }
    } catch {
      // ignore bad profile data
    }
  }

  const saveWorkspaceToServer = async <TConvert = unknown>(options: {
    workspaceId?: string
    reason?: string
    createSnapshot?: boolean
    convertWorkspace?: TConvert | null
  } = {}) => {
    const normalizedUserName = normalizeUserName(userName.value)
    if (!userSessionReady.value || !normalizedUserName.length) {
      return { ok: false as const, skipped: true as const }
    }

    buildCurrentAnalyticsSummary(Date.now())

    const snapshot: DesignerServerWorkspaceSnapshot<TConvert> = {
      schemaVersion: SERVER_WORKSPACE_SCHEMA_VERSION,
      app: SERVER_WORKSPACE_APP_ID,
      userName: normalizedUserName,
      workspaceId: options.workspaceId?.trim() || 'default',
      savedAt: new Date().toISOString(),
      reason: options.reason?.trim() || 'save',
      userThread: buildUserThreadSnapshot(),
      generationState:
        authoringMode.value === AuthoringMode.AI ? buildGenerationStateSnapshot() : null,
      analyticsState: buildAnalyticsStateSnapshot(),
      convertWorkspace:
        options.convertWorkspace !== undefined
          ? options.convertWorkspace
          : ((cachedServerConvertWorkspace.value ?? null) as TConvert | null),
    }

    const response = await requestWorkspaceSave<TConvert>({
      userName: normalizedUserName,
      workspaceId: snapshot.workspaceId,
      snapshot,
      createSnapshot: Boolean(options.createSnapshot),
      reason: snapshot.reason,
    })

    cachedServerConvertWorkspace.value = snapshot.convertWorkspace ?? null

    return {
      ok: true as const,
      skipped: false as const,
      response,
      snapshot,
    }
  }

  const loadWorkspaceFromServer = async <TConvert = unknown>(options: {
    workspaceId?: string
  } = {}) => {
    const normalizedUserName = normalizeUserName(userName.value)
    if (!userSessionReady.value || !normalizedUserName.length) {
      return { ok: false as const, found: false as const, skipped: true as const, snapshot: null }
    }

    const response = await requestWorkspaceLoad<TConvert>({
      userName: normalizedUserName,
      workspaceId: options.workspaceId?.trim() || 'default',
    })

    const snapshot = response.snapshot as DesignerServerWorkspaceSnapshot<TConvert> | undefined
    if (!response.found || !snapshot) {
      return {
        ok: true as const,
        found: false as const,
        skipped: false as const,
        snapshot: null,
        response,
      }
    }

    applyUserThreadSnapshot(snapshot.userThread ?? null)
    applyGenerationStateSnapshot(snapshot.generationState ?? null)
    applyAnalyticsStateSnapshot(snapshot.analyticsState ?? null)
    cachedServerConvertWorkspace.value = snapshot.convertWorkspace ?? null
    persistAllUserScopedState()

    return {
      ok: true as const,
      found: true as const,
      skipped: false as const,
      snapshot,
      response,
    }
  }

  watch(
    () => ({
      step: step.value,
      type: type.value,
      authoringMode: authoringMode.value,
      convertContent: convertContent.value,
      newConvertContent: newConvertContent.value,
      convertFileContent: convertFileContent.value,
      stateContent: stateContent.value,
      authoringContext: { ...authoringContext.value },
      sessionTopics: sessionTopics.value,
      api1Result: api1Result.value,
    }),
    () => {
      persistUserThreadState()
    },
    { deep: true },
  )

  const updateUserName = (name: string) => switchUserSession(name)

  const restoreLastUserSession = () => {
    if (userSessionReady.value) {
      return null
    }

    const rememberedUser = normalizeUserName(lastUsedUserName.value)
    if (!rememberedUser.length) {
      return null
    }

    try {
      return switchUserSession(rememberedUser)
    } catch (error) {
      console.warn('Failed to restore last user session', error)
      return null
    }
  }

  return {
    userName,
    userSessionReady,
    lastUsedUserName,
    step,
    authoringMode,
    authoringContext,
    goalOptions,
    type,
    convertContent,
    newConvertContent,
    convertLoading,
    sessionTopics,
    graph,
    stateContent,
    updateGraph,
    updateAuthoringMode,
    updateAuthoringContext,
    buildAuthoringContext,
    updateStep,
    convert2topic,
    queryTopicStructure,
    queryTopicStrucLoading,
    topicGraphSelected,
    topicGraph,
    topicScripts,
    createTopicGraph,
    removeTopicGraph,
    selectGraphTopic,
    api1Result,
    updateConvertContent,
    setNewOptionModalShow,
    newOptionModalShow,
    querySuggestOptions,
    setQuerySuggestOptionStageName,
    mentorDirections,
    updateMentorDirections,
    setNewSuggestOptions,
    newSuggestOptions,
    setNewSuggestOptionAgents,
    newSuggestOptionAgents,
    setNewSuggestOptionStateDrafts,
    newSuggestOptionStateDrafts,
    querySuggestOptionsLoading,
    querySuggestOptionStageId,
    setQuerySuggestOptionStageId,
    restoreLastUserSession,
    updateSelectedGraphTopic,
    initializeManualAuthoringPlan,
    upsertManualTopicPlan,
    deleteManualTopicPlan,
    buildUserThreadSnapshot,
    applyUserThreadSnapshot,
    buildGenerationStateSnapshot,
    applyGenerationStateSnapshot,
    buildAnalyticsStateSnapshot,
    applyAnalyticsStateSnapshot,
    persistAllUserScopedState,
    saveWorkspaceToServer,
    loadWorkspaceFromServer,
    markNextConvertWorkspaceRestoreSkipped,
    consumeNextConvertWorkspaceRestoreSkipped,
    cancelTopicGeneration,
    topicIssues,
    generationQueue,
    generationBatchId,
    generationActiveTopicId,
    generationCancelled,
    generationProcessing,
    analyticsState,
    prepareTopicGeneration,
    startGeneration,
    processNextTopic,
    resumeTopicGeneration,
    retryTopic,
    regenerateTopic,
    flushAllTopicGraphs,
    restoreGenerationState,
    updateUserName,
    switchUserSession,
    buildUserScopedKey,
    restoreUserThreadState,
    importDialogueFromScript,
    recordAnalyticsEvent,
    buildCurrentAnalyticsSummary,
    setAnalyticsStateTextBaseline,
    setAnalyticsStateOptionTextsBaseline,
    updateTopicPrompt,
    updateSubtopicPrompt,
    updateTopicRoutingEntryTopic,
    updateTopicRoutingTransition,
    updateTopicRoutingNextTopics,
    updateTopicRoutingBranchLabel,
    ensureTopicSubtopic,
    regeneratePlanTopic,
    regeneratePlanSubtopic,
  }
})

