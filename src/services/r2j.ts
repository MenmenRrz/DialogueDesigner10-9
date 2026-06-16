import { apiBaseURL } from '@/enums'
import { createHttp } from '@/utils/http'

const http = createHttp(apiBaseURL.R2J)

export interface R2JErrorPayload {
  code: string
  message: string
  detail?: string
  topic?: string
  state?: string
  traceId?: string
  status?: number
  url?: string
}

export interface R2JPreviewRequest {
  topicName: string
  script: string
  startState?: string | null
}

export interface R2JPreviewResponse {
  topicName?: string
  startState?: string | null
  beatJson?: unknown
  beat_json?: unknown
  data?: unknown
  [key: string]: unknown
}

export interface R2JExportTopicRequest {
  topicName: string
  script: string
}

export interface R2JExportTopicResponse {
  topicName?: string
  fileName?: string
  beatJson?: unknown
  beat_json?: unknown
  data?: unknown
  [key: string]: unknown
}

export interface R2JHealthResponse {
  ok?: boolean
  service?: string
  time?: string
  [key: string]: unknown
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

const readErrorStatus = (error: unknown): number | undefined => {
  const status = (error as { response?: { status?: unknown } })?.response?.status
  return typeof status === 'number' ? status : undefined
}

const readErrorUrl = (error: unknown): string | undefined => {
  const config = (error as { config?: { baseURL?: unknown; url?: unknown } })?.config
  const base = typeof config?.baseURL === 'string' ? config.baseURL : ''
  const path = typeof config?.url === 'string' ? config.url : ''
  const combined = `${base}${path}`.trim()
  return combined || undefined
}

export const parseR2JError = (error: unknown, fallbackMessage: string): R2JErrorPayload => {
  const status = readErrorStatus(error)
  const url = readErrorUrl(error)

  if (error && typeof error === 'object') {
    const responseData =
      (error as { response?: { data?: unknown } }).response?.data ??
      (error as { data?: unknown }).data ??
      error

    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      const detailParts = [responseData.trim()]
      if (status) {
        detailParts.push(`HTTP ${status}`)
      }
      if (url) {
        detailParts.push(`URL: ${url}`)
      }
      return {
        code: 'SERVER_ERROR',
        message: fallbackMessage,
        detail: detailParts.join('\n'),
        status,
        url,
      }
    }

    if (responseData && typeof responseData === 'object') {
      const payload = responseData as Partial<R2JErrorPayload>
      const detailFromPayload =
        typeof payload.detail === 'string' && payload.detail.trim().length > 0
          ? payload.detail
          : undefined
      const fallbackDetailParts: string[] = []
      if (!detailFromPayload && status) {
        fallbackDetailParts.push(`HTTP ${status}`)
      }
      if (!detailFromPayload && url) {
        fallbackDetailParts.push(`URL: ${url}`)
      }
      return {
        code: payload.code || 'UNKNOWN_ERROR',
        message: payload.message || fallbackMessage,
        detail: detailFromPayload || (fallbackDetailParts.length ? fallbackDetailParts.join('\n') : undefined),
        topic: payload.topic,
        state: payload.state,
        traceId: payload.traceId,
        status: payload.status ?? status,
        url: payload.url ?? url,
      }
    }

    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      const detailParts: string[] = []
      if (status) {
        detailParts.push(`HTTP ${status}`)
      }
      if (url) {
        detailParts.push(`URL: ${url}`)
      }
      return {
        code: 'NETWORK_ERROR',
        message: message.trim(),
        detail: detailParts.length ? detailParts.join('\n') : undefined,
        status,
        url,
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
    status,
    url,
  }
}

export const requestR2JPreview = async (payload: R2JPreviewRequest) => {
  const response = await http.post<R2JPreviewResponse>({
    url: '/preview',
    data: payload,
  })
  return extractPayload<R2JPreviewResponse>(response)
}

export const requestR2JExportTopic = async (payload: R2JExportTopicRequest) => {
  const response = await http.post<R2JExportTopicResponse>({
    url: '/export-topic',
    data: payload,
  })
  return extractPayload<R2JExportTopicResponse>(response)
}

export const requestR2JHealth = async () => {
  const response = await http.get<R2JHealthResponse>({
    url: '/health',
  })
  return extractPayload<R2JHealthResponse>(response)
}
