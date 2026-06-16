<template>
  <div class="admin-monitor">
    <div v-if="!isAuthorized" class="gate-shell">
      <a-card class="gate-card">
        <div class="eyebrow">Protected</div>
        <h1>Admin Monitor</h1>
        <p>Enter the admin password to view saved sessions, RA metrics, and backend health.</p>
        <a-alert v-if="authError" class="gate-alert" type="error" show-icon :message="authError" />
        <a-space direction="vertical" style="width: 100%" :size="14">
          <a-input-password
            v-model:value="adminPasswordInput"
            size="large"
            placeholder="Enter admin password"
            @pressEnter="void onUnlockAdmin()"
          />
          <a-button type="primary" size="large" block :loading="authLoading" @click="onUnlockAdmin">
            Open Admin Monitor
          </a-button>
        </a-space>
      </a-card>
    </div>

    <template v-else>
      <div class="admin-header">
        <div>
          <div class="eyebrow">Research Dashboard</div>
          <h1>Admin Monitor</h1>
          <p>Review saved sessions, RA summaries, and backend status without entering the authoring flow.</p>
        </div>
        <a-space>
          <span class="refresh-note">Auto-refresh: 5s</span>
          <a-button @click="onLockAdmin">Lock</a-button>
          <a-button :loading="dashboardLoading" @click="onRefresh">Refresh</a-button>
        </a-space>
      </div>

      <a-alert v-if="dashboardError" class="admin-alert" type="error" show-icon :message="dashboardError" />

      <div class="hero-grid">
        <a-card class="hero-card"><div class="label">Tracked Workspaces</div><div class="value">{{ summary?.workspaceCount ?? 0 }}</div></a-card>
        <a-card class="hero-card"><div class="label">Users</div><div class="value">{{ summary?.userCount ?? 0 }}</div></a-card>
        <a-card class="hero-card"><div class="label">Active Now</div><div class="value">{{ summary?.activeSessionCount ?? 0 }}</div></a-card>
        <a-card class="hero-card"><div class="label">AI-Assisted</div><div class="value">{{ summary?.modeCounts.ai ?? 0 }}</div></a-card>
        <a-card class="hero-card"><div class="label">Manual</div><div class="value">{{ summary?.modeCounts.manual ?? 0 }}</div></a-card>
        <a-card class="hero-card"><div class="label">Latest Save</div><div class="value small">{{ formatDateTime(summary?.latestSavedAt ?? null) }}</div></a-card>
        <a-card class="hero-card"><div class="label">Exported Sessions</div><div class="value">{{ summary?.exportedWorkspaceCount ?? 0 }}</div></a-card>
      </div>

      <div class="metrics-grid">
        <a-card title="Efficiency & Workload" class="panel-card">
          <div class="metric-grid">
            <div class="metric-box"><span>Avg Session</span><strong>{{ formatMinutes(aggregated.avgSessionDurationMinutes) }}</strong></div>
            <div class="metric-box"><span>Avg Effective Editing</span><strong>{{ formatMinutes(aggregated.avgEffectiveEditingMinutes) }}</strong></div>
            <div class="metric-box"><span>Avg Time To Preview</span><strong>{{ formatMinutes(aggregated.avgTimeToPreviewMinutes) }}</strong></div>
            <div class="metric-box"><span>Avg AI Wait Ratio</span><strong>{{ formatPercent(aggregated.avgAiWaitRatio) }}</strong></div>
          </div>
        </a-card>
        <a-card title="AI Assistance" class="panel-card">
          <div class="metric-grid">
            <div class="metric-box"><span>Avg Suggest Acceptance</span><strong>{{ formatPercent(aggregated.avgSuggestionAcceptanceRate) }}</strong></div>
            <div class="metric-box"><span>Avg AI Acceptance</span><strong>{{ formatPercent(aggregated.avgAiAcceptanceRate) }}</strong></div>
            <div class="metric-box"><span>Avg AI Contribution</span><strong>{{ formatPercent(aggregated.avgAiContributionRatio) }}</strong></div>
            <div class="metric-box"><span>Avg Topic Regens</span><strong>{{ formatCount(aggregated.avgTopicRegenerateCount) }}</strong></div>
            <div class="metric-box"><span>Avg Rewrite Requests</span><strong>{{ formatCount(aggregated.avgStateRewriteRequestCount) }}</strong></div>
            <div class="metric-box"><span>Avg Rewrite Prompts</span><strong>{{ formatCount(aggregated.avgStateRewritePromptCount) }}</strong></div>
            <div class="metric-box"><span>Avg Prompt Chars</span><strong>{{ formatCount(aggregated.avgStateRewritePromptChars) }}</strong></div>
          </div>
        </a-card>
        <a-card title="Editing Quality" class="panel-card">
          <div class="metric-grid">
            <div class="metric-box"><span>Avg Modified States</span><strong>{{ formatCount(aggregated.avgModifiedStateCount) }}</strong></div>
            <div class="metric-box"><span>Avg Modified Options</span><strong>{{ formatCount(aggregated.avgModifiedOptionCount) }}</strong></div>
            <div class="metric-box"><span>Avg State Modification</span><strong>{{ formatPercent(aggregated.avgStateTextModificationRatio) }}</strong></div>
            <div class="metric-box"><span>Avg Option Modification</span><strong>{{ formatPercent(aggregated.avgOptionTextModificationRatio) }}</strong></div>
          </div>
        </a-card>
        <a-card title="Final vs AI" class="panel-card">
          <div class="metric-grid">
            <div class="metric-box"><span>Avg Final vs AI</span><strong>{{ formatPercent(aggregated.avgFinalVsAiDistance) }}</strong></div>
            <div class="metric-box"><span>Avg Structure Change</span><strong>{{ formatPercent(aggregated.avgStructureChangeRatio) }}</strong></div>
          </div>
        </a-card>
        <a-card title="Dialogue Complexity" class="panel-card">
          <div class="metric-grid">
            <div class="metric-box"><span>Avg States</span><strong>{{ formatCount(aggregated.avgStateCount) }}</strong></div>
            <div class="metric-box"><span>Avg Options</span><strong>{{ formatCount(aggregated.avgOptionCount) }}</strong></div>
            <div class="metric-box"><span>Avg Max Depth</span><strong>{{ formatNumber(aggregated.avgMaxDepth) }}</strong></div>
            <div class="metric-box"><span>Avg Branching</span><strong>{{ formatNumber(aggregated.avgBranchingFactor) }}</strong></div>
          </div>
        </a-card>
      </div>

      <div class="health-grid">
        <a-card title="AI Backend" class="panel-card">
          <div class="health-row"><a-tag :color="aiHealth?.ok ? 'green' : 'red'">{{ aiHealth?.ok ? 'Online' : 'Offline' }}</a-tag><span>{{ aiHealth?.service || 'Unavailable' }}</span></div>
          <div class="health-meta">Model: {{ String(aiHealth?.model || 'n/a') }}</div>
          <div class="health-meta">Checked: {{ formatDateTime(aiHealth?.time ?? null) }}</div>
        </a-card>
        <a-card title="R2J Backend" class="panel-card">
          <div class="health-row"><a-tag :color="r2jHealth?.ok ? 'green' : 'red'">{{ r2jHealth?.ok ? 'Online' : 'Offline' }}</a-tag><span>{{ r2jHealth?.service || 'Unavailable' }}</span></div>
          <div class="health-meta">Checked: {{ formatDateTime(r2jHealth?.time ?? null) }}</div>
        </a-card>
      </div>

      <a-card title="Saved Sessions" class="panel-card">
        <a-table
          :columns="sessionColumns"
          :data-source="sessions"
          :loading="dashboardLoading"
          :pagination="{ pageSize: 8, showSizeChanger: false }"
          row-key="rowKey"
          :custom-row="buildSessionRowProps"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'authoringMode'">
              <a-tag :color="record.authoringMode === 'manual' ? 'orange' : 'blue'">
                {{ record.authoringMode === 'manual' ? 'Manual' : 'AI-Assisted' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'presence'">
              <a-tag :color="record.isActive ? 'green' : 'default'">
                {{ record.isActive ? 'Online' : 'Saved only' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'currentView'">
              {{ record.currentView || 'n/a' }}
            </template>
            <template v-else-if="column.key === 'currentTopic'">
              {{ record.currentTopic || record.selectedTopic || 'n/a' }}
            </template>
            <template v-else-if="column.key === 'savedAt'">{{ formatDateTime(record.savedAt) }}</template>
            <template v-else-if="column.key === 'lastActivityAt'">{{ formatDateTime(record.lastActivityAt) }}</template>
            <template v-else-if="column.key === 'aiWaitRatio'">{{ formatPercent(getSummaryMetric(record.latestSummary, 'aiWaitRatio')) }}</template>
            <template v-else-if="column.key === 'finalVsAiDistance'">{{ formatPercent(getSummaryMetric(record.latestSummary, 'finalVsAiDistance')) }}</template>
          </template>
        </a-table>
      </a-card>

      <a-drawer :open="detailDrawerOpen" width="820" title="Session Detail" @close="detailDrawerOpen = false">
        <template v-if="selectedSessionDetail">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="User">{{ selectedSessionDetail.userName }}</a-descriptions-item>
            <a-descriptions-item label="Workspace">{{ selectedSessionDetail.workspaceId }}</a-descriptions-item>
            <a-descriptions-item label="Mode">{{ selectedSessionDetail.summary?.authoringMode === 'manual' ? 'Manual' : 'AI-Assisted' }}</a-descriptions-item>
            <a-descriptions-item label="Saved At">{{ formatDateTime(selectedSessionDetail.summary?.savedAt ?? null) }}</a-descriptions-item>
            <a-descriptions-item label="Presence">{{ selectedSessionDetail.summary?.isActive ? 'Online' : 'Saved only' }}</a-descriptions-item>
            <a-descriptions-item label="Last Seen">{{ formatDateTime(selectedSessionDetail.summary?.presenceUpdatedAt ?? null) }}</a-descriptions-item>
            <a-descriptions-item label="Topics">{{ selectedSessionDetail.summary?.topicCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="States">{{ selectedSessionDetail.summary?.stateCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="Options">{{ selectedSessionDetail.summary?.optionCount ?? 0 }}</a-descriptions-item>
            <a-descriptions-item label="Selected Topic">{{ selectedSessionDetail.summary?.selectedTopic || 'n/a' }}</a-descriptions-item>
            <a-descriptions-item label="Current View">{{ selectedSessionDetail.summary?.currentView || 'n/a' }}</a-descriptions-item>
            <a-descriptions-item label="Current Topic">{{ selectedSessionDetail.summary?.currentTopic || 'n/a' }}</a-descriptions-item>
          </a-descriptions>

          <div class="detail-grid">
            <a-card title="Efficiency" class="panel-card" size="small">
              <div class="metric-grid">
                <div class="metric-box"><span>Session Duration</span><strong>{{ formatMsAsMinutes(getSummaryMetric(detailSummary, 'sessionDurationMs')) }}</strong></div>
                <div class="metric-box"><span>Effective Editing</span><strong>{{ formatMsAsMinutes(getSummaryMetric(detailSummary, 'effectiveEditingDurationMs')) }}</strong></div>
                <div class="metric-box"><span>Time To Preview</span><strong>{{ formatMsAsMinutes(getSummaryMetric(detailSummary, 'timeToFirstPreviewMs')) }}</strong></div>
                <div class="metric-box"><span>AI Wait Ratio</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'aiWaitRatio')) }}</strong></div>
              </div>
            </a-card>
            <a-card title="AI Assistance" class="panel-card" size="small">
              <div class="metric-grid">
                <div class="metric-box"><span>Suggest Acceptance</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'suggestionAcceptanceRate')) }}</strong></div>
                <div class="metric-box"><span>AI Acceptance</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'aiAcceptanceRate')) }}</strong></div>
                <div class="metric-box"><span>AI Contribution</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'aiContributionRatio')) }}</strong></div>
                <div class="metric-box"><span>Topic Regens</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'topicRegenerateCount')) }}</strong></div>
                <div class="metric-box"><span>Rewrite Requests</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'stateRewriteRequestCount')) }}</strong></div>
                <div class="metric-box"><span>Rewrite Applies</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'stateRewriteApplyCount')) }}</strong></div>
                <div class="metric-box"><span>Rewrite Prompts</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'stateRewritePromptCount')) }}</strong></div>
                <div class="metric-box"><span>Prompt Chars</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'stateRewritePromptCharCount')) }}</strong></div>
                <div class="metric-box"><span>Avg Prompt Chars</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'avgStateRewritePromptChars')) }}</strong></div>
              </div>
            </a-card>
            <a-card title="Manual Editing" class="panel-card" size="small">
              <div class="metric-grid">
                <div class="metric-box"><span>Edit Bursts</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'manualEditBurstCount')) }}</strong></div>
                <div class="metric-box"><span>Agent Edits</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'manualAgentEditCount')) }}</strong></div>
                <div class="metric-box"><span>Option Edits</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'manualOptionEditCount')) }}</strong></div>
                <div class="metric-box"><span>Direct Editing</span><strong>{{ formatNumber(getSummaryMetric(detailSummary, 'directEditingIntensity')) }}</strong></div>
              </div>
            </a-card>
            <a-card title="Final vs AI" class="panel-card" size="small">
              <div class="metric-grid">
                <div class="metric-box"><span>Modified States</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'modifiedStateCount')) }}</strong></div>
                <div class="metric-box"><span>Modified Options</span><strong>{{ formatCount(getSummaryMetric(detailSummary, 'modifiedOptionCount')) }}</strong></div>
                <div class="metric-box"><span>Avg State Modification</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'stateTextModificationRatio')) }}</strong></div>
                <div class="metric-box"><span>Avg Option Modification</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'optionTextModificationRatio')) }}</strong></div>
                <div class="metric-box"><span>Final Text Modification</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'finalTextModificationRatio')) }}</strong></div>
                <div class="metric-box"><span>Structure Change</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'structureChangeRatio')) }}</strong></div>
                <div class="metric-box"><span>Final vs AI</span><strong>{{ formatPercent(getSummaryMetric(detailSummary, 'finalVsAiDistance')) }}</strong></div>
              </div>
            </a-card>
          </div>

          <a-card class="panel-card detail-card" title="Available Snapshots" size="small">
            <div v-if="selectedSessionDetail.snapshots.length" class="snapshot-list">
              <div v-for="snapshot in selectedSessionDetail.snapshots" :key="snapshot.id" class="snapshot-item">
                <span>{{ snapshot.id }}</span>
                <span>{{ formatDateTime(snapshot.savedAt) }}</span>
              </div>
            </div>
            <a-empty v-else description="No saved snapshots yet." />
          </a-card>

          <a-card class="panel-card detail-card" title="Graph Overview" size="small">
            <div v-if="detailGraphTopics.length" class="graph-topic-list">
              <div v-for="topic in detailGraphTopics" :key="topic.name" class="graph-topic-item">
                <div>
                  <strong>{{ topic.name }}</strong>
                  <span>{{ topic.stateCount }} states · {{ topic.optionCount }} options · {{ topic.jumpCount }} jumps</span>
                </div>
                <small>{{ topic.cellCount }} cells</small>
              </div>
            </div>
            <a-empty v-else description="No graph data saved yet." />
          </a-card>

          <a-card class="panel-card detail-card" title="Latest Summary JSON" size="small">
            <pre class="json-preview">{{ prettyJson(detailSummary) }}</pre>
          </a-card>
        </template>
      </a-drawer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { clearAdminMonitorPassword, getAdminMonitorPassword, setAdminMonitorPassword } from '@/services/adminMonitor'
