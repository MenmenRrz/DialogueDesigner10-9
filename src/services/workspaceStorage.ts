import { apiBaseURL } from '@/enums'
import { createHttp } from '@/utils/http'

const http = createHttp(apiBaseURL.DEFAULT)

export interface ServerWorkspaceSnapshot<TConvert = unknown> {
  schemaVersion: number
  app: string
  userName: string
  workspaceId: string
  savedAt: string
  reason?: string
  userThread?: unknown | null
  generationState?: unknown | null
  analyticsState?: unknown | null
  convertWorkspace?: TConvert | null
}

export interface WorkspaceSaveRequest<TConvert = unknown> {
  userName: string
  workspaceId?: string
  snapshot: ServerWorkspaceSnapshot<TConvert>
  createSnapshot?: boolean
  reason?: string
}

export interface WorkspaceSaveResponse {
  ok: boolean
  userName: string
  workspaceId: string
  savedAt: string
  snapshotId?: string | null
}

export interface WorkspacePresenceRequest {
  userName: string
  workspaceId?: string
  authoringMode?: 'ai' | 'manual'
  step?: number | null
  currentView?: string | null
  currentRoute?: string | null
  currentTopic?: string | null
  currentSubtopic?: string | null
  sessionId?: string | null
  planTopicCount?: number | null
  graphTopicCount?: number | null
  stateCount?: number | null
  optionCount?: number | null
  jumpCount?: number | null
  analyticsEventCount?: number | null
  lastActivityAt?: string | null
}

export interface WorkspacePresenceResponse {
  ok: boolean
  userName: string
  workspaceId: string
  seenAt: string
}

export interface WorkspaceLoadRequest {
  userName: string
  workspaceId?: string
}

export interface AdminRequestOptions {
  adminPassword?: string
}

export interface WorkspaceLoadResponse<TConvert = unknown> {
  ok: boolean
  found: boolean
  userName: string
  workspaceId: string
  snapshot?: ServerWorkspaceSnapshot<TConvert>
}

export interface WorkspaceSnapshotListItem {
  id: string
  savedAt: string
  reason?: string
  size: number
}

export interface WorkspaceSnapshotsResponse {
  ok: boolean
  userName: string
  workspaceId: string
  snapshots: WorkspaceSnapshotListItem[]
}

export interface WorkspaceAdminSessionSummary {
  userName: string
  workspaceId: string
  savedAt?: string | null
  latestFileUpdatedAt?: string | null
  reason?: string
  schemaVersion?: number | null
  authoringMode?: 'ai' | 'manual'
  step?: number | null
  topicCount?: number
  routeTopicCount?: number
  planTopicCount?: number
  graphTopicCount?: number
  stateCount?: number
  optionCount?: number
  jumpCount?: number
  selectedTopic?: string | null
  sessionId?: string | null
  analyticsEventCount?: number
  lastActivityAt?: string | null
  isActive?: boolean
  presenceUpdatedAt?: string | null
  currentView?: string | null
  currentRoute?: string | null
  currentTopic?: string | null
  currentSubtopic?: string | null
  latestSummary?: unknown | null
}

export interface WorkspaceAdminSummaryResponse {
  ok: boolean
  workspaceStoreRoot: string
  userCount: number
  workspaceCount: number
  latestSavedAt?: string | null
  modeCounts: {
    ai: number
    manual: number
  }
  exportedWorkspaceCount: number
  activeSessionCount: number
  sessionSummaries: WorkspaceAdminSessionSummary[]
  time?: string
}

export interface WorkspaceAdminSessionsResponse {
  ok: boolean
  sessions: WorkspaceAdminSessionSummary[]
}

export interface WorkspaceAdminSessionDetailResponse<TConvert = unknown> {
  ok: boolean
  found: boolean
  userName: string
  workspaceId: string
  summary?: WorkspaceAdminSessionSummary
  snapshots: WorkspaceSnapshotListItem[]
  snapshot?: ServerWorkspaceSnapshot<TConvert>
}

const extractPayload = <T>(response: unknown): T => {
  if (response && typeof response === "object" && 'data' in response) {
    const nested = (response as { data?: unknown }).data
    if (nested !== undefined) {
      return nested as T
    }
  }
  return response as T
}

const buildAdminHeaders = (options?: AdminRequestOptions) =>
  options?.adminPassword
    ? {
        'x-admin-password': options.adminPassword,
      }
    : undefined

export const requestWorkspaceSave = async <TConvert = unknown>(
  payload: WorkspaceSaveRequest<TConvert>,
) => {
  const response = await http.post<WorkspaceSaveResponse>({
    url: '/workspace/save',
    data: payload,
  })

  return extractPayload<WorkspaceSaveResponse>(response)
}

export const requestWorkspacePresence = async (payload: WorkspacePresenceRequest) => {
  const response = await http.post<WorkspacePresenceResponse>({
    url: '/workspace/presence',
    data: payload,
  })

  return extractPayload<WorkspacePresenceResponse>(response)
}

export const requestWorkspaceLoad = async <TConvert = unknown>(
  payload: WorkspaceLoadRequest,
) => {
  const response = await http.post<WorkspaceLoadResponse<TConvert>>({
    url: '/workspace/load',
    data: payload,
  })

  return extractPayload<WorkspaceLoadResponse<TConvert>>(response)
}

export const requestWorkspaceSnapshots = async (payload: WorkspaceLoadRequest) => {
  const response = await http.get<WorkspaceSnapshotsResponse>({
    url: '/workspace/snapshots',
    params: payload,
  })

  return extractPayload<WorkspaceSnapshotsResponse>(response)
}

export const requestWorkspaceAdminSummary = async (options?: AdminRequestOptions) => {
  const response = await http.get<WorkspaceAdminSummaryResponse>({
    url: '/workspace/admin/summary',
    headers: buildAdminHeaders(options),
  })

  return extractPayload<WorkspaceAdminSummaryResponse>(response)
}

export const requestWorkspaceAdminSessions = async (options?: AdminRequestOptions) => {
  const response = await http.get<WorkspaceAdminSessionsResponse>({
    url: '/workspace/admin/sessions',
    headers: buildAdminHeaders(options),
  })

  return extractPayload<WorkspaceAdminSessionsResponse>(response)
}

export const requestWorkspaceAdminSessionDetail = async (
  payload: WorkspaceLoadRequest,
  options?: AdminRequestOptions,
) => {
  const response = await http.get<WorkspaceAdminSessionDetailResponse>({
    url: '/workspace/admin/session',
    params: payload,
    headers: buildAdminHeaders(options),
  })

  return extractPayload<WorkspaceAdminSessionDetailResponse>(response)
}
