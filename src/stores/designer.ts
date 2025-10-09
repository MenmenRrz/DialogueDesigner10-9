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

export const useDesignerStore = defineStore('designer', () => {
  const appStore = useAppStore()

  const { apiKey } = storeToRefs(appStore)

  const step = ref(0)
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
          You are a conversation designer, who makes plans for topics of dialogue between a virtual agent coach, and the user of that virtual coach.
          The virtual coach is representing a 50-year-old lady who has been trained for providing health education and counseling to people for a particular behavior change topic. You should think about and plan the high-level topics that the agent presents to these users and output the topical and session-wise structure as a JSON. To do this, take the following steps:

          Step 1. Outline the topics that should be discussed based on your knowledge and the guidelines in the "GUIDE FOR WRITING A DIALOGUE DELIVERED BY THE VIRTUAL COUNSELOR". The outline should not generate the conversation itself, but instead should represent a high-level plan that should be followed by the agent. Remember that this plan should be comprehensive enough to guide the agent, and include example topics that should be brought up. Use the format in "all_topics" argument in OUTPUT FORMAT, and replace the topic and subtopic names with titles in your plan.
          Each subtopic entry must be an object containing the fields "name", "brief", and "mi_technique" (use empty strings if you do not have content for a field).
          Each subtopic you list must be an object containing the fields "name", "brief", and "mi_technique". Fill "mi_technique" with a concrete Motivational Interviewing strategy (e.g., Open Question, Affirmation, Reflective Listening, Summary, Change Talk). Do not leave it blank鈥攊f unsure, pick the technique that best supports the subtopic.
          Each session must only have 1 topic, and all topics name must be unique across sessions.

          Step 2. Based on the high level process you have developed, now organize those topics in %d sessions. You can use the guidelines in the "GUIDE FOR WRITING A DIALOGUE DELIVERED BY THE VIRTUAL COUNSELOR" for crafting this %d-session plan. Use the format in "sessions_topics" argument in OUTPUT FORMAT for this part.
          Each subtopic in "sessions_topics" must use the same object structure ("name", "brief", "mi_technique") even if some values are empty string, but try not to keep it empty.
          The subtopic entries you include in "sessions_topics" must reuse the same object structure ("name", "brief", "mi_technique") and all three fields must contain text (use the best-fit MI technique; never output placeholders or empty strings).


          Step 3. Based on your feedback, your mentor may or may not have suggestion for you. If they give you the "MENTOR DIRECTIONS", please re-do the Step 1 and Step 2 based on the "MENTOR DIRECTIONS".

          Step 4. Output the plan in the OUTPUT FORMAT below.

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

    window.localStorage.removeItem(GENERATION_STORAGE_KEY)
    window.localStorage.removeItem(GENERATION_FINGERPRINT_KEY)
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

      window.localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(payload))
      window.localStorage.setItem(GENERATION_FINGERPRINT_KEY, buildGenerationFingerprint())
    } catch (error) {
      console.error('Failed to persist generation state', error)
    }
  }

  const restoreGenerationState = () => {
    if (typeof window === 'undefined') {
      return false
    }

    const raw = window.localStorage.getItem(GENERATION_STORAGE_KEY)
    if (!raw) {
      return false
    }

    const storedFingerprint = window.localStorage.getItem(GENERATION_FINGERPRINT_KEY)
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
        AUTHORING CONTEXT:
        """
        ${buildAuthoringContext()}
        """

        TOPIC SUMMARY:
        """
        ${topicSummaryPayload}
        """

        MENTOR DIRECTION:
        """
        ${mentor}
        """

        TASK DESCRIPTION:
        """
        You are a conversation designer authoring the dialogue for the topic "${topicName}" within the session "${job.sessionName}". Generate only this topic. The conversation must follow the finite state machine format described in OUTPUT FORMAT and should not reference other topics.
        """

        TOPIC STRUCTURE:
        """
        ${topicStructurePayload}
        """

        OUTPUT TARGET:
        """
        - Generate between 7 and 20 STATE sections for this topic before ending at STATE: end_conversation.
        - Each STATE must be unique and include the AGENT and USERMENU sections immediately after it.
        - Each USERMENU must contain at least three options that use => next_state_name, and every referenced state must appear later in the script.
        """
        VALIDATION:
        """
        Before you finish, re-read your answer. If the topic violates any requirement above, write RETRYING and regenerate instead of stopping.
        """
        FORMAT:
        """
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

    let output = ''
    if (topicGraphSelected.value && topicGraph.value.has(topicGraphSelected.value)) {
      const cells = topicGraph.value.get(topicGraphSelected.value)
      const stages = cells!.filter((e) => e.shape === 'stage-node')
      output += '\n'
      output += `//${topicGraphSelected.value}\n`
      stages!.forEach((stage) => {
        output += `STATE: ${stage.data.name}\n`
        output += `AGENT: ${stage.data.agent}\n`
        output += 'USERMENU:\n';
        (stage.data.menus || []).forEach((menu: StageNodeMenu, menuIndex: number) => {
          const optionCellId = stage.children![menuIndex]
          const edgeCell = cells!.find(
            (cell) => cell.shape === 'edge' && cell.source.cell === optionCellId,
          )
          if (edgeCell) {
            output += `${menu.title} => ${edgeCell!.target.cell}\n`
          } else {
            output += `${menu.title} =>\n`
          }
        })
        output += '\n\n'
      })
    }

    const messages: ChatCompletionSystemMessageParam[] = [
      {
        role: 'system',
        content: `
          GUIDE FOR WRITING A DIALOGUE DELIVERED BY THE VIRTUAL COUNSELOR:
          "${convertContent.value}"
          TASK DESCRIPTION:
          You are a conversation reviser, who authors dialogue utterances for a virtual agent coach, and most likely utterances for the user of that virtual coach.
          The virtual coach is representing a 50-year-old lady who has been trained for providing health education and counseling to people for a particular behavior change topic.
          As the reviser of these conversations, you will take as input an already-created version of the agent's talk with these users, as well as the most common things a user can ask or say in response
          (all given in CURRENT CONVERSATION), which overall follow the TOPIC STRUCTURE. But you also have a mentor who is a subject matter expert in this area, who has seen the user options
          and wants to give you guidance on how to revise one of them. You should find your mentor's directions in MENTOR DIRECTIONS and revise the user options of the chosen state (STATE TO REVISE) based on these directions.

          CURRENT CONVERSATION:
          "${curTopic}"
          TOPIC STRUCTURE:
          "${output}"
          STATE TO REVISE:
          "${querySuggestOptionStageName.value}"
          MENTOR DIRECTIONS:
          "${mentorDirections}"


          RULES:
          - Adhere to safety guardrails for both the agent uttersnces and the user options. Do not give medical advice, and don't allow the user to ask for medical advice.
          - Do not ask questions or say things that are too personal. Keep things professional but also friendly such that the agent can really get to know the user without being intrusive.
          - Keep each agent utterance shorter than 20 words
          - Do not use emojis
          - Keep things conversational. Do not just act as a lecturer. Imagine the agent is really talking to a human that may know nothing about the topic. Through your conversation design,
            you should provide enough context and allow the user options to really engage the user in the conversation.
          - Do not generate anything other than the requested output.
          - Only return the new generated UserOption.
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

  return {
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
  }
})