import { requestAiHealth, type AiHealthResponse } from '@/services/aiOrchestrator'
import { requestR2JHealth, type R2JHealthResponse } from '@/services/r2j'
import {
  requestWorkspaceAdminSessionDetail,
  requestWorkspaceAdminSessions,
  requestWorkspaceAdminSummary,
  type WorkspaceAdminSessionDetailResponse,
  type WorkspaceAdminSessionSummary,
  type WorkspaceAdminSummaryResponse,
} from '@/services/workspaceStorage'

type SessionRow = WorkspaceAdminSessionSummary & { rowKey: string }
const REFRESH_INTERVAL_MS = 5000

const authLoading = ref(false)
const dashboardLoading = ref(false)
const dashboardError = ref('')
const authError = ref('')
const adminPasswordInput = ref('')
const adminPassword = ref(getAdminMonitorPassword())
const summary = ref<WorkspaceAdminSummaryResponse | null>(null)
const sessions = ref<SessionRow[]>([])
const aiHealth = ref<AiHealthResponse | null>(null)
const r2jHealth = ref<R2JHealthResponse | null>(null)
const detailDrawerOpen = ref(false)
const selectedSessionDetail = ref<WorkspaceAdminSessionDetailResponse | null>(null)
let refreshTimer: number | null = null

