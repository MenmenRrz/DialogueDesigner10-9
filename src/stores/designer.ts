import { ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useAppStore } from './app'
import { createHttp } from '@/utils/http'
import { apiBaseURL } from '@/enums'
import { message as msgSrv } from 'ant-design-vue'
import { formatGeneticCounseling, type StageNodeMenu, type DialogueParseIssue, type StageNode } from '@/utils/formatGeneticCounseling'
import { transform2AntvJson } from '@/utils/transform2AntvJson'
import type { Cell, Graph } from '@antv/x6'
import OpenAI from 'openai'
import type { ChatCompletionSystemMessageParam } from 'openai/resources/index.mjs'

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
}

export type SessionTopic = {
  sessionName: string
  topics: Array<{
    topicName: string
    list: SubtopicSummary[]
  }>
}

export type Api1PlanResult = {
  all_topics: Record<string, Array<string | SubtopicSummary>>
  sessions_topics: Record<string, Record<string, Array<string | SubtopicSummary>>>
  [key: string]: unknown
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

const GENERATION_STORAGE_KEY = 'designer-generation-state'
const GENERATION_FINGERPRINT_KEY = 'designer-generation-fingerprint'
const GENERATION_FINGERPRINT_VERSION = '2'
const USER_PROFILE_STORAGE_KEY = 'designer-user-profile'

export const useDesignerStore = defineStore('designer', () => {
  const appStore = useAppStore()

  const { apiKey } = storeToRefs(appStore)

  const step = ref(0)
  const userName = ref('')
  const type = ref(ConvertType.TEXT)
  const convertContent = ref('')
  const newConvertContent = ref('')
  const convertFileContent = ref('')
  const convertLoading = ref(false)
  const sessionTopics = ref<SessionTopic[]>([])
  const queryTopicStrucLoading = ref(false)
  const api1Result = ref<Api1PlanResult | null>(null)
  const authoringContext = ref({
    goal: AuthoringGoal.EDUCATION,
    ageMin: null as number | null,
    ageMax: null as number | null,
    gender: '',
    persona: '',
  })

  const goalOptions = [
    { label: 'Education', value: AuthoringGoal.EDUCATION },
    { label: 'Persuasion', value: AuthoringGoal.PERSUASION },
    { label: 'Education & Persuasion', value: AuthoringGoal.BOTH },
  ]
  const graph = ref<Graph>()
  const stateContent = ref('')
  const topicGraph = ref<Map<string, Cell.Properties[]>>(new Map())
  const topicGraphSelected = ref<Nullable<string>>(null)
  const newOptionModalShow = ref(false)
  const querySuggestOptionsLoading = ref(false)
  const querySuggestOptionStageName = ref<Nullable<string>>(null)
  const mentorDirections = ref('')
  const newSuggestOptions = ref<string[]>([])
  const newSuggestOptionAgents = ref<Record<string, string>>({})
  const querySuggestOptionStageId = ref<Nullable<string>>(null)
  const lastApi1Res = ref<any>('')
  const lastApi2Res = ref<any>(null)
  const topicScripts = ref<Map<string, string>>(new Map())
  const generationQueue = ref<TopicJob[]>([])
  const generationBatchId = ref<string | null>(null)
  const generationActiveTopicId = ref<Nullable<string>>(null)
  const generationCancelled = ref(false)
  const topicIssues = ref<Map<string, DialogueParseIssue[]>>(new Map())
  const generationProcessing = ref(false)

  const updateStep = (val: number) => {
    step.value = val
  }

  const updateAuthoringContext = (patch: Partial<typeof authoringContext.value>) => {
    authoringContext.value = {
      ...authoringContext.value,
      ...patch,
    }
  }

  const normalizeTopicList = (value: unknown): SubtopicSummary[] => {
    const createSummary = (name: string, brief?: string, miTechnique?: string): SubtopicSummary => ({
      name: name.trim(),
      brief: typeof brief === 'string' ? brief.trim() : '',
      miTechnique: typeof miTechnique === 'string' ? miTechnique.trim() : '',
    })

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

      return createSummary(name, brief, miTechnique)
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

  const parseSuggestionAgents = (content: string): Record<string, string> => {
    const agents: Record<string, string> = {}
    const lines = content.split(/\r?\n/)
    let currentState: string | null = null
    let collectingAgent = false
    let agentLines: string[] = []

    const flushAgent = () => {
      if (collectingAgent && currentState) {
        const text = agentLines.join('\n').trim()
        if (text) {
          agents[currentState] = text
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

    return agents
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

  const convert2topic = async (desc: string, mentor: string = '') => {
    convertContent.value = desc
    convertLoading.value = true
    const http = createHttp(apiBaseURL.DEFAULT)
    const messages: ChatCompletionSystemMessageParam[] = [
      {
        role: 'system',
        content: `GUIDE FOR WRITING A DIALOGUE DELIVERED BY THE VIRTUAL COUNSELOR:
          """
          ${desc}
          """
          AUTHORING CONTEXT:
          """
          ${buildAuthoringContext()}
          """


          MENTOR DIRECTIONS:
          """
          ${mentor}
          """

          PREVIOUS RESPONSE:
          """
          ${lastApi1Res.value ? JSON.stringify(lastApi1Res.value) : ''}
          """

          TASK DESCRIPTION:
          """
          You are a dialogue planner designing a serious and supportive health conversation between a human user and an Embodied Conversational Agent (ECA) through the screen. The ECA is a warm, professional, 50-year-old woman trained in health counseling and Motivational Interviewing (MI) , with a lot of experience in patient education and conversation.

          This is the user's first time speaking to this virtual counselor. The agent must act like a human: warm, professional, and deeply respectful, not like a chatbot or script reader. The dialogue should unfold logically and flow naturally.

          The purpose of the conversation is to educate the user about cervical or breast cancer screening and gently motivate them to consider getting screened. The conversation must be:

          - Serious and focused — this is a health-critical topic
          - Grounded in safe, medically accurate content only (never speculate or improvise)
          - Non-coercive — the agent must support autonomy, not pressure the user
          - Relational — the agent should build trust, comfort, and working alliance


          YOUR TASK:
          Design a compact conversation plan with a small number of topics and clearly defined subtopics.

          STEP 1 — Define Topics
          Choose 3 to 4 topics maximum. These are the high-level parts of the conversation related to the counseling based on the  AUTHORING CONTEXT, such as:
          - “Introduce the cervical cancer”
          - “Explaining cervical screening”
          - “Discussing common concerns”
          - “Exploring next steps”

          Each topic should represent a functional chunk of the dialogue. Keep it tight — no fluff. Avoid generic labels like “Education” or “Barriers.”


          STEP 2 — Define Subtopics

          Each topic must contain at least 2 subtopics. Each subtopic is a single agent move — what the ECA says or does in one dialogue turn.

          Subtopics must include:
          - "name": a short name (≤ 8 words)
          - "brief": one-sentence summary of the subtopic
          - "mi_technique": choose one:

            - Open Question
            - Affirmation
            - Reflective Listening
            - Summary
            - Change Talk
            - Teach
            - Meta-Relational

          Subtopics must be:
          - Small and specific (like “Ask how they’re feeling” or “Teach what Pap test is”)
          - Based on safe, factual, non-speculative content
          - Emotionally intelligent and autonomy-supportive
          - Designed for a finite-state virtual agent (1 subtopic = 1 agent state)

          STEP 3 — Output Format (Do not change):


          OUTPUT FORMAT:
          {
            "all_topics": {
              "topic1_name": [
                {
                  "name": "subtopic1_name",
                  "brief": "one sentence summary of the subtopic",
                  "mi_technique": "MI technique to apply"
                },
                ...
              ],
              "topic2_name": [...]
            },
            "sessions_topics": {
              "session1": {
                "topic1_name": [
                  {
                    "name": "subtopic1_name",
                    "brief": "one sentence summary of the subtopic",
                    "mi_technique": "MI technique to apply"
                  },
                  ...
                ],
                "topic2_name": [...]
              },
              "session2": ...
            }
          }`,
      },
    ]
    try {
      const client = new OpenAI({
        apiKey: apiKey.value,
        dangerouslyAllowBrowser: true,
      })
      const res = await client.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 4000,
      })

      // const res = await http.post<ApiRes>({
      //   url: '/v1/chat/completions',
      //   headers: {
      //     Authorization: `Bearer ${apiKey.value}`,
      //     'Content-Type': 'application/json',
      //   },
      //   data: {
      //     model: 'gpt-4',
      //     messages,
      //     // max_tokens: 300,
      //     temperature: 0.7,
      //   },
      // })
      lastApi1Res.value = res
      if (res.choices && Array.isArray(res.choices) && res.choices.length > 0) {
        const [{ message }] = res.choices
        const errMsg = 'Conversion failed, please contact the administrator!'
        if (message) {
          const { content } = message
          try {
            const contentParsed = JSON.parse(content!)
            if (!contentParsed || typeof contentParsed !== 'object') {
              api1Result.value = null
              sessionTopics.value = []
              msgSrv.error(errMsg)
              return
            }

            const parsedRecord = contentParsed as Record<string, unknown>

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

            api1Result.value = {
              ...parsedRecord,
              all_topics: normalizedAllTopics,
              sessions_topics: normalizedSessions,
            }

            sessionTopics.value = Object.entries(normalizedSessions).map(
              ([sessionName, topics]) => ({
                sessionName,
                topics: Object.entries(topics).map(([topicName, subtopics]) => ({
                  topicName,
                  list: subtopics,
                })),
              }),
            )
          } catch (e) {
            msgSrv.error(errMsg)
          }
        } else {
          msgSrv.error(errMsg)
        }
      }
      convertLoading.value = false
    } catch (e) {
      convertLoading.value = false
      updateStep(0)
    }
  }

  const clearGraphView = () => {
    if (!graph.value) {
      return
    }
    const clearCells = (graph.value as any).clearCells
    if (typeof clearCells === 'function') {
      clearCells.call(graph.value)
    } else {
      graph.value.fromJSON([] as any)
    }
  }

  const buildTopicJobs = (): TopicJob[] => {
    const jobs: TopicJob[] = []
    const seen = new Set<string>()

    sessionTopics.value.forEach((session) => {
      session.topics.forEach((topic) => {
        const identifier = `${session.sessionName}::${topic.topicName}`
        if (seen.has(identifier)) {
          return
        }
        seen.add(identifier)
        jobs.push({
          id: identifier,
          topicName: topic.topicName,
          sessionName: session.sessionName,
          attempt: 0,
          status: 'pending',
          warnings: [],
        })
      })
    })

    return jobs
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
    const stages = parseResult.topics.get(topicName) ?? []
    if (!stages.length) {
      return false
    }

    const transformed = transform2AntvJson(new Map([[topicName, stages]]))
    const cells = transformed.get(topicName) ?? []
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

  const buildGenerationFingerprint = () => {
    try {
      const topicKeys = Array.from(topicScripts.value.keys()).sort()
      return JSON.stringify({
        version: GENERATION_FINGERPRINT_VERSION,
        convert: convertContent.value,
        mentor: mentorDirections.value,
        topics: topicKeys,
      })
    } catch (error) {
      return `${GENERATION_FINGERPRINT_VERSION}:${convertContent.value.length}:${mentorDirections.value.length}:${topicScripts.value.size}`
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

    flushAllTopicGraphs()

    const hasWorkToPersist = generationQueue.value.some((job) => job.status !== 'success')
    if (!hasWorkToPersist) {
      clearGenerationState()
      return
    }

    try {
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
      ])

      const topicGraphSnapshot = Array.from(topicGraph.value.entries()).map(([topicName, cells]) => [
        topicName,
        JSON.parse(JSON.stringify(cells)) as Cell.Properties[],
      ])

      const payload = {
        batchId: generationBatchId.value,
        cancelled: generationCancelled.value,
        activeTopicId: generationActiveTopicId.value,
        queue: queueSnapshot,
        scripts: scriptsSnapshot,
        issues: issuesSnapshot,
        topicGraph: topicGraphSnapshot,
        stateContent: stateContent.value,
        timestamp: Date.now(),
        fingerprintVersion: GENERATION_FINGERPRINT_VERSION,
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
      generationBatchId.value = parsed.batchId ?? null
      generationCancelled.value = Boolean(parsed.cancelled)
      generationActiveTopicId.value = parsed.activeTopicId ?? null

      const restoredQueue = parsed.queue.map((job) => ({
        ...job,
        status: job.status === 'running' ? 'pending' : job.status,
        warnings: Array.isArray(job.warnings)
          ? job.warnings.map((warning) => ({ ...warning }))
          : [],
      })) as TopicJob[]

      generationQueue.value = restoredQueue

      topicScripts.value = new Map(
        Array.isArray(parsed.scripts)
          ? parsed.scripts.map(([topicName, script]) => [topicName, script])
          : [],
      )

      topicIssues.value = new Map(
        Array.isArray(parsed.issues)
          ? parsed.issues.map(([topicName, issues]) => [
              topicName,
              Array.isArray(issues) ? issues.map((issue) => ({ ...issue })) : [],
            ])
          : [],
      )

      topicGraph.value.clear()
      if (Array.isArray(parsed.topicGraph)) {
        parsed.topicGraph.forEach((entry) => {
          if (!Array.isArray(entry) || entry.length !== 2) {
            return
          }
          const [topicName, cells] = entry as [unknown, unknown]
          if (typeof topicName === 'string' && Array.isArray(cells)) {
            topicGraph.value.set(topicName, cells as Cell.Properties[])
          }
        })
      }
      hydrateTopicGraphsFromScripts()

      stateContent.value = parsed.stateContent ?? stateContent.value
      generationProcessing.value = false
      queryTopicStrucLoading.value = false

      persistGenerationState()
      rebuildStateContent()

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

  const createOpenAIClient = () =>
    new OpenAI({
      apiKey: apiKey.value,
      dangerouslyAllowBrowser: true,
    })

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

  type TopicGenerationSuccess = {
    script: string
    stages: StageNode[]
    warnings: DialogueParseIssue[]
  }

  const generateTopicDialogue = async (
    client: OpenAI,
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
    const topicStructurePayload = JSON.stringify(
      {
        [job.sessionName]: {
          [topicName]: topicStructure,
        },
      },
      null,
      2,
    )
    const topicSummaryPayload = JSON.stringify(topicSummary, null, 2)

    const messages: ChatCompletionSystemMessageParam[] = [
      {
        role: 'system',
        content: `GUIDE FOR WRITING A DIALOGUE DELIVERED BY THE VIRTUAL COUNSELOR:

        """
        ${convertContent.value}
        """

        AUTHORING CONTEXT (sole factual source):
        """
        ${buildAuthoringContext()}
        """
         Contains dialogue goal (Education | Persuasion | Education & Persuasion), persona, age range, gender, etc.
         All factual teaching/claims must come ONLY from here.

        TOPIC SUMMARY (from API1; subtopics with chunk goals):
        """
        ${topicSummaryPayload}
        """

        TOPIC STRUCTURE (from API1; session = topic; 1:1 mapping):
        """
        ${topicStructurePayload}
        """

        MENTOR DIRECTIONS:
        """
        (Deprecated/unused) No mentor directions are used in this run. Ignore any content here.
        """

        TASK DESCRIPTION:
        You are generating a finite‑state machine (FSM) dialogue for the topic "${topicName}" in session "${job.sessionName}". Produce only this topic as a **serious, first‑time** conversation between a human and an Embodied Conversational Agent (ECA): a warm, professional 50‑year‑old woman trained in health education and motivational‑interviewing‑style counseling.

        HARD GROUNDING & SCOPE:
        • Use factual content ONLY from AUTHORING CONTEXT. The GUIDE informs tone/flow/safety—NOT new facts.
        • If needed facts are missing, DO NOT invent or speculate; prefer relational moves (Reflect, Affirm, Normalize, Check Understanding, Summarize & Bridge).
        • Serious health counseling: respectful, inclusive, autonomy‑supportive; no coercion, humor, slang, or emojis.
        • Never provide diagnosis, treatment, or clinical instructions; no speculative/off‑label claims.

        PERSONA & GOAL TAILORING (must do):
        • Tailor both AGENT lines and USERMENU to the persona, dialogue goal, age, and gender in AUTHORING CONTEXT.
        • Avoid stereotypes. Use inclusive wording (e.g., “people with a cervix” where appropriate).
        • Goal‑aware emphasis:
          – **Education** → Teach Fact → Check Understanding → Summarize/Bridge
          – **Persuasion** → Reflect/Normalize → Evoke Change Talk → Offer Choice → Summarize/Bridge
          – **Education & Persuasion** → balance teach + evoke + offer choice
        • Keep language plain, warm, and autonomy‑supportive (≤ 20 words per AGENT line).

        MI QUICK REFERENCE (for authoring logic; never mention MI to users):
        • Flow mindset: **Engage → Focus → Evoke → (light) Plan**.
        • Core moves: Open Question, Reflective Listening, Affirmation, Normalize, Teach Fact, Check Understanding, Summarize & Bridge, Offer Choice, Evoke Change Talk, Signpost Next Topic, Plan Next Step.
        • Micro‑patterns (≤ 20 words):
          – Teach Fact: one plain sentence; then Check Understanding
          – Open Question: start with “What/How”; avoid yes/no
          – Reflect: feeling + reason (“You’re worried about discomfort and results.”)
          – Affirm: specific and genuine
          – Summarize/Signpost: brief recap + gentle next step invite

        TOPIC SEQUENCE & CONTINUITY (global rule):
        • The full session is a top‑to‑bottom chain of topics from API1 (topic1 → topic2 → … → last topic → end).
        • For this topic:
          – **Start** with a soft, human pickup from what was just discussed (assume control returned via $POP();$). Do NOT say the word “topic.”
          – **End** with a natural, non‑coercive **Summarize & Bridge / Signpost Next Topic** handoff that clearly prepares users for the next topic.
        • Maintain emotional momentum across topics; avoid resets or abrupt tonal shifts.

        USERMENU DESIGN (user‑voice buttons; persona‑aware):
        • USERMENU options are what the user “clicks to say.” Each must sound like a **natural response** from this persona (consider goal, age, gender) to the current AGENT line and lead smoothly to the next state.
        • Provide ≥ 3 options with **diverse intents** (agree/affirm, ask/clarify, doubt/hesitate, curiosity, proceed/plan).
        • Keep options short (ideally ≤ 12 words); avoid “Next/Continue.”
        • Do NOT allow requests for clinical advice or personal diagnoses.
        • **Every referenced \`next_state_name\` must appear later** in the script.

        RECOMMENDATIONS:
        • Total states per topic: **~10–14** (allowed **7–20**).
        • AGENT line per state: **≤ 20 words**; plain, inclusive, warm, serious; persona‑ & goal‑aware.
        • Use unique, descriptive state names (lower_snake_case preferred).
        • Include at least one **Summarize & Bridge** or **Signpost Next Topic** state near the end.

        OUTPUT TARGET:
        • Generate **7 to 20** STATE sections, then end with STATE: end_conversation.
        • Each STATE must include immediately:
          AGENT: one utterance (≤ 20 words; persona‑ & goal‑aware)
          USERMENU: ≥ 3 natural options, each option text => next_state_name
        • All referenced next_state_name must appear later** in the script.
        • Begin with a soft pickup; end with a gentle handoff; then:

        VALIDATION (before returning):
        • All education strictly from AUTHORING CONTEXT; no speculation.
        • Persona/goal/age/gender clearly reflected in AGENT and USERMENU.
        • Serious, respectful, autonomy‑supportive tone; natural USERMENU; valid links; unique state names.
        • Cohesive continuity: start pickup → realize chunk goals → summarize/bridge → prepare next topic.
        • If any rule is violated, return exactly **RETRYING** and regenerate a compliant script.

        FORMAT (return script only — no code fences, no comments):
        //${topicName}
        STATE: state_name
        AGENT: agent_utterance (<= 20 words)
        USERMENU:
        option text => next_state_name
        option text => next_state_name
        option text => next_state_name

        ...

        STATE: end_conversation
        ACTION: $POP();$

        """
        `,
      },
    ]

    const res = await client.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.3,
      top_p: 1,
      max_tokens: 2000,
    })

    lastApi2Res.value = res

    if (!res.choices?.length) {
      throw new Error('No response returned from model.')
    }

    const [{ message }] = res.choices
    const rawContent = typeof message?.content === 'string' ? message.content : ''
    if (!rawContent.trim()) {
      throw new Error('Model response was empty.')
    }

    const script = sanitizeTopicResponse(rawContent, topicName)
    const parseResult = formatGeneticCounseling(script)
    const stages = parseResult.topics.get(topicName) ?? []
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
    client: OpenAI,
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

        try {
          const result = await generateTopicDialogue(client, job, mentor)
          topicScripts.value.set(job.topicName, result.script)
          recordTopicIssues(job.topicName, result.warnings)
          job.warnings = result.warnings
          const transformed = transform2AntvJson(new Map([[job.topicName, result.stages]]))
          topicGraph.value.set(job.topicName, transformed.get(job.topicName) ?? [])
          job.status = 'success'
          job.finishedAt = Date.now()

          if (!topicGraphSelected.value) {
            selectGraphTopic(job.topicName)
          } else if (topicGraphSelected.value === job.topicName) {
            const cells = topicGraph.value.get(job.topicName)
            if (cells) {
              graph.value?.fromJSON(cells)
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
    const client = createOpenAIClient()

    try {
      await processTopicQueue(client, mentor)
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
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
    const client = createOpenAIClient()

    try {
      await processTopicQueue(client, mentor, { jobIds: [nextJob.id] })
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
    const client = createOpenAIClient()

    try {
      await processTopicQueue(client, mentor)
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const retryTopic = async (topicName: string, mentor: string = '') => {
    const job = generationQueue.value.find((entry) => entry.topicName === topicName)
    if (!job) {
      return
    }

    clearTopicArtifacts(job.topicName)
    job.status = 'pending'
    job.error = undefined
    job.startedAt = undefined
    job.finishedAt = undefined
    job.warnings = []

    persistGenerationState()

    generationCancelled.value = false
    ensureGenerationBatch()
    queryTopicStrucLoading.value = true
    const client = createOpenAIClient()

    try {
      await processTopicQueue(client, mentor, { jobIds: [job.id] })
    } finally {
      if (!hasActiveJobs()) {
        generationBatchId.value = null
        generationCancelled.value = false
        queryTopicStrucLoading.value = false
      }
    }
  }

  const querySuggestOptions = async (mentorDirections: string) => {
    querySuggestOptionsLoading.value = true
    setNewSuggestOptionAgents({})
    const http = createHttp(apiBaseURL.DEFAULT)

    const topicList = stateContent.value.split(/(?=\n\/\/)/g).map((e) => e.replace(/^\n/, ''))
    const curTopic = topicList.find((e) => e.startsWith(`//${topicGraphSelected.value}`))

    const topicStructureSummary = [
      `Goal: ${authoringContext.value.goal || 'Not specified'}`,
      topicGraphSelected.value ? `Topic: ${topicGraphSelected.value}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n')

    const messages: ChatCompletionSystemMessageParam[] = [
      {
        role: 'system',
        content: `
        "
        ${convertContent.value}
        "

        AUTHORING CONTEXT (sole grounding for persona/goal/age/gender and any factual claims):
        "
        ${buildAuthoringContext()}
        "
        # Tailor USERMENU and any suggested next-state AGENT lines to persona, dialogue goal (Education | Persuasion | Education & Persuasion), age range, and gender.
        # If a fact is missing here, do NOT invent it.

        CURRENT CONVERSATION (FSM script for this topic; includes prior states and the target state's AGENT line):
        "
        ${curTopic}
        "

        STATE TO REVISE (generate for this state only):
        "
        ${querySuggestOptionStageName.value}
        "

        MENTOR DIRECTIONS (optional; apply minimal, precise adjustments if provided):
        "
        ${mentorDirections}
        "

        TASK:
        Suggest a USERMENU for the target state based strictly on the current conversation flow:
        1) Read the target state's AGENT line and preceding context in CURRENT CONVERSATION.
        2) Generate natural, persona‑ and goal‑aware user replies that a real user would click to “say” next.
        3) For each option, select the most suitable next state:
          • Prefer an EXISTING state name if it fits (from CURRENT CONVERSATION / TOPIC STRUCTURE).
          • If no existing state fits, PROPOSE a NEW state name and provide one ≤20‑word AGENT line for that new state.

        HARD GROUNDING & SAFETY:
        - Serious health context; respectful, inclusive, autonomy‑supportive; no slang/emojis/humor.
        - Do NOT include options that request diagnosis/treatment/individualized medical advice.
        - Use factual content only if present in AUTHORING CONTEXT; otherwise keep responses relational (reflect, affirm, normalize, check understanding, summarize/bridge).
        - Maintain continuity with what was already said; avoid contradictions or resets.

        PERSONA & GOAL TAILORING:
        - Phrase options as this persona would naturally respond, considering goal/age/gender.
        - Goal emphasis:
          • Education → clarify/learn‑more; teach‑back friendly
          • Persuasion → reflect/normalize; gently evoke change talk; offer choice
          • Education & Persuasion → balanced mix
        - Plain, warm, serious, autonomy‑supportive language.

        USERMENU RULES (MAX 3):
        - Provide **exactly 3** options (maximum 3).
        - Each option is a short, natural user reply (**≤ 12 words**), persona/goal‑aware.
        - Vary intent across options (agree/affirm, ask/clarify, doubt/hesitate/curiosity, proceed/plan).
        - Each option must end with => next_state_name.
          • Use an EXISTING state name if appropriate.
          • Otherwise create a NEW, unique lower_snake_case name that reflects the intent (e.g., reflect_fear, ask_more_details, summarize_bridge).

        NEXT‑STATE SUGGESTION RULES (only when the state is NEW):
        - For every option that maps to a NEW state name (not found in CURRENT CONVERSATION / TOPIC STRUCTURE), output ONE minimal next‑state block:
          STATE: <new_state_name>
          AGENT: <one ≤ 20‑word persona‑ & goal‑aware agent utterance that logically follows the option>
        - Do NOT include USERMENU under these suggested state blocks.
        - If multiple options map to the same NEW state, output the block ONCE.

        OUTPUT FORMAT (STRICT — return only these sections, in this order; no commentary, no code fences):

        USERMENU:
        <user‑like option 1> => <next_state_name_1>
        <user‑like option 2> => <next_state_name_2>
        <user‑like option 3> => <next_state_name_3>

        [For each NEW next_state_name only, add a minimal block:]
        STATE: <new_state_name_1>
        AGENT: <≤ 20‑word agent utterance, persona & goal aware>

        STATE: <new_state_name_2>
        AGENT: <≤ 20‑word agent utterance, persona & goal aware>

        VALIDATION (before returning):
        - USERMENU: **No more than 3** options; ≤ 12 words each; natural; persona/goal‑aware; varied intent; context‑consistent.
        - Each option maps to a valid next_state_name (existing or new). Existing names reused correctly; new names unique (lower_snake_case).
        - For every NEW state referenced, exactly one STATE/AGENT block is provided; AGENT line ≤ 20 words; serious, inclusive, grounded.
        - Return ONLY the USERMENU block + any NEW STATE blocks in the exact format above.
        `,
      },
    ]
    const client = new OpenAI({
      apiKey: apiKey.value,
      dangerouslyAllowBrowser: true,
    })
    const res = await client.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.3,
      top_p: 1,
      max_tokens: 800,
    })
    // const res = await http.post<ApiRes>({
    //   url: '/v1/chat/completions',
    //   headers: {
    //     Authorization: `Bearer ${apiKey.value}`,
    //     'Content-Type': 'application/json',
    //   },
    //   data: {
    //     model: 'gpt-4',
    //     messages,
    //     temperature: 0.5,
    //   },
    // })
    if (res.choices && Array.isArray(res.choices) && res.choices.length > 0) {
      const [{ message }] = res.choices
      if (message) {
        const content = typeof message.content === 'string' ? message.content : ''
        const agents = parseSuggestionAgents(content)
        setNewSuggestOptionAgents(agents)
        const menus = content
          .split('\n')
          .filter((e) => {
            const normalized = e.toLocaleLowerCase().trim()
            return (
              normalized !== 'usermenu:' &&
              normalized !== '' &&
              !e.toLocaleUpperCase().trim().startsWith('\"//') &&
              !normalized.startsWith('state:') &&
              !normalized.startsWith('agent:') &&
              !normalized.startsWith('action:') &&
              !normalized.startsWith('"state:') &&
              !normalized.startsWith('"agent:') &&
              !normalized.startsWith('"action:') &&
              !normalized.startsWith('"usermenu:')
            )
          })
          .map((e) => e.trim())
        setNewSuggestOptions([...new Set(menus)])
      } else {
        setNewSuggestOptionAgents({})
        setNewSuggestOptions([])
      }
    } else {
      setNewSuggestOptionAgents({})
      setNewSuggestOptions([])
    }
    querySuggestOptionsLoading.value = false
  }

  const updateSelectedGraphTopic = () => {
    if (topicGraphSelected.value) {
      topicGraph.value.set(topicGraphSelected.value, graph.value?.toJSON().cells!)
    }
  }

  const selectGraphTopic = (topicName: string) => {
    if (topicGraphSelected.value !== null && topicName !== topicGraphSelected.value) {
      topicGraph.value.set(topicGraphSelected.value, graph.value?.toJSON().cells!)
    }

    topicGraphSelected.value = topicName

    graph.value?.fromJSON(topicGraph.value.get(topicGraphSelected.value)!)
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
      if (graph.value) {
        const clearCells = (graph.value as any).clearCells
        if (typeof clearCells === 'function') {
          clearCells.call(graph.value)
        } else {
          graph.value.fromJSON([] as any)
        }
      }
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

  if (typeof window !== 'undefined') {
    try {
      const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY)
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile) as { name?: string }
        if (parsed?.name && typeof parsed.name === 'string') {
          userName.value = parsed.name
        }
      }
    } catch {
      // ignore bad profile data
    }
  }

  const updateUserName = (name: string) => {
    userName.value = name.trim()
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(
        USER_PROFILE_STORAGE_KEY,
        JSON.stringify({ name: userName.value }),
      )
    } catch (error) {
      console.warn('Failed to persist user name', error)
    }
  }

  const buildUserScopedKey = (base: string) => {
    const suffix = userName.value && userName.value.length ? userName.value : 'default'
    return `${base}:${suffix}`
  }

  return {
    userName,
    step,
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
    updateAuthoringContext,
    updateStep,
    convert2topic,
    queryTopicStructure,
    queryTopicStrucLoading,
    topicGraphSelected,
    topicGraph,
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
    querySuggestOptionsLoading,
    querySuggestOptionStageId,
    setQuerySuggestOptionStageId,
    updateSelectedGraphTopic,
    cancelTopicGeneration,
    topicIssues,
    generationQueue,
    generationBatchId,
    generationActiveTopicId,
    generationCancelled,
    generationProcessing,
    startGeneration,
    processNextTopic,
    resumeTopicGeneration,
    retryTopic,
    flushAllTopicGraphs,
    restoreGenerationState,
    updateUserName,
  }
})
