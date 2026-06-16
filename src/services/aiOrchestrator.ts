import { apiBaseURL } from '@/enums'
import { createHttp } from '@/utils/http'

const http = createHttp(apiBaseURL.DEFAULT)

export type AiTaskTag = 'plan.generate' | 'topic.generate' | 'state.menu_suggest' | 'state.rewrite'

export interface AiTaskRequest<TInput = Record<string, unknown>> {
  taskTag: AiTaskTag
  input: TInput
  sessionId?: string
  topicId?: string
  trace?: {
    requestId?: string
    clientVersion?: string
  }
}

export interface AiTaskMetrics {
  latencyMs?: number
  promptTokens?: number
  completionTokens?: number
  cacheHit?: boolean
}

export interface AiTaskCitation {
  source?: string
  collection?: string
  score?: number
}

export interface AiTaskResponseEnvelope<TOutput = unknown> {
  taskTag: AiTaskTag
  promptVersion?: string
  output: TOutput
  citations?: AiTaskCitation[]
  metrics?: AiTaskMetrics
  traceId?: string
}

export interface AiTaskErrorPayload {
  code: string
  message: string
  detail?: string
  traceId?: string
}

const extractPayload = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    const nested = (response as { data?: unknown }).data
    if (nested !== undefined) {
      return nested as T
    }
  }
  return response as T
}

export const parseAiTaskError = (error: unknown, fallbackMessage: string): AiTaskErrorPayload => {
  if (error && typeof error === 'object') {
    const axiosCode = (error as { code?: string }).code
    const axiosMessage = (error as { message?: string }).message
    if (
      axiosCode === 'ECONNABORTED' ||
      (typeof axiosMessage === 'string' &&
        /timeout of \d+ms exceeded/i.test(axiosMessage))
    ) {
      return {
        code: 'CLIENT_TIMEOUT',
        message: fallbackMessage,
        detail:
          'The request took longer than expected. The server may still be generating content. Please wait a moment and try again.',
      }
    }

    const responseData =
      (error as { response?: { data?: unknown } }).response?.data ??
      (error as { data?: unknown }).data ??
      error

    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      return {
        code: 'SERVER_ERROR',
        message: fallbackMessage,
        detail: responseData.trim(),
      }
    }

    if (responseData && typeof responseData === 'object') {
      const payload = responseData as Partial<AiTaskErrorPayload>
      return {
        code: payload.code || 'UNKNOWN_ERROR',
        message: payload.message || fallbackMessage,
        detail: payload.detail,
        traceId: payload.traceId,
      }
    }

    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return {
        code: 'NETWORK_ERROR',
        message: message.trim(),
      }
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.trim(),
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: fallbackMessage,
  }
}

export const requestAiTask = async <TOutput = unknown, TInput = Record<string, unknown>>(
  payload: AiTaskRequest<TInput>,
) => {
  const response = await http.post<AiTaskResponseEnvelope<TOutput>>({
    url: '/ai/task',
    data: payload,
  })

  return extractPayload<AiTaskResponseEnvelope<TOutput>>(response)
}

export interface ReferenceImageExtractionRequest {
  imageDataUrl: string
  fileName?: string
  authoringContext?: unknown
}

export interface ReferenceImageExtractionResponse {
  content: string
  traceId?: string
  metrics?: AiTaskMetrics
}

export interface AiHealthResponse {
  ok?: boolean
  service?: string
  model?: string
  embeddingModel?: string
  configRoot?: string
  sessionStoreRoot?: string
  kbIndexPath?: string
  hasOpenAiKey?: boolean
  time?: string
  [key: string]: unknown
}

export const requestReferenceImageExtraction = async (
  payload: ReferenceImageExtractionRequest,
) => {
  const response = await http.post<ReferenceImageExtractionResponse>({
    url: '/ai/extract-reference-image',
    data: payload,
  })

  return extractPayload<ReferenceImageExtractionResponse>(response)
}

export const requestAiHealth = async () => {
  const response = await http.get<AiHealthResponse>({
    url: '/ai/health',
  })

  return extractPayload<AiHealthResponse>(response)
}