const isAuthorized = computed(() => adminPassword.value.trim().length > 0)
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const detailSummary = computed(() => (selectedSessionDetail.value?.summary?.latestSummary as Record<string, unknown> | null) || null)
const detailGraphTopics = computed(() => {
  const snapshot = selectedSessionDetail.value?.snapshot as Record<string, unknown> | undefined
  const convertWorkspace = asRecord(snapshot?.convertWorkspace)
  const generationState = asRecord(snapshot?.generationState)
  const topicGraph = Array.isArray(convertWorkspace.topicGraph)
    ? convertWorkspace.topicGraph
    : Array.isArray(generationState.topicGraph)
      ? generationState.topicGraph
      : []

  return topicGraph
    .map((entry): { name: string; cellCount: number; stateCount: number; optionCount: number; jumpCount: number } | null => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) {
        return null
      }
      const cells = entry[1] as Array<{ shape?: unknown }>
      return {
        name: entry[0],
        cellCount: cells.length,
        stateCount: cells.filter((cell) => cell?.shape === 'stage-node').length,
        optionCount: cells.filter((cell) => cell?.shape === 'option-node').length,
        jumpCount: cells.filter((cell) => cell?.shape === 'jump-node').length,
      }
    })
    .filter((entry): entry is { name: string; cellCount: number; stateCount: number; optionCount: number; jumpCount: number } => Boolean(entry))
})

