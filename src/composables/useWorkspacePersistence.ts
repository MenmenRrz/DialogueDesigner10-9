import type { Ref } from 'vue'
import type { Cell } from '@antv/x6'

export type ConvertWorkspaceSnapshot = {
  layoutVersion?: string
  planTopics?: unknown[]
  topicGraph?: Array<[string, Cell.Properties[]]>
  topicGraphSelected?: string | null
  convertContent?: string
  stateContent?: string
  agentPanelVisible?: boolean
  agentPanelCollapsed?: boolean
  agentPanelSize?: {
    width?: number
    height?: number
  }
}

type SyncOptions = {
  reason?: string
  createSnapshot?: boolean
  silent?: boolean
  forceCurrentGraphSnapshot?: boolean
}

type RestoreOptions = {
  silent?: boolean
}

type UseWorkspacePersistenceOptions<TSnapshot extends ConvertWorkspaceSnapshot> = {
  userSessionReady: Ref<boolean>
  userNameDisplay: Ref<string>
  autoSaveMessage: Ref<string>
  isManualAuthoringMode: Ref<boolean>
  isRestoringWorkspace: Ref<boolean>
  getWorkspaceStorageKey: () => string
  getWorkspaceFingerprintKey: () => string
  buildWorkspaceFingerprint: () => string
  buildWorkspacePayload: (options?: { forceCurrentGraphSnapshot?: boolean }) => TSnapshot
  applyWorkspacePayload: (payload: TSnapshot, options?: { silent?: boolean; source?: 'browser' | 'server' }) => void
  saveWorkspaceToServer: (payload: {
    reason?: string
    createSnapshot?: boolean
    convertWorkspace: TSnapshot
  }) => Promise<{ ok?: boolean }>
  loadWorkspaceFromServer: <T>() => Promise<{
    ok?: boolean
    found?: boolean
    snapshot?: {
      convertWorkspace?: T | null
    } | null
  }>
  hasLocalEdits: () => boolean
  isGraphHydrating: () => boolean
  updateCurrentTopicStats: () => void
  notifyError: (message: string) => void
  notifySuccess: (message: string) => void
}