const sessionColumns = [
  { title: 'User', dataIndex: 'userName', key: 'userName' },
  { title: 'Workspace', dataIndex: 'workspaceId', key: 'workspaceId' },
  { title: 'Presence', key: 'presence' },
  { title: 'Mode', dataIndex: 'authoringMode', key: 'authoringMode' },
  { title: 'View', key: 'currentView' },
  { title: 'Current Topic', key: 'currentTopic' },
  { title: 'Topics', dataIndex: 'topicCount', key: 'topicCount' },
  { title: 'States', dataIndex: 'stateCount', key: 'stateCount' },
  { title: 'AI Wait', key: 'aiWaitRatio' },
  { title: 'Final vs AI', key: 'finalVsAiDistance' },
  { title: 'Saved', dataIndex: 'savedAt', key: 'savedAt' },
  { title: 'Last Activity', dataIndex: 'lastActivityAt', key: 'lastActivityAt' },
]

const toFiniteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const getSummaryMetric = (summaryValue: unknown, metricName: string) => {
  const record = asRecord(summaryValue)
  const direct = toFiniteNumber(record[metricName])
  if (direct !== null) return direct
  return toFiniteNumber(asRecord(record.currentGraph)[metricName])
}
const average = (values: Array<number | null | undefined>) => {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : null
}

const aggregated = computed(() => {
  const summaries = sessions.value
    .map((entry) => entry.latestSummary)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
  return {
    avgSessionDurationMinutes: average(summaries.map((entry) => (getSummaryMetric(entry, 'sessionDurationMs') ?? 0) / 60000)),
    avgEffectiveEditingMinutes: average(summaries.map((entry) => (getSummaryMetric(entry, 'effectiveEditingDurationMs') ?? 0) / 60000)),
    avgTimeToPreviewMinutes: average(summaries.map((entry) => {
      const value = getSummaryMetric(entry, 'timeToFirstPreviewMs')
      return value === null ? null : value / 60000
    })),
    avgAiWaitRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'aiWaitRatio'))),
    avgSuggestionAcceptanceRate: average(summaries.map((entry) => getSummaryMetric(entry, 'suggestionAcceptanceRate'))),
    avgAiAcceptanceRate: average(summaries.map((entry) => getSummaryMetric(entry, 'aiAcceptanceRate'))),
    avgAiContributionRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'aiContributionRatio'))),
    avgTopicRegenerateCount: average(summaries.map((entry) => getSummaryMetric(entry, 'topicRegenerateCount'))),
    avgStateRewriteRequestCount: average(summaries.map((entry) => getSummaryMetric(entry, 'stateRewriteRequestCount'))),
    avgStateRewritePromptCount: average(summaries.map((entry) => getSummaryMetric(entry, 'stateRewritePromptCount'))),
    avgStateRewritePromptChars: average(summaries.map((entry) => getSummaryMetric(entry, 'avgStateRewritePromptChars'))),
    avgDirectEditingIntensity: average(summaries.map((entry) => getSummaryMetric(entry, 'directEditingIntensity'))),
    avgOverwriteRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'overwriteRatio'))),
    avgModifiedStateCount: average(summaries.map((entry) => getSummaryMetric(entry, 'modifiedStateCount'))),
    avgModifiedOptionCount: average(summaries.map((entry) => getSummaryMetric(entry, 'modifiedOptionCount'))),
    avgFinalTextModificationRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'finalTextModificationRatio'))),
    avgStateTextModificationRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'stateTextModificationRatio'))),
    avgOptionTextModificationRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'optionTextModificationRatio'))),
    avgStructureChangeRatio: average(summaries.map((entry) => getSummaryMetric(entry, 'structureChangeRatio'))),
    avgFinalVsAiDistance: average(summaries.map((entry) => getSummaryMetric(entry, 'finalVsAiDistance'))),
    avgStateCount: average(summaries.map((entry) => getSummaryMetric(entry, 'stateCount'))),
    avgOptionCount: average(summaries.map((entry) => getSummaryMetric(entry, 'optionCount'))),
    avgMaxDepth: average(summaries.map((entry) => getSummaryMetric(entry, 'maxDepth'))),
    avgBranchingFactor: average(summaries.map((entry) => getSummaryMetric(entry, 'branchingFactorAvg'))),
  }
})

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'n/a' : parsed.toLocaleString()
}
const formatNumber = (value: number | null | undefined, digits = 2) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'n/a')
const formatCount = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100) / 100}` : 'n/a')
const formatMinutes = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} min` : 'n/a')
const formatMsAsMinutes = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? `${(value / 60000).toFixed(1)} min` : 'n/a')
const formatPercent = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a')
const prettyJson = (value: unknown) => JSON.stringify(value ?? null, null, 2)