export const useWorkspacePersistence = <TSnapshot extends ConvertWorkspaceSnapshot>({
  userSessionReady,
  userNameDisplay,
  autoSaveMessage,
  isManualAuthoringMode,
  isRestoringWorkspace,
  getWorkspaceStorageKey,
  getWorkspaceFingerprintKey,
  buildWorkspaceFingerprint,
  buildWorkspacePayload,
  applyWorkspacePayload,
  saveWorkspaceToServer,
  loadWorkspaceFromServer,
  hasLocalEdits,
  isGraphHydrating,
  updateCurrentTopicStats,
  notifyError,
  notifySuccess,
}: UseWorkspacePersistenceOptions<TSnapshot>) => {
  let autoSaveTimer: number | null = null
  let manualEditAutoSaveTimer: number | null = null
  let generationAutoSaveTimer: number | null = null
  let workspaceServerSyncInFlight = false
  let queuedWorkspaceServerSyncOptions: SyncOptions | null = null

  const canUseStorage = () =>
    typeof window !== 'undefined' && userSessionReady.value && Boolean(userNameDisplay.value)

  const buildPayloadFingerprint = (payload: ConvertWorkspaceSnapshot) => {
    const topicKeys = Array.isArray(payload.topicGraph)
      ? payload.topicGraph
          .map((entry) => (Array.isArray(entry) && typeof entry[0] === 'string' ? entry[0] : ''))
          .filter((entry) => entry.trim().length > 0)
          .sort()
          .join('::')
      : ''

    return `${typeof payload.convertContent === 'string' ? payload.convertContent.length : 0}:${topicKeys}`
  }

  const countWorkspaceGraphCells = (payload: ConvertWorkspaceSnapshot | null | undefined) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.topicGraph)) {
      return 0
    }

    return payload.topicGraph.reduce((total, entry) => {
      if (!Array.isArray(entry) || !Array.isArray(entry[1])) {
        return total
      }
      return total + entry[1].length
    }, 0)
  }

  const readBrowserWorkspacePayload = () => {
    if (!canUseStorage()) {
      return null
    }

    try {
      const raw = window.localStorage.getItem(getWorkspaceStorageKey())
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as TSnapshot
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }

  const syncWorkspaceToServer = async (options: SyncOptions = {}) => {
    if (!userSessionReady.value || !userNameDisplay.value) {
      return false
    }

    if (workspaceServerSyncInFlight) {
      queuedWorkspaceServerSyncOptions = {
        reason: options.reason ?? queuedWorkspaceServerSyncOptions?.reason,
        createSnapshot: Boolean(options.createSnapshot || queuedWorkspaceServerSyncOptions?.createSnapshot),
        silent: Boolean(options.silent && queuedWorkspaceServerSyncOptions?.silent !== false),
        forceCurrentGraphSnapshot: Boolean(
          options.forceCurrentGraphSnapshot || queuedWorkspaceServerSyncOptions?.forceCurrentGraphSnapshot,
        ),
      }
      return false
    }

    try {
      workspaceServerSyncInFlight = true
      const payload = buildWorkspacePayload({
        forceCurrentGraphSnapshot: options.forceCurrentGraphSnapshot,
      })
      const result = await saveWorkspaceToServer({
        reason: options.reason,
        createSnapshot: options.createSnapshot,
        convertWorkspace: payload,
      })
      return Boolean(result.ok)
    } catch (error) {
      console.error('Failed to save workspace to server', error)
      if (!options.silent) {
        notifyError('Browser save worked, but server save failed.')
      }
      return false
    } finally {
      workspaceServerSyncInFlight = false
      if (queuedWorkspaceServerSyncOptions) {
        const queuedOptions = queuedWorkspaceServerSyncOptions
        queuedWorkspaceServerSyncOptions = null
        void syncWorkspaceToServer(queuedOptions)
      }
    }
  }

  const persistWorkspacePayloadToBrowser = (payload: TSnapshot): boolean => {
    if (!canUseStorage()) {
      return false
    }

    try {
      window.localStorage.setItem(getWorkspaceStorageKey(), JSON.stringify(payload))
      window.localStorage.setItem(getWorkspaceFingerprintKey(), buildPayloadFingerprint(payload))
      updateCurrentTopicStats()
      return true
    } catch (error) {
      console.error('Failed to persist restored workspace', error)
      return false
    }
  }

  const restoreWorkspaceFromServer = async (options: RestoreOptions = {}) => {
    if (!userSessionReady.value || !userNameDisplay.value) {
      return false
    }

    try {
      const result = await loadWorkspaceFromServer<TSnapshot>()
      const convertWorkspace = result.snapshot?.convertWorkspace
      if (!result.ok || !result.found || !convertWorkspace || typeof convertWorkspace !== 'object') {
        return false
      }

      const browserWorkspace = readBrowserWorkspacePayload()
      if (
        browserWorkspace &&
        countWorkspaceGraphCells(browserWorkspace) > countWorkspaceGraphCells(convertWorkspace)
      ) {
        return false
      }

      applyWorkspacePayload(convertWorkspace, {
        silent: options.silent,
        source: 'server',
      })
      persistWorkspacePayloadToBrowser(convertWorkspace)
      return true
    } catch (error) {
      console.error('Failed to restore workspace from server', error)
      if (!options.silent) {
        notifyError('Failed to restore dialogue from server.')
      }
      return false
    }
  }

  const persistWorkspace = (options: { forceCurrentGraphSnapshot?: boolean } = {}): boolean => {
    if (!canUseStorage()) {
      return false
    }

    try {
      const payload = buildWorkspacePayload({
        forceCurrentGraphSnapshot: options.forceCurrentGraphSnapshot,
      })

      window.localStorage.setItem(getWorkspaceStorageKey(), JSON.stringify(payload))
      window.localStorage.setItem(getWorkspaceFingerprintKey(), buildWorkspaceFingerprint())
      updateCurrentTopicStats()
      return true
    } catch (error) {
      console.error('Failed to save workspace', error)
      return false
    }
  }

  const saveWorkspaceNow = () => {
    if (typeof window === 'undefined') {
      notifyError('Browser storage is unavailable.')
      return
    }

    const success = persistWorkspace({ forceCurrentGraphSnapshot: true })
    if (!success) {
      notifyError('Failed to save dialogue to browser.')
      return
    }

    autoSaveMessage.value = 'Saved to browser at ' + new Date().toLocaleTimeString()
    void syncWorkspaceToServer({
      reason: 'manual-save',
      createSnapshot: true,
      forceCurrentGraphSnapshot: true,
    }).then((serverSaved) => {
      if (serverSaved) {
        notifySuccess('Dialogue saved to browser and server.')
        autoSaveMessage.value = 'Saved at ' + new Date().toLocaleTimeString()
      }
    })
  }

  const runAutoSave = (options: { reason?: string } = {}) => {
    if (typeof window === 'undefined') {
      return
    }

    autoSaveMessage.value = 'Auto-saving...'

    const success = persistWorkspace()
    if (!success) {
      autoSaveMessage.value = 'Auto-save failed'
      return
    }

    autoSaveMessage.value = 'Auto-saved locally...'
    void syncWorkspaceToServer({
      reason: options.reason ?? 'auto-save',
      createSnapshot: true,
      silent: true,
    }).then((serverSaved) => {
      autoSaveMessage.value = serverSaved
        ? 'Auto-saved at ' + new Date().toLocaleTimeString()
        : 'Auto-saved locally'

      window.setTimeout(() => {
        autoSaveMessage.value = ''
      }, 4000)
    })
  }

  const scheduleManualEditAutoSave = () => {
    if (
      typeof window === 'undefined' ||
      !isManualAuthoringMode.value ||
      isGraphHydrating() ||
      isRestoringWorkspace.value ||
      !userSessionReady.value ||
      !userNameDisplay.value
    ) {
      return
    }

    if (manualEditAutoSaveTimer !== null) {
      window.clearTimeout(manualEditAutoSaveTimer)
    }

    manualEditAutoSaveTimer = window.setTimeout(() => {
      manualEditAutoSaveTimer = null
      runAutoSave({ reason: 'manual-edit-auto-save' })
    }, 8000)
  }

  const scheduleGenerationAutoSave = () => {
    if (
      typeof window === 'undefined' ||
      isManualAuthoringMode.value ||
      isRestoringWorkspace.value ||
      !userSessionReady.value ||
      !userNameDisplay.value
    ) {
      return
    }

    if (generationAutoSaveTimer !== null) {
      window.clearTimeout(generationAutoSaveTimer)
    }

    generationAutoSaveTimer = window.setTimeout(() => {
      generationAutoSaveTimer = null
      runAutoSave({ reason: 'ai-generation-auto-save' })
    }, 1000)
  }

  const restoreWorkspace = (options: RestoreOptions = {}) => {
    if (!canUseStorage()) {
      return false
    }

    const workspaceStorageKey = getWorkspaceStorageKey()
    const workspaceFingerprintKey = getWorkspaceFingerprintKey()
    const raw = window.localStorage.getItem(workspaceStorageKey)
    const storedFingerprint = window.localStorage.getItem(workspaceFingerprintKey)

    if (!raw) {
      return false
    }

    try {
      const currentFingerprint = buildWorkspaceFingerprint()

      if (storedFingerprint && storedFingerprint !== currentFingerprint && hasLocalEdits()) {
        window.localStorage.removeItem(workspaceStorageKey)
        window.localStorage.removeItem(workspaceFingerprintKey)
        return false
      }

      const parsed = JSON.parse(raw) as TSnapshot
      applyWorkspacePayload(parsed, {
        silent: options.silent,
        source: 'browser',
      })
      window.localStorage.setItem(workspaceFingerprintKey, currentFingerprint)
      return true
    } catch (error) {
      console.error('Failed to restore workspace', error)
      window.localStorage.removeItem(workspaceStorageKey)
      window.localStorage.removeItem(workspaceFingerprintKey)

      if (!options.silent) {
        notifyError('Failed to restore dialogue from browser.')
      }

      return false
    }
  }

  const startPeriodicAutoSave = () => {
    if (typeof window === 'undefined' || autoSaveTimer !== null) {
      return
    }

    autoSaveTimer = window.setInterval(() => {
      runAutoSave()
    }, 120000)
  }

  const clearPeriodicAutoSave = () => {
    if (typeof window === 'undefined' || autoSaveTimer === null) {
      return
    }

    window.clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }

  const flushPendingAutoSaves = () => {
    if (typeof window === 'undefined') {
      return
    }

    const hasPendingManualSave = manualEditAutoSaveTimer !== null
    const hasPendingGenerationSave = generationAutoSaveTimer !== null

    if (manualEditAutoSaveTimer !== null) {
      window.clearTimeout(manualEditAutoSaveTimer)
      manualEditAutoSaveTimer = null
    }

    if (generationAutoSaveTimer !== null) {
      window.clearTimeout(generationAutoSaveTimer)
      generationAutoSaveTimer = null
    }

    if (!hasPendingManualSave && !hasPendingGenerationSave) {
      return
    }

    persistWorkspace()
    void syncWorkspaceToServer({
      reason: 'leave-convert',
      createSnapshot: true,
      silent: true,
    })
  }

  return {
    syncWorkspaceToServer,
    restoreWorkspaceFromServer,
    persistWorkspace,
    saveWorkspaceNow,
    persistWorkspacePayloadToBrowser,
    runAutoSave,
    scheduleManualEditAutoSave,
    scheduleGenerationAutoSave,
    restoreWorkspace,
    startPeriodicAutoSave,
    clearPeriodicAutoSave,
    flushPendingAutoSaves,
  }
}