const hydrateSessions = (items: WorkspaceAdminSessionSummary[]) => {
  sessions.value = items.map((item) => ({ ...item, rowKey: `${item.userName || 'unknown'}::${item.workspaceId || 'default'}` }))
}
const isAdminAuthError = (error: unknown) => (error as { response?: { status?: unknown } })?.response?.status === 401
const getAuthOptions = () => ({ adminPassword: adminPassword.value })
const resetDashboardState = () => {
  summary.value = null
  sessions.value = []
  aiHealth.value = null
  r2jHealth.value = null
  selectedSessionDetail.value = null
  detailDrawerOpen.value = false
}

const loadHealth = async () => {
  const [nextAiHealth, nextR2jHealth] = await Promise.allSettled([requestAiHealth(), requestR2JHealth()])
  aiHealth.value = nextAiHealth.status === 'fulfilled' ? nextAiHealth.value : { ok: false, service: 'Unavailable' }
  r2jHealth.value = nextR2jHealth.status === 'fulfilled' ? nextR2jHealth.value : { ok: false, service: 'Unavailable' }
}

const refreshOpenSessionDetail = async () => {
  const current = selectedSessionDetail.value
  if (!detailDrawerOpen.value || !current?.userName) {
    return
  }

  try {
    selectedSessionDetail.value = await requestWorkspaceAdminSessionDetail(
      { userName: current.userName, workspaceId: current.workspaceId },
      getAuthOptions(),
    )
  } catch (error) {
    if (isAdminAuthError(error)) {
      onLockAdmin(false)
      authError.value = 'The admin password expired. Enter it again to continue.'
    }
  }
}

const loadDashboard = async (options: { silent?: boolean } = {}) => {
  if (!isAuthorized.value) return
  if (!options.silent) {
    dashboardLoading.value = true
  }
  dashboardError.value = ''
  try {
    const [summaryResponse, sessionsResponse] = await Promise.all([
      requestWorkspaceAdminSummary(getAuthOptions()),
      requestWorkspaceAdminSessions(getAuthOptions()),
      loadHealth(),
    ])
    summary.value = summaryResponse
    hydrateSessions(sessionsResponse.sessions || [])
    await refreshOpenSessionDetail()
  } catch (error) {
    if (isAdminAuthError(error)) {
      onLockAdmin(false)
      authError.value = 'The admin password is incorrect.'
      return
    }
    dashboardError.value = error instanceof Error ? error.message : 'Failed to load admin monitor.'
  } finally {
    if (!options.silent) {
      dashboardLoading.value = false
    }
  }
}

const onUnlockAdmin = async () => {
  const nextPassword = adminPasswordInput.value.trim()
  if (!nextPassword.length) {
    authError.value = 'Enter the admin password to continue.'
    return
  }
  authLoading.value = true
  authError.value = ''
  try {
    const nextSummary = await requestWorkspaceAdminSummary({ adminPassword: nextPassword })
    adminPassword.value = nextPassword
    setAdminMonitorPassword(nextPassword)
    summary.value = nextSummary
    adminPasswordInput.value = ''
    await loadDashboard()
    message.success('Admin monitor unlocked.')
  } catch (error) {
    authError.value = isAdminAuthError(error) ? 'Incorrect password. Please try again.' : error instanceof Error ? error.message : 'Failed to unlock admin monitor.'
  } finally {
    authLoading.value = false
  }
}

const onLockAdmin = (showMessage = true) => {
  clearAdminMonitorPassword()
  adminPassword.value = ''
  adminPasswordInput.value = ''
  authError.value = ''
  dashboardError.value = ''
  resetDashboardState()
  if (showMessage) message.success('Admin monitor locked.')
}

const onRefresh = async () => {
  await loadDashboard()
  message.success('Admin monitor refreshed.')
}

const openSessionDetail = async (record: SessionRow) => {
  detailDrawerOpen.value = true
  selectedSessionDetail.value = null
  try {
    selectedSessionDetail.value = await requestWorkspaceAdminSessionDetail(
      { userName: record.userName, workspaceId: record.workspaceId },
      getAuthOptions(),
    )
  } catch (error) {
    if (isAdminAuthError(error)) {
      onLockAdmin(false)
      authError.value = 'The admin password expired. Enter it again to continue.'
      return
    }
    message.error(error instanceof Error ? error.message : 'Failed to load session detail.')
    detailDrawerOpen.value = false
  }
}

const buildSessionRowProps = (record: SessionRow) => ({ onClick: () => void openSessionDetail(record), style: { cursor: 'pointer' } })

onMounted(() => {
  if (adminPassword.value.trim().length) void loadDashboard()
  if (typeof window !== 'undefined') {
    refreshTimer = window.setInterval(() => {
      if (adminPassword.value.trim().length) void loadDashboard({ silent: true })
    }, REFRESH_INTERVAL_MS)
  }
})

onBeforeUnmount(() => {
  if (refreshTimer !== null && typeof window !== 'undefined') window.clearInterval(refreshTimer)
})
</script>

<style scoped lang="scss">
.admin-monitor { padding: 24px; height: 100%; overflow: auto; background: radial-gradient(circle at top left, rgba(98,141,255,.12), transparent 34%), linear-gradient(180deg,#f5f8ff 0%,#fff 24%); }
.gate-shell { min-height: 100%; display:flex; align-items:center; justify-content:center; }
.gate-card,.hero-card,.panel-card { border-radius: 18px; border: 1px solid #dbe6ff; box-shadow: 0 16px 42px rgba(19,47,77,.07); }
.gate-card { width:min(520px,100%); }
.eyebrow { display:inline-flex; padding:6px 12px; border-radius:999px; background:#e9f1ff; color:#3568c9; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
.gate-card h1,.admin-header h1 { margin:10px 0 8px; font-size:34px; font-weight:800; color:#16314f; }
.gate-card p,.admin-header p { margin:0; color:#617b95; font-size:15px; line-height:1.65; }
.gate-alert,.admin-alert { margin-bottom:16px; }
.admin-header { display:flex; justify-content:space-between; gap:24px; margin-bottom:20px; }
.hero-grid,.metrics-grid,.health-grid,.detail-grid { display:grid; gap:16px; }
.hero-grid { grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); margin-bottom:18px; }
.metrics-grid { grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); margin-bottom:18px; }
.health-grid { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); margin-bottom:18px; }
.detail-grid { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); margin-top:16px; }
.label { color:#69809b; font-size:12px; text-transform:uppercase; letter-spacing:.06em; font-weight:700; }
.value { margin-top:12px; font-size:36px; font-weight:800; color:#17324d; }
.value.small { font-size:18px; line-height:1.45; }
.metric-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.metric-box { padding:14px; border-radius:14px; background:linear-gradient(180deg,#f8fbff 0%,#fff 100%); border:1px solid #e3ecfb; }
.metric-box span { display:block; color:#70859d; font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
.metric-box strong { font-size:24px; font-weight:800; color:#18314b; }
.health-row { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700; }
.health-meta { margin-top:10px; color:#67809a; font-size:13px; }
.refresh-note { color:#67809a; font-size:12px; font-weight:700; }
.detail-card { margin-top:16px; }
.snapshot-list { display:flex; flex-direction:column; gap:8px; }
.snapshot-item { display:flex; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #d9e3f0; border-radius:10px; background:#f8fbff; font-size:13px; color:#23405e; }
.graph-topic-list { display:flex; flex-direction:column; gap:8px; }
.graph-topic-item { display:flex; justify-content:space-between; gap:12px; padding:10px 12px; border:1px solid #d9e3f0; border-radius:10px; background:#f8fbff; color:#23405e; }
.graph-topic-item div { display:flex; flex-direction:column; gap:4px; min-width:0; }
.graph-topic-item strong { overflow-wrap:anywhere; }
.graph-topic-item span,.graph-topic-item small { color:#67809a; font-size:12px; }
.json-preview { margin:0; max-height:320px; overflow:auto; white-space:pre-wrap; word-break:break-word; font-size:12px; line-height:1.5; color:#16314f; }
@media (max-width: 1200px) { .metric-grid { grid-template-columns:1fr; } }
</style>
