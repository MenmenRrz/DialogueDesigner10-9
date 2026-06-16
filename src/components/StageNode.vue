<template>
  <div
    ref="stageRootEl"
    class="stage-node"
    data-tour="state-node"
    :class="{
      'is-preview-active': previewActive,
      'is-subtopic-active': subtopicActive,
      'is-relation-active': relationActive,
      'is-relation-dim': relationDim,
    }"
    :style="stateThemeStyle"
  >
    <div class="title-row">
      <h3 class="name" data-tour="state-title" v-if="status === 'view'" @dblclick="onEdit()">{{ name }}</h3>
      <a-input
        class="title-input"
        v-model:value="name"
        v-if="status === 'edit'"
        :placeholder="stateNamePlaceholder"
        @pressEnter="onEditOk()"
        @blur="onEditOk()"
      />
      <a-tooltip title="preview from this state">
        <a-button
          type="text"
          size="small"
          class="btn-preview"
          data-tour="state-preview"
          :icon="h(PlayCircleOutlined)"
          @click="onPreviewFromState"
        />
      </a-tooltip>
      <a-popover
        v-if="!isManualAuthoringMode"
        v-model:open="rewritePanelOpen"
        trigger="click"
        placement="rightTop"
        overlay-class-name="state-rewrite-popover"
      >
        <template #content>
          <div class="rewrite-panel">
            <div class="rewrite-title">AI State Optimizer</div>
            <a-textarea
              v-model:value="rewriteInstruction"
              :rows="3"
              placeholder="Describe how you want to revise this state..."
              :maxlength="600"
              show-count
            />
            <a-button
              block
              type="primary"
              size="small"
              class="rewrite-generate"
              :loading="rewriteLoading"
              @click="onGenerateRewrite"
            >
              Generate Rewrite
            </a-button>
            <a-alert
              v-if="rewriteError"
              type="error"
              :message="rewriteError"
              show-icon
              class="rewrite-alert"
            />
            <div v-if="rewriteCandidate" class="rewrite-result">
              <div class="rewrite-result-title">Proposed AGENT text</div>
              <a-textarea v-model:value="rewriteCandidate" :rows="5" />
              <div class="rewrite-actions">
                <a-button size="small" @click="onClearRewriteCandidate">Clear</a-button>
                <a-button size="small" type="primary" @click="onApplyRewrite">Apply</a-button>
              </div>
            </div>
          </div>
        </template>
        <a-tooltip title="rewrite this state with AI">
          <a-button
            type="text"
            size="small"
            class="btn-ai-rewrite"
            :icon="h(EditOutlined)"
          />
        </a-tooltip>
      </a-popover>
    </div>
    <div class="meta-row">
      <template v-if="isManualAuthoringMode">
        <a-select
          class="meta-select meta-select-subtopic"
          size="small"
          v-model:value="subtopic"
          :options="manualSubtopicOptions"
          placeholder="Choose subtopic"
          :dropdownMatchSelectWidth="false"
        />
        <a-select
          class="meta-select meta-select-mi"
          size="small"
          v-model:value="miTechnique"
          :options="manualMiTechniqueOptions"
          placeholder="Choose MI"
          :dropdownMatchSelectWidth="false"
        />
        <a-popover trigger="click" placement="topRight" overlay-class-name="mi-technique-popover">
          <template #content>
            <div class="mi-technique-content">
              <div class="mi-technique-name">{{ miTechniqueLabel }}</div>
              <div class="mi-technique-desc">{{ miTechniqueDescription }}</div>
            </div>
          </template>
          <a-button
            type="text"
            size="small"
            class="mi-help-button"
            :icon="h(QuestionCircleOutlined)"
          >
            MI help
          </a-button>
        </a-popover>
      </template>
      <template v-else>
        <a-popover trigger="click" placement="topLeft" overlay-class-name="subtopic-popover">
          <template #content>
            <div class="subtopic-content">
              <div class="subtopic-name">{{ subtopicLabel }}</div>
              <div class="subtopic-desc">{{ subtopicDescription }}</div>
            </div>
          </template>
          <a-tooltip title="Click for subtopic details">
            <a-tag class="meta-chip subtopic-chip">{{ subtopicLabel }}</a-tag>
          </a-tooltip>
        </a-popover>
        <a-popover trigger="click" placement="top" overlay-class-name="mi-technique-popover">
          <template #content>
            <div class="mi-technique-content">
              <div class="mi-technique-name">{{ miTechniqueLabel }}</div>
              <div class="mi-technique-desc">{{ miTechniqueDescription }}</div>
            </div>
          </template>
          <a-tooltip title="Click for MI technique details">
            <a-tag class="meta-chip mi-chip">MI: {{ miTechniqueLabel }}</a-tag>
          </a-tooltip>
        </a-popover>
      </template>
      <a-tag v-if="isTopicStartState" class="meta-chip role-chip">Topic Start</a-tag>
    </div>
    <a-textarea
      class="agent"
      data-tour="state-agent-text"
      v-model:value="agent"
      :placeholder="agentPlaceholder"
      @focus="onAgentEditFocus"
      @input="onAgentEditInput"
      @blur="onAgentEditBlur"
    />
    <a-button v-if="!isManualAuthoringMode" type="primary" class="btn-suggest" data-tour="suggest-options" @click="onSuggest()">suggest options</a-button>
    <ul ref="menuListEl" class="menus" data-tour="state-options">
      <li :key="index" class="menu-item" v-for="(item, index) in list">
        <a-popconfirm
          title="Are you sure delete this option?"
          ok-text="Yes"
          cancel-text="No"
          @confirm="onDel(index)"
        >
          <i class="icon-del"><MinusCircleTwoTone twoToneColor="red" /></i>
        </a-popconfirm>
      </li>
    </ul>
    <a-tooltip title="add option">
      <a-button
        type="primary"
        shape="circle"
        size="small"
        data-tour="add-option"
        :icon="h(PlusOutlined)"
        @click="onAddOption('', 'edit')"
      />
    </a-tooltip>
  </div>
  <a-modal
    v-if="isModalHost && !isManualAuthoringMode"
    v-model:open="newOptionModalShow"
    title="suggest options"
    @ok="onAddNewOptions"
  >
    <a-textarea
      :rows="4"
      v-model:value="mentorDirections"
      @change="onChangeMentorDirections"
    ></a-textarea>
    <a-button
      style="margin-top: 8px"
      type="primary"
      :loading="querySuggestOptionsLoading"
      @click="onQuerySuggestOptions"
      >query</a-button
    >
    <div v-if="suggestionForms.length" class="suggestion-list">
      <div v-for="entry in suggestionForms" :key="entry.id" class="suggestion-item">
        <div class="suggestion-header">
          <a-checkbox v-model:checked="entry.selected">{{ entry.option }}</a-checkbox>
        </div>
        <div class="suggestion-body">
          <a-select
            v-model:value="entry.selectedState"
            :options="getStateOptions(entry)"
            placeholder="Select a state"
            allow-clear
            class="state-select"
            :dropdownMatchSelectWidth="false"
          />
          <div v-if="entry.selectedState" class="state-preview">
            <div class="state-preview-title">{{ getStateLabel(entry.selectedState) }}</div>
            <div class="state-preview-agent">{{ getStateAgent(entry.selectedState) }}</div>
          </div>
        </div>
      </div>
    </div>
    <a-empty v-else />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, h, watch } from 'vue'
import {
  PlusOutlined,
  MinusCircleTwoTone,
  PlayCircleOutlined,
  EditOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons-vue'
import { message as msgSrv } from 'ant-design-vue'
import { useDesignerStore } from '@/stores/designer'
import { storeToRefs } from 'pinia'
import { v4 as uuidV4 } from 'uuid'
import type { Cell } from '@antv/x6'
import { parseAiTaskError, requestAiTask } from '@/services/aiOrchestrator'
import { buildTopicScriptFromCells } from '@/utils/topicScript'
import { sanitizeMenuTitle } from '@/utils/menuText'
import { stripCrossTopicArtifacts } from '@/utils/crossTopicJumps'
import { compareFlowOrder } from '@/utils/flowOrder'
import { DEFAULT_STATE_PALETTE, paletteByIndex } from '@/utils/statePalette'
import {
  STAGE_NODE_OPTION_ITEM_HEIGHT,
  STAGE_NODE_OPTION_ITEM_LEFT,
  STAGE_NODE_OPTION_ITEM_WIDTH,
  STAGE_NODE_TOP_CONTENT_HEIGHT,
  STAGE_NODE_WIDTH,
  calcStageNodeHeight,
} from '@/constants/stageLayout'

type MenuItem = {
  id: string
  title: string
  status: string
  nextStage?: string
}

type ParsedSuggestion = {
  raw: string
  option: string
  nextState: string
}

type SuggestionFormEntry = {
  id: string
  raw: string
  option: string
  suggestedState: string
  selected: boolean
  selectedState: string | null
}

type StageInfo = {
  id: string
  name: string
  agent: string
}

type StateRewriteOutput = {
  agent?: string
}

const MI_TECHNIQUE_HELP: Array<{ keywords: string[]; description: string }> = [
  {
    keywords: ['open question', 'open-ended', 'open ended', 'open_question'],
    description: 'Open Question: invites the user to elaborate in their own words and broadens exploration.',
  },
  {
    keywords: ['affirmation', 'affirm'],
    description: 'Affirmation: recognizes effort or strengths to support confidence and engagement.',
  },
  {
    keywords: ['reflective listening', 'reflection', 'reflective'],
    description: 'Reflective Listening: mirrors meaning or emotion to show understanding and reduce resistance.',
  },
  {
    keywords: ['summary', 'summarize', 'bridge'],
    description: 'Summary: consolidates key points and creates a clear transition to the next step.',
  },
  {
    keywords: ['evoke', 'elicit', 'change talk'],
    description: "Evocation: draws out the user's own reasons, goals, and motivation for change.",
  },
]

const MANUAL_MI_TECHNIQUE_LABELS = [
  'Open Question',
  'Affirmation',
  'Reflective Listening',
  'Summary',
  'Change Talk',
  'Provide Information (Elicit-Provide-Elicit)',
  'Meta-Relational',
]

const NEW_STATE_PREFIX = '__new__:'

const props = defineProps<{
  node?: any
  graph?: any
}>()

const designerStore = useDesignerStore()
const {
  graph,
  convertContent,
  stateContent,
  topicGraphSelected,
  topicGraph,
  sessionTopics,
  api1Result,
  authoringMode,
  userName,
  newOptionModalShow,
  mentorDirections,
  newSuggestOptions,
  newSuggestOptionAgents,
  newSuggestOptionStateDrafts,
  querySuggestOptionsLoading,
  querySuggestOptionStageId,
} = storeToRefs(designerStore)
const {
  setNewOptionModalShow,
  setQuerySuggestOptionStageName,
  updateMentorDirections,
  querySuggestOptions,
  setNewSuggestOptions,
  setNewSuggestOptionAgents,
  setNewSuggestOptionStateDrafts,
  setQuerySuggestOptionStageId,
  updateSelectedGraphTopic,
  buildAuthoringContext,
  ensureTopicSubtopic,
  recordAnalyticsEvent,
  setAnalyticsStateTextBaseline,
  setAnalyticsStateOptionTextsBaseline,
} = designerStore

const name = ref('')
const agent = ref('')
const subtopic = ref('')
const miTechnique = ref('')
const list = ref<MenuItem[]>([])
const status = ref<'view' | 'edit'>('view')
const suggestionForms = ref<SuggestionFormEntry[]>([])
const previewActive = ref(false)
const subtopicActive = ref(false)
const relationActive = ref(false)
const relationDim = ref(false)
const isManualAuthoringMode = computed(() => authoringMode.value === 'manual')
const stateNamePlaceholder = computed(() =>
  isManualAuthoringMode.value
    ? 'Name this state. Eg welcome_user or explore_concerns'
    : 'State name',
)
const agentPlaceholder = computed(() =>
  isManualAuthoringMode.value
    ? "Write what the agent says here. Eg 'Thanks for sharing that. What would feel most helpful to talk through first?'"
    : '',
)
const rewritePanelOpen = ref(false)
const rewriteInstruction = ref('')
const rewriteCandidate = ref('')
const rewriteError = ref('')
const rewriteLoading = ref(false)
const agentEditBaseline = ref<string | null>(null)
const agentEditStartedAt = ref<number | null>(null)
const agentEditTimer = ref<number | null>(null)
const agentUpdateSource = ref<'manual' | 'ai' | 'system'>('manual')
const stageRootEl = ref<HTMLElement | null>(null)
const menuListEl = ref<HTMLElement | null>(null)

const nodeRef = ref<any>(props.node ?? null)
let stageLayoutObserver: ResizeObserver | null = null

const resolveNode = () => {
  if (nodeRef.value) {
    return nodeRef.value
  }
  const injected = typeof getNode === 'function' ? getNode() : getNode
  nodeRef.value = props.node ?? injected
  return nodeRef.value
}

const isModalHost = computed(() => {
  if (!nodeRef.value) {
    return false
  }
  return querySuggestOptionStageId.value === nodeRef.value.id
})

const subtopicLabel = computed(() => {
  const next = subtopic.value.trim()
  return next.length ? next : 'General'
})

const miTechniqueLabel = computed(() => {
  const next = miTechnique.value.trim()
  return next.length ? next : 'Unspecified'
})

const miTechniqueDescription = computed(() => {
  const normalized = miTechnique.value.trim().toLowerCase()
  if (!normalized.length) {
    return 'No MI strategy is tagged for this state yet.'
  }

  const match = MI_TECHNIQUE_HELP.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword)),
  )
  return (
    match?.description ||
    'This MI tag guides tone and response style for this state. Click apply after reviewing rewrite suggestions.'
  )
})

const normalizePlanKey = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')

const subtopicDescription = computed(() => {
  const currentSubtopic = subtopic.value.trim()
  const currentTopic = String(topicGraphSelected.value || '').trim()
  if (!currentSubtopic.length) {
    return 'No subtopic description is available for this state yet.'
  }

  const normalizedTopic = normalizePlanKey(currentTopic)
  const normalizedSubtopic = normalizePlanKey(currentSubtopic)

  for (const session of sessionTopics.value) {
    const topic = session.topics.find(
      (entry) => normalizePlanKey(entry.topicName) === normalizedTopic,
    )
    const match = topic?.list.find((entry) => normalizePlanKey(entry.name) === normalizedSubtopic)
    if (match) {
      const detail = String(match.brief || match.prompt || match.miTechnique || '').trim()
      if (detail.length) {
        return detail
      }
    }
  }

  const fallbackEntries = Array.isArray(api1Result.value?.all_topics?.[currentTopic])
    ? api1Result.value?.all_topics?.[currentTopic]
    : []
  for (const entry of fallbackEntries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const nameValue = 'name' in entry ? String((entry as { name?: unknown }).name || '') : ''
    if (normalizePlanKey(nameValue) !== normalizedSubtopic) {
      continue
    }
    const briefValue =
      'brief' in entry ? String((entry as { brief?: unknown }).brief || '') : ''
    const miValue =
      'miTechnique' in entry ? String((entry as { miTechnique?: unknown }).miTechnique || '') : ''
    const detail = [briefValue, miValue].map((value) => value.trim()).find((value) => value.length)
    if (detail) {
      return detail
    }
  }

  return 'No subtopic description is available for this state yet.'
})

const currentTopicSubtopicNames = computed(() => {
  const currentTopic = String(topicGraphSelected.value || '').trim()
  const normalizedTopic = normalizePlanKey(currentTopic)
  const names: string[] = []
  const seen = new Set<string>()

  const addName = (value: unknown) => {
    const nextName = String(value || '').trim()
    const nextKey = normalizePlanKey(nextName)
    if (!nextName.length || seen.has(nextKey)) {
      return
    }
    seen.add(nextKey)
    names.push(nextName)
  }

  for (const session of sessionTopics.value) {
    const topic = session.topics.find(
      (entry) => normalizePlanKey(entry.topicName) === normalizedTopic,
    )
    topic?.list?.forEach((entry) => addName(entry.name))
  }

  const fallbackEntries = Array.isArray(api1Result.value?.all_topics?.[currentTopic])
    ? api1Result.value?.all_topics?.[currentTopic]
    : []
  fallbackEntries.forEach((entry) => {
    if (!entry) {
      return
    }
    if (typeof entry === 'string') {
      addName(entry)
      return
    }
    if (typeof entry === 'object' && 'name' in entry) {
      addName((entry as { name?: unknown }).name)
    }
  })

  return names
})

const stateThemeStyle = computed(() => {
  const normalizedSubtopic = subtopic.value.trim()
  const subtopicIndex = currentTopicSubtopicNames.value.findIndex(
    (entry) => normalizePlanKey(entry) === normalizePlanKey(normalizedSubtopic),
  )
  const palette = normalizedSubtopic.length ? paletteByIndex(subtopicIndex) : DEFAULT_STATE_PALETTE
  return {
    '--state-bg': palette.bg,
    '--state-border': palette.border,
    '--state-accent': palette.accent,
    '--state-glow': palette.glow,
  }
})

const currentTopicName = computed(() => String(topicGraphSelected.value || '').trim())

const currentTopicGraphCells = computed<Cell.Properties[]>(() => {
  const topicName = currentTopicName.value
  if (!topicName.length) {
    return []
  }

  const cells = graph.value?.toJSON?.().cells
  if (Array.isArray(cells) && cells.length) {
    return cells as Cell.Properties[]
  }

  const stored = topicGraph.value.get(topicName)
  return Array.isArray(stored) ? stored : []
})

const currentTopicScriptBuild = computed(() => {
  const topicName = currentTopicName.value
  const cells = currentTopicGraphCells.value
  if (!topicName.length || !cells.length) {
    return null
  }

  try {
    return buildTopicScriptFromCells(topicName, stripCrossTopicArtifacts(cells))
  } catch {
    return null
  }
})

const currentStateName = computed(() => name.value.trim())

const manualSubtopicOptions = computed(() => {
  const options = new Map<string, { label: string; value: string }>()

  options.set('', { label: 'General', value: '' })

  const currentTopic = currentTopicName.value
  const normalizedTopic = normalizePlanKey(currentTopic)

  sessionTopics.value.forEach((session) => {
    const topic = session.topics.find((entry) => normalizePlanKey(entry.topicName) === normalizedTopic)
    topic?.list?.forEach((entry) => {
      const nextName = String(entry.name || '').trim()
      if (!nextName.length || options.has(nextName)) {
        return
      }
      options.set(nextName, {
        label: nextName,
        value: nextName,
      })
    })
  })

  const fallbackEntries = Array.isArray(api1Result.value?.all_topics?.[currentTopic])
    ? api1Result.value?.all_topics?.[currentTopic]
    : []

  fallbackEntries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return
    }
    const nextName = 'name' in entry ? String((entry as { name?: unknown }).name || '').trim() : ''
    if (!nextName.length || options.has(nextName)) {
      return
    }
    options.set(nextName, {
      label: nextName,
      value: nextName,
    })
  })

  const currentValue = subtopic.value.trim()
  if (currentValue.length && !options.has(currentValue)) {
    options.set(currentValue, {
      label: currentValue,
      value: currentValue,
    })
  }

  return Array.from(options.values())
})

const manualMiTechniqueOptions = computed(() => {
  const options = [{ label: 'MI: Unspecified', value: '' }]
  MANUAL_MI_TECHNIQUE_LABELS.forEach((label) => {
    options.push({
      label: `MI: ${label}`,
      value: label,
    })
  })
  return options
})

const sortTopicStageCells = (stages: Cell.Properties[]) =>
  [...stages].sort((a, b) => {
    const flowOrderComparison = compareFlowOrder((a as any)?.data?.flowOrder, (b as any)?.data?.flowOrder)
    if (flowOrderComparison !== 0) return flowOrderComparison
    const ay = typeof a.position?.y === 'number' ? a.position.y : 0
    const by = typeof b.position?.y === 'number' ? b.position.y : 0
    if (ay !== by) return ay - by
    const ax = typeof a.position?.x === 'number' ? a.position.x : 0
    const bx = typeof b.position?.x === 'number' ? b.position.x : 0
    if (ax !== bx) return ax - bx
    return 0
  })

const explicitTopicStartStageId = computed(() => {
  const stages = sortTopicStageCells(
    currentTopicGraphCells.value.filter((entry) => entry.shape === 'stage-node'),
  )
  const explicit = stages.find((entry: any) => Boolean(entry?.data?.isTopicStart))
  return typeof explicit?.id === 'string' ? explicit.id : null
})

const currentTopicStartStageId = computed(() => {
  if (explicitTopicStartStageId.value) {
    return explicitTopicStartStageId.value
  }

  const stages = sortTopicStageCells(
    currentTopicGraphCells.value.filter((entry) => entry.shape === 'stage-node'),
  )
  if (!stages.length) {
    return null
  }

  const stageIds = new Set(
    stages
      .map((entry) => (typeof entry.id === 'string' ? entry.id : ''))
      .filter((entry) => entry.length > 0),
  )
  const incomingCounts = new Map<string, number>()
  stageIds.forEach((id) => incomingCounts.set(id, 0))

  currentTopicGraphCells.value
    .filter((entry) => entry.shape === 'edge')
    .forEach((edge) => {
      const target =
        typeof (edge as any)?.target?.cell === 'string'
          ? (edge as any).target.cell
          : typeof (edge as any)?.target?.cell?.id === 'string'
            ? (edge as any).target.cell.id
            : ''
      if (!stageIds.has(target)) {
        return
      }
      incomingCounts.set(target, (incomingCounts.get(target) || 0) + 1)
    })

  const rootStage = stages.find((entry) => {
    const id = typeof entry.id === 'string' ? entry.id : ''
    return id.length > 0 && (incomingCounts.get(id) || 0) === 0
  })

  return typeof rootStage?.id === 'string' ? rootStage.id : typeof stages[0]?.id === 'string' ? stages[0].id : null
})

const isTopicStartState = computed(() => {
  const node = resolveNode()
  const nodeData = node?.getData?.() ?? node?.data ?? {}
  if (explicitTopicStartStageId.value) {
    return Boolean(nodeData?.isTopicStart)
  }
  return node?.id === currentTopicStartStageId.value
})


const getNode = inject<any>('getNode')

watch(
  () => props.node,
  (val) => {
    if (val) {
      nodeRef.value = val
    }
  },
)

const getNodeChildren = (node: any): any[] => {
  if (!node) {
    return []
  }
  const children = typeof node.getChildren === 'function' ? node.getChildren() : node.children
  return Array.isArray(children) ? children : []
}

const OPTION_NODE_SHAPE = 'option-node'

const removeOptionNodeCompletely = (node: any, optionNode: any) => {
  if (!graph.value || !optionNode) {
    return
  }

  const connectedEdges =
    typeof graph.value.getConnectedEdges === 'function'
      ? graph.value.getConnectedEdges(optionNode) ?? []
      : []

  connectedEdges.forEach((edge: any) => {
    if (typeof edge?.remove === 'function') {
      edge.remove()
      return
    }

    if (typeof (graph.value as any)?.removeCell === 'function') {
      ;(graph.value as any).removeCell(edge)
    }
  })

  if (typeof node?.removeChild === 'function') {
    node.removeChild(optionNode)
  }

  if (typeof (graph.value as any)?.removeCell === 'function') {
    ;(graph.value as any).removeCell(optionNode)
    return
  }

  if (typeof optionNode.remove === 'function') {
    optionNode.remove()
  }
}

const getChildOptionIds = (node: any): string[] =>
  getNodeChildren(node)
    .map((child: any) => (typeof child?.id === 'string' ? child.id : ''))
    .filter((id: string) => id.length > 0)

const normalizeMenus = (menus: unknown, node?: any): MenuItem[] => {
  if (!Array.isArray(menus)) {
    return []
  }

  const childOptionIds = getChildOptionIds(node)

  return (menus as any[]).map((entry, index) => ({
    id:
      (typeof entry?.id === 'string' && entry.id.trim()) ||
      childOptionIds[index] ||
      uuidV4(),
    title:
      (entry?.status ?? 'view').toString() === 'edit'
        ? sanitizeMenuTitle(entry?.title, '')
        : sanitizeMenuTitle(entry?.title, 'new-option'),
    status: (entry?.status ?? 'view').toString(),
    nextStage: entry?.nextStage
      ? entry.nextStage.toString()
      : entry?.next_state?.toString?.() ?? '',
  }))
}

const syncNodeMenus = (node: any, menus: MenuItem[]) => {
  const nextMenus = menus.map((entry) => ({
    id: entry.id,
    title: entry.title,
    status: entry.status,
    nextStage: entry.nextStage,
  }))
  node.setData({
    ...node.getData(),
    menus: nextMenus,
  })
  if (node.data) {
    node.data.menus = nextMenus
  }
}

const shouldSyncNormalizedMenus = (rawMenus: unknown, normalizedMenus: MenuItem[]) => {
  if (!Array.isArray(rawMenus) || rawMenus.length !== normalizedMenus.length) {
    return normalizedMenus.length > 0
  }

  return normalizedMenus.some((menu, index) => {
    const raw = rawMenus[index] as any
    const rawNextStage = raw?.nextStage
      ? raw.nextStage.toString()
      : raw?.next_state?.toString?.() ?? ''

    return (
      raw?.id !== menu.id ||
      sanitizeMenuTitle(raw?.title, menu.status === 'edit' ? '' : 'new-option') !== menu.title ||
      (raw?.status ?? 'view').toString() !== menu.status ||
      rawNextStage !== (menu.nextStage ?? '')
    )
  })
}

const getGraphScale = () => {
  const graphInstance = props.graph ?? graph.value
  if (!graphInstance || typeof graphInstance.zoom !== 'function') {
    return 1
  }

  const scale = Number(graphInstance.zoom())
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

const measureMenuOffsetTop = () => {
  const stageRoot = stageRootEl.value
  const menuList = menuListEl.value
  if (!stageRoot || !menuList) {
    return null
  }

  const scale = getGraphScale()
  const stageRect = stageRoot.getBoundingClientRect()
  const firstMenuItem = menuList.querySelector('.menu-item') as HTMLElement | null
  const menuAnchorRect = (firstMenuItem ?? menuList).getBoundingClientRect()
  const measured = Math.round((menuAnchorRect.top - stageRect.top) / scale)
  return Number.isFinite(measured) && measured > 0 ? measured : null
}

const syncMeasuredLayout = () => {
  const node = resolveNode()
  const stageRoot = stageRootEl.value
  const menuList = menuListEl.value
  if (!node || !stageRoot || !menuList) {
    return
  }

  const measuredMenuOffsetTop = measureMenuOffsetTop() ?? STAGE_NODE_TOP_CONTENT_HEIGHT
  const measuredHeight = Math.max(
    calcStageNodeHeight(list.value.length),
    Math.ceil(Math.max(stageRoot.offsetHeight, stageRoot.scrollHeight)),
  )

  const currentData = node.getData?.() ?? node.data ?? {}
  const currentMenuOffsetTop = Number(currentData?.menuOffsetTop)
  const currentMeasuredHeight = Number(currentData?.measuredHeight)
  if (
    currentMenuOffsetTop === measuredMenuOffsetTop &&
    currentMeasuredHeight === measuredHeight
  ) {
    return
  }

  node.setData({
    ...currentData,
    menuOffsetTop: measuredMenuOffsetTop,
    measuredHeight,
  })
  if (node.data) {
    node.data.menuOffsetTop = measuredMenuOffsetTop
    node.data.measuredHeight = measuredHeight
  }
}

const stripWrappingQuotes = (value: string) => value.replace(/^['"]+/, '').replace(/['"]+$/, '')

const parseSuggestion = (raw: string): ParsedSuggestion => {
  const [optionPart, nextPart = ''] = raw
    .split(/=>|->/, 2)
    .map((segment) => segment.trim())
  return {
    raw,
    option: sanitizeMenuTitle(optionPart, ''),
    nextState: stripWrappingQuotes(nextPart),
  }
}

const parsedSuggestOptions = computed<ParsedSuggestion[]>(() =>
  newSuggestOptions.value
    .map((raw) => parseSuggestion(raw))
    .filter((entry) => entry.option.length > 0),
)

watch(agent, (value) => {
  const node = resolveNode()
  if (!node) return
  const currentAgent = (node.getData?.()?.agent ?? node.data?.agent ?? '').toString()
  if (currentAgent === value) {
    return
  }
  node.setData({
    ...node.getData(),
    agent: value,
  })
  if (node.data) {
    node.data.agent = value
  }
})

watch([subtopic, miTechnique], ([nextSubtopic, nextMiTechnique]) => {
  const node = resolveNode()
  if (!node) return

  const currentData = node.getData?.() ?? node.data ?? {}
  const currentSubtopic = (currentData?.subtopic ?? '').toString()
  const currentMiTechnique = (currentData?.miTechnique ?? '').toString()
  if (currentSubtopic === nextSubtopic && currentMiTechnique === nextMiTechnique) {
    return
  }

  node.setData({
    ...currentData,
    subtopic: nextSubtopic,
    miTechnique: nextMiTechnique,
  })

  if (node.data) {
    node.data.subtopic = nextSubtopic
    node.data.miTechnique = nextMiTechnique
  }
})

watch(
  () => [name.value, subtopic.value, miTechnique.value, list.value.length],
  () => {
    void nextTick(syncMeasuredLayout)
  },
)

const buildStageMaps = () => {
  const infos: StageInfo[] = []
  const nodes = graph.value?.getNodes?.() ?? []
  nodes
    .filter((node: any) => node.shape === 'stage-node')
    .forEach((node: any) => {
      infos.push({
        id: node.id,
        name: (node.data?.name ?? '').toString(),
        agent: (node.data?.agent ?? '').toString(),
      })
    })
  const byId = new Map<string, StageInfo>()
  const byName = new Map<string, StageInfo>()
  infos.forEach((info) => {
    byId.set(info.id, info)
    if (info.name) {
      byName.set(info.name, info)
    }
  })
  return { infos, byId, byName }
}

const makeNewStateValue = (name: string) => `${NEW_STATE_PREFIX}${name}`
const parseNewStateValue = (value: string | null | undefined) => {
  if (!value) return null
  if (value.startsWith(NEW_STATE_PREFIX)) {
    return value.slice(NEW_STATE_PREFIX.length)
  }
  return null
}

const clearAgentEditTimer = () => {
  if (typeof window === 'undefined' || agentEditTimer.value === null) {
    return
  }
  window.clearTimeout(agentEditTimer.value)
  agentEditTimer.value = null
}

const flushAgentEditCommit = () => {
  clearAgentEditTimer()
  if (agentUpdateSource.value !== 'manual') {
    agentEditBaseline.value = null
    agentEditStartedAt.value = null
    agentUpdateSource.value = 'manual'
    return
  }

  const baseline = agentEditBaseline.value
  const startedAt = agentEditStartedAt.value
  const currentValue = agent.value
  if (baseline === null || startedAt === null || baseline === currentValue) {
    agentEditBaseline.value = null
    agentEditStartedAt.value = null
    return
  }

  recordAnalyticsEvent('manual_text_edit_commit', 'manual', {
    topicName: (topicGraphSelected.value || '').trim(),
    stateName: (name.value || '').trim(),
    field: 'agent',
    durationMs: Math.max(0, Date.now() - startedAt),
    beforeLength: baseline.length,
    afterLength: currentValue.length,
    charDelta: currentValue.length - baseline.length,
  })

  agentEditBaseline.value = null
  agentEditStartedAt.value = null
}

const scheduleAgentEditCommit = () => {
  if (typeof window === 'undefined') {
    return
  }
  clearAgentEditTimer()
  agentEditTimer.value = window.setTimeout(() => {
    agentEditTimer.value = null
    flushAgentEditCommit()
  }, 2200)
}

const onAgentEditFocus = () => {
  if (agentUpdateSource.value !== 'manual') {
    return
  }
  if (agentEditBaseline.value === null) {
    agentEditBaseline.value = agent.value
    agentEditStartedAt.value = Date.now()
  }
}

const onAgentEditInput = () => {
  if (agentUpdateSource.value !== 'manual') {
    return
  }
  if (agentEditBaseline.value === null) {
    agentEditBaseline.value = agent.value
    agentEditStartedAt.value = Date.now()
  }
  scheduleAgentEditCommit()
}

const onAgentEditBlur = () => {
  flushAgentEditCommit()
}

watch(parsedSuggestOptions, (suggestions) => {
  const previous = new Map<string, SuggestionFormEntry>()
  suggestionForms.value.forEach((entry) => previous.set(entry.raw, entry))

  const { byId, byName } = buildStageMaps()

  suggestionForms.value = suggestions.map((suggestion, index) => {
    const existing = previous.get(suggestion.raw)
    const optionText = suggestion.option.trim()
    const suggestedState = suggestion.nextState.trim()
    const id = `${index}-${suggestion.raw}`

    const previousSelection = existing?.selectedState ?? null
    let selectedState: string | null = null

    if (previousSelection) {
      const previousNewState = parseNewStateValue(previousSelection)
      if (previousNewState) {
        if (!byName.has(previousNewState)) {
          selectedState = previousSelection
        } else {
          selectedState = byName.get(previousNewState)!.id
        }
      } else if (byId.has(previousSelection)) {
        selectedState = previousSelection
      }
    }

    if (!selectedState && suggestedState) {
      const normalized = suggestedState.trim()
      if (normalized && byName.has(normalized)) {
        selectedState = byName.get(normalized)!.id
      } else if (normalized) {
        selectedState = makeNewStateValue(normalized)
      }
    }

    return {
      id,
      raw: suggestion.raw,
      option: optionText,
      suggestedState,
      selected: existing?.selected ?? true,
      selectedState,
    }
  })
}, { immediate: true })

const onEdit = () => {
  status.value = 'edit'
}

const isDuplicateStateName = (nextName: string) => {
  const normalizedNext = normalizePlanKey(nextName)
  if (!normalizedNext.length) {
    return false
  }

  const currentNode = resolveNode()
  const currentNodeId = currentNode?.id
  return currentTopicGraphCells.value.some((entry) => {
    if (entry.shape !== 'stage-node') {
      return false
    }
    if (currentNodeId && entry.id === currentNodeId) {
      return false
    }
    const existingName = String((entry as { data?: { name?: unknown } }).data?.name ?? '').trim()
    return normalizePlanKey(existingName) === normalizedNext
  })
}

const onEditOk = () => {
  const nextName = name.value.trim()
  if (!nextName.length) {
    msgSrv.warning('State title is required. Each state needs a unique title.')
    status.value = 'edit'
    return
  }

  if (isDuplicateStateName(nextName)) {
    msgSrv.error(`State title "${nextName}" is already used in this topic. Please choose a unique title.`)
    status.value = 'edit'
    return
  }

  name.value = nextName
  status.value = 'view'
  const node = resolveNode()
  node.setData({
    ...node.getData(),
    name: nextName,
  })
  node.data.name = nextName
}

const getFirstPortId = (cell: any): string | undefined => {
  if (!cell) return undefined
  const ports = cell.getPorts?.() ?? []
  if (ports.length > 0 && ports[0]?.id) {
    return ports[0].id
  }
  const propPort = cell.getProp?.('ports/items/0/id')
  if (propPort) return propPort
  const dataPort = cell.ports?.items?.[0]?.id ?? cell.ports?.[0]?.id
  return dataPort
}

const createStageNode = (
  name: string,
  referenceNode: any,
  indexOffset: number,
  agentText = '',
  metadata: { subtopic?: string; miTechnique?: string } = {},
) => {
  if (!graph.value) return null
  const { x, y } = referenceNode.getPosition()
  const stageId = uuidV4()
  const stageNode = graph.value.addNode({
    shape: 'stage-node',
    id: stageId,
    position: {
      x: x + 360,
      y: y + indexOffset * 100,
    },
    size: { width: STAGE_NODE_WIDTH, height: calcStageNodeHeight(0) },
    data: {
      name,
      agent: agentText,
      subtopic: metadata.subtopic || '',
      miTechnique: metadata.miTechnique || '',
      menus: [],
    },
    children: [],
    zIndex: 10,
    ports: {
      groups: {
        left: {
          position: 'left',
          attrs: {
            circle: {
              magnet: true,
              stroke: '#8f8f8f',
              r: 6,
            },
          },
        },
      },
      items: [
        {
          id: uuidV4(),
          group: 'left',
        },
      ],
    },
  })
  return stageNode
}

const linkOptionToStage = (optionNode: any, targetNode: any) => {
  if (!graph.value) return
  const sourcePortId = getFirstPortId(optionNode)
  const targetPortId = getFirstPortId(targetNode)
  if (!sourcePortId || !targetPortId) return
  graph.value.addEdge({
    shape: 'edge',
    source: { cell: optionNode.id, port: sourcePortId },
    target: { cell: targetNode.id, port: targetPortId },
    attrs: {
      line: {
        stroke: '#5c6678',
        strokeWidth: 1,
        strokeOpacity: 0.62,
      },
    },
  })
}

const onDel = (index: number) => {
  const node = resolveNode()
  const menu = list.value[index]
  if (!menu) {
    return
  }

  const nextMenus = list.value.filter((_, entryIndex) => entryIndex !== index)
  list.value = nextMenus

  const optionNode =
    graph.value?.getCellById(menu.id) ??
    getNodeChildren(node).find((child: any) => String(child?.id || '') === menu.id)

  if (optionNode) {
    removeOptionNodeCompletely(node, optionNode)
  }

  syncNodeMenus(node, nextMenus)
  reconcileOptionChildren(node, nextMenus)
  void nextTick(() => {
    syncMeasuredLayout()
    updateSelectedGraphTopic()
  })
  recordAnalyticsEvent('option_deleted', 'manual', {
    topicName: (topicGraphSelected.value || '').trim(),
    stateName: (name.value || '').trim(),
    field: 'option',
    meta: {
      optionId: menu.id,
      label: menu.title,
    },
  })
}

const genOptionNode = (
  node: any,
  menuId: string,
  title: string,
  status: string,
  nextStage?: string,
  optionIndex?: number,
) => {
  const { x, y } = node.getPosition()
  const normalizedTitle =
    status === 'edit' ? sanitizeMenuTitle(title, '') : sanitizeMenuTitle(title, 'new-option')
  const currentData = node.getData?.() ?? node.data ?? {}
  const menuOffsetTop = Number(currentData?.menuOffsetTop)
  const resolvedMenuOffsetTop =
    Number.isFinite(menuOffsetTop) && menuOffsetTop > 0
      ? menuOffsetTop
      : measureMenuOffsetTop() ?? STAGE_NODE_TOP_CONTENT_HEIGHT
  const resolvedOptionIndex =
    typeof optionIndex === 'number' && optionIndex >= 0
      ? optionIndex
      : Math.max(0, getNodeChildren(node).length)
  return {
    id: menuId,
    shape: 'option-node',
    x: x + STAGE_NODE_OPTION_ITEM_LEFT,
    y:
      y +
      resolvedMenuOffsetTop +
      resolvedOptionIndex * STAGE_NODE_OPTION_ITEM_HEIGHT,
    width: STAGE_NODE_OPTION_ITEM_WIDTH,
    height: STAGE_NODE_OPTION_ITEM_HEIGHT,
    label: normalizedTitle,
    zIndex: 10,
    data: {
      title: normalizedTitle,
      status,
      nextStage,
    },
    ports: [{ id: uuidV4(), group: 'right' }],
  }
}

const alignOptionNodeLayout = (stageNode: any, optionNode: any, index: number) => {
  if (!stageNode || !optionNode) {
    return
  }

  const stagePosition = stageNode.getPosition?.() ?? { x: 0, y: 0 }
  const currentData = stageNode.getData?.() ?? stageNode.data ?? {}
  const menuOffsetTop = Number(currentData?.menuOffsetTop)
  const resolvedMenuOffsetTop =
    Number.isFinite(menuOffsetTop) && menuOffsetTop > 0
      ? menuOffsetTop
      : measureMenuOffsetTop() ?? STAGE_NODE_TOP_CONTENT_HEIGHT
  const expectedX = Number(stagePosition.x) + STAGE_NODE_OPTION_ITEM_LEFT
  const expectedY = Number(stagePosition.y) + resolvedMenuOffsetTop + index * STAGE_NODE_OPTION_ITEM_HEIGHT

  const optionPosition = optionNode.getPosition?.() ?? { x: NaN, y: NaN }
  if (Number(optionPosition.x) !== expectedX || Number(optionPosition.y) !== expectedY) {
    optionNode.position?.(expectedX, expectedY)
  }

  const optionSize = optionNode.getSize?.() ?? optionNode.size?.()
  if (
    !optionSize ||
    Number(optionSize.width) !== STAGE_NODE_OPTION_ITEM_WIDTH ||
    Number(optionSize.height) !== STAGE_NODE_OPTION_ITEM_HEIGHT
  ) {
    optionNode.resize?.(STAGE_NODE_OPTION_ITEM_WIDTH, STAGE_NODE_OPTION_ITEM_HEIGHT)
  }
}

const reconcileOptionChildren = (node: any, menus: MenuItem[]) => {
  if (!graph.value || !node) {
    return
  }

  const optionChildren = getNodeChildren(node).filter((child: any) => child?.shape === OPTION_NODE_SHAPE)
  const menuById = new Map(menus.map((menu) => [menu.id, menu] as const))
  const childById = new Map(
    optionChildren
      .map((child: any) => [String(child?.id || ''), child] as const)
      .filter(([id]) => id.length > 0),
  )

  optionChildren.forEach((child: any) => {
    const childId = String(child?.id || '')
    if (!childId || menuById.has(childId)) {
      return
    }
    removeOptionNodeCompletely(node, child)
  })

  menus.forEach((menu, index) => {
    const normalizedTitle =
      menu.status === 'edit'
        ? sanitizeMenuTitle(menu.title, '')
        : sanitizeMenuTitle(menu.title, 'new-option')

    let optionNode = childById.get(menu.id)
    if (!optionNode) {
      optionNode = graph.value!.addNode(
        genOptionNode(node, menu.id, normalizedTitle, menu.status, menu.nextStage, index),
      )
      node.addChild(optionNode)
      childById.set(menu.id, optionNode)
    } else if (typeof node.addChild === 'function') {
      node.addChild(optionNode)
    }
    alignOptionNodeLayout(node, optionNode, index)

    const optionData = optionNode.getData?.() ?? optionNode.data ?? {}
    const nextData = {
      ...optionData,
      title: normalizedTitle,
      status: menu.status,
      nextStage: menu.nextStage,
    }
    optionNode.setData?.(nextData)
    if (optionNode.data) {
      optionNode.data = nextData
    }
    if (typeof optionNode.setProp === 'function') {
      optionNode.setProp('label', normalizedTitle)
    } else if (typeof optionNode.prop === 'function') {
      optionNode.prop('label', normalizedTitle)
    }
  })
}

const onAddOption = (title: string, optionStatus: string) => {
  const node: Cell<Cell.Properties> =
    (querySuggestOptionStageId.value
      ? graph.value?.getCellById(querySuggestOptionStageId.value!)
      : resolveNode())!
  const nextMenus = normalizeMenus(node.data?.menus ?? [], node)
  const menu: MenuItem = {
    id: uuidV4(),
    title: sanitizeMenuTitle(title, optionStatus === 'edit' ? '' : 'new-option'),
    status: optionStatus,
  }
  const optionNode = graph.value!.addNode(
    genOptionNode(node, menu.id, menu.title, optionStatus, undefined, nextMenus.length),
  )
  node.addChild(optionNode)

  list.value = [...nextMenus, menu]
  syncNodeMenus(node, list.value)
  reconcileOptionChildren(node, list.value)
  void nextTick(() => {
    syncMeasuredLayout()
    updateSelectedGraphTopic()
  })
  recordAnalyticsEvent('option_added', 'manual', {
    topicName: (topicGraphSelected.value || '').trim(),
    stateName: (name.value || '').trim(),
    field: 'option',
    meta: {
      optionId: menu.id,
      label: menu.title,
      status: optionStatus,
    },
  })
}

const onSuggest = () => {
  updateSelectedGraphTopic()
  const node = resolveNode()
  setQuerySuggestOptionStageId(node.id)
  updateMentorDirections('')
  setNewSuggestOptions([])
  setNewSuggestOptionAgents({})
  setNewSuggestOptionStateDrafts({})
  suggestionForms.value = []
  setQuerySuggestOptionStageName(name.value)
  setNewOptionModalShow(true)
}

const onQuerySuggestOptions = () => {
  querySuggestOptions({
    mentorDirections: mentorDirections.value,
    topicName: (topicGraphSelected.value || '').trim(),
    stateName: name.value,
    subtopic: subtopic.value,
    miTechnique: miTechnique.value,
    currentAgent: agent.value,
    currentTopicScript: resolveCurrentTopicScript(),
  })
}

const onPreviewFromState = () => {
  const node = resolveNode()
  const stateName = (name.value || node?.data?.name || '').toString().trim()
  if (!stateName || typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('healthdial:preview-from-state', {
      detail: {
        stateName,
        nodeId: (node?.id || '').toString(),
      },
    }),
  )
}

const closeSuggestionModal = () => {
  setNewOptionModalShow(false)
  setQuerySuggestOptionStageId('')
  setNewSuggestOptionAgents({})
  setNewSuggestOptionStateDrafts({})
}

const onAddNewOptions = () => {
  if (!isModalHost.value) {
    closeSuggestionModal()
    return
  }

  const stageId = querySuggestOptionStageId.value
  if (!stageId) {
    closeSuggestionModal()
    return
  }

  const node: any = graph.value?.getCellById(stageId)
  if (!node) {
    closeSuggestionModal()
    return
  }

  const selections = suggestionForms.value.filter(
    (entry) => entry.selected && entry.option.trim().length > 0,
  )

  if (!selections.length) {
    setNewSuggestOptions([])
    suggestionForms.value = []
    closeSuggestionModal()
    return
  }

  const { byName } = buildStageMaps()
  const newStageCache = new Map<string, any>()
  const ensuredSubtopics = new Set<string>()
  const nextMenus = [...normalizeMenus(node.data?.menus ?? [], node)]
  const suggestedAgents = newSuggestOptionAgents.value || {}
  const suggestedStateDrafts = newSuggestOptionStateDrafts.value || {}
  const topicName = (topicGraphSelected.value || '').trim()

  selections.forEach((entry) => {
    const menu: MenuItem = {
      id: uuidV4(),
      title: entry.option.trim(),
      status: 'view',
    }

    let targetNode: any = null
    if (entry.selectedState) {
      const newStateName = parseNewStateValue(entry.selectedState)
      if (newStateName) {
        const normalized = newStateName.trim()
        if (byName.has(normalized)) {
          targetNode = graph.value?.getCellById(byName.get(normalized)!.id)
        } else if (newStageCache.has(normalized)) {
          targetNode = newStageCache.get(normalized)
        } else {
          const stateDraft = suggestedStateDrafts[normalized]
          const agentText = (stateDraft?.agent || suggestedAgents[normalized] || '').toString()
          const draftSubtopic = (stateDraft?.subtopic || subtopic.value || '').toString().trim()
          const draftMiTechnique = (stateDraft?.miTechnique || miTechnique.value || '').toString().trim()
          targetNode = createStageNode(normalized, node, newStageCache.size, agentText, {
            subtopic: draftSubtopic,
            miTechnique: draftMiTechnique,
          })
          if (targetNode) {
            newStageCache.set(normalized, targetNode)
            if (topicName && draftSubtopic) {
              const ensuredKey = `${topicName}::${draftSubtopic.toLowerCase()}`
              if (!ensuredSubtopics.has(ensuredKey)) {
                ensureTopicSubtopic(
                  topicName,
                  {
                    name: draftSubtopic,
                    brief: agentText,
                    miTechnique: draftMiTechnique,
                  },
                  {
                    afterSubtopicName: subtopic.value,
                  },
                )
                ensuredSubtopics.add(ensuredKey)
              }
            }
          }
        }
        if (targetNode) {
          menu.nextStage = targetNode.id
        }
      } else {
        targetNode = graph.value?.getCellById(entry.selectedState)
        if (targetNode) {
          menu.nextStage = targetNode.id
        }
      }
    }

    nextMenus.push(menu)
    const optionNode = graph.value!.addNode(
      genOptionNode(node, menu.id, menu.title, 'view', menu.nextStage, nextMenus.length - 1),
    )
    node.addChild(optionNode)

    if (targetNode) {
      linkOptionToStage(optionNode, targetNode)
    }
  })

  syncNodeMenus(node, nextMenus)
  if (nodeRef.value && nodeRef.value.id === node.id) {
    list.value = nextMenus
  }

  setNewSuggestOptions([])
  suggestionForms.value = []
  closeSuggestionModal()
  if (topicName) {
    setAnalyticsStateOptionTextsBaseline(
      topicName,
      (name.value || '').trim(),
      nextMenus.map((entry) => String(entry.title || '').trim()).filter((entry) => entry.length > 0),
    )
    newStageCache.forEach((createdNode, createdStateName) => {
      const createdAgent = String(createdNode?.getData?.()?.agent ?? createdNode?.data?.agent ?? '').trim()
      if (createdStateName.trim().length) {
        setAnalyticsStateTextBaseline(topicName, createdStateName, createdAgent)
      }
    })
  }
  updateSelectedGraphTopic()
  recordAnalyticsEvent('suggest_options_applied', 'manual', {
    topicName,
    stateName: (name.value || '').trim(),
    meta: {
      selectedCount: selections.length,
      createdStateCount: newStageCache.size,
    },
  })
}

const onChangeMentorDirections = (e: KeyboardEvent) => {
  updateMentorDirections((e.target as HTMLInputElement).value)
}

const getStateOptions = (entry: SuggestionFormEntry) => {
  const { infos, byName } = buildStageMaps()
  const options = infos.map((info) => ({
    label: info.name || info.id,
    value: info.id,
  }))
  const suggested = entry.suggestedState?.trim()
  if (suggested && !byName.has(suggested)) {
    options.unshift({
      label: `${suggested} (create new state)`,
      value: makeNewStateValue(suggested),
    })
  }
  return options
}

const getStateLabel = (value: string | null) => {
  if (!value) return ''
  const newStateName = parseNewStateValue(value)
  if (newStateName) {
    return `${newStateName} (new state)`
  }
  const { byId } = buildStageMaps()
  return byId.get(value)?.name || value
}

const getStateAgent = (value: string | null) => {
  if (!value) return ''
  const newStateName = parseNewStateValue(value)
  if (newStateName) {
    const normalized = newStateName.trim()
    const agentText =
      newSuggestOptionStateDrafts.value?.[normalized]?.agent ||
      newSuggestOptionAgents.value?.[normalized]
    if (agentText && agentText.trim()) {
      return agentText
    }
    return 'New state will be created; no agent text yet.'
  }
  const { byId } = buildStageMaps()
  const info = byId.get(value)
  if (!info) {
    return ''
  }
  return info.agent || 'No agent text for this state yet.'
}

const buildAiSessionId = () => {
  const normalizedUser = (userName.value || '').trim() || 'default'
  return `healthdial:${normalizedUser}`
}

const resolveCurrentTopicScript = () => {
  const topicName = (topicGraphSelected.value || '').trim()
  if (!topicName) {
    return ''
  }

  const cells = graph.value?.toJSON?.().cells
  if (Array.isArray(cells) && cells.length > 0) {
    try {
      return buildTopicScriptFromCells(topicName, stripCrossTopicArtifacts(cells)).script
    } catch (error) {
      console.warn('Failed to build topic script from graph cells, fallback to cached state content.', error)
    }
  }

  const topicList = stateContent.value
    .split(/(?=\n\/\/)/g)
    .map((entry) => entry.replace(/^\n/, ''))
  return topicList.find((entry) => entry.startsWith(`//${topicName}`)) || ''
}

const onGenerateRewrite = async () => {
  if (rewriteLoading.value) {
    return
  }

  const node = resolveNode()
  const stateName = (name.value || node?.data?.name || '').toString().trim()
  const topicName = (topicGraphSelected.value || '').trim()
  const instruction = rewriteInstruction.value.trim()

  if (!stateName) {
    rewriteError.value = 'State name is missing.'
    return
  }
  if (!topicName) {
    rewriteError.value = 'Please select a topic before using state rewrite.'
    return
  }
  if (!instruction.length) {
    rewriteError.value = 'Please describe how you want to revise this state.'
    return
  }

  rewriteLoading.value = true
  rewriteError.value = ''
  recordAnalyticsEvent('state_rewrite_requested', 'manual', {
    topicName,
    stateName,
    meta: {
      instructionLength: instruction.length,
    },
  })

  try {
    const response = await requestAiTask<StateRewriteOutput>({
      taskTag: 'state.rewrite',
      sessionId: buildAiSessionId(),
      topicId: topicName,
      input: {
        sourceContent: convertContent.value,
        authoringContext: buildAuthoringContext(),
        topicName,
        stateName,
        subtopic: subtopic.value,
        miTechnique: miTechnique.value,
        currentAgent: agent.value,
        currentTopicScript: resolveCurrentTopicScript(),
        rewriteInstruction: instruction,
        mentorDirections: '',
      },
      trace: {
        clientVersion: 'web-2026.02',
      },
    })

    const rewritten = (response.output?.agent || '').toString().trim()
    if (!rewritten.length) {
      rewriteError.value = 'AI returned an empty rewrite. Please try a more specific instruction.'
      return
    }

    rewriteCandidate.value = rewritten
    msgSrv.success('Rewrite generated. Review and click Apply.')
  } catch (error) {
    const payload = parseAiTaskError(error, 'Failed to rewrite this state.')
    rewriteError.value = payload.detail ? `${payload.message} (${payload.detail})` : payload.message
  } finally {
    rewriteLoading.value = false
  }
}

const onClearRewriteCandidate = () => {
  rewriteCandidate.value = ''
  rewriteError.value = ''
}

const onApplyRewrite = () => {
  const rewritten = rewriteCandidate.value.trim()
  if (!rewritten.length) {
    return
  }
  agentUpdateSource.value = 'ai'
  agent.value = rewritten
  const topicName = (topicGraphSelected.value || '').trim()
  const stateName = (name.value || '').trim()
  if (topicName && stateName) {
    setAnalyticsStateTextBaseline(topicName, stateName, rewritten)
  }
  rewriteCandidate.value = ''
  rewritePanelOpen.value = false
  updateSelectedGraphTopic()
  recordAnalyticsEvent('state_rewrite_applied', 'manual', {
    topicName,
    stateName,
    meta: {
      rewrittenLength: rewritten.length,
    },
  })
  msgSrv.success('State AGENT text updated.')
}

onMounted(() => {
  const node = resolveNode()
  name.value = node.data.name
  agent.value = node.data.agent
  subtopic.value = (node.data?.subtopic || '').toString()
  miTechnique.value = (node.data?.miTechnique || '').toString()
  list.value = normalizeMenus(node.data.menus, node)
  previewActive.value = Boolean(node.data?.previewActive)
  subtopicActive.value = Boolean(node.data?.subtopicActive)
  relationActive.value = Boolean(node.data?.relationActive)
  relationDim.value = Boolean(node.data?.relationDim)

  if (shouldSyncNormalizedMenus(node.data?.menus, list.value)) {
    syncNodeMenus(node, list.value)
  }
  reconcileOptionChildren(node, list.value)

  void nextTick(syncMeasuredLayout)

  if (typeof ResizeObserver !== 'undefined') {
    stageLayoutObserver = new ResizeObserver(() => {
      syncMeasuredLayout()
    })
    if (stageRootEl.value) {
      stageLayoutObserver.observe(stageRootEl.value)
    }
  }

  node.on('change:data', ({ current }: any) => {
    name.value = (current?.name || '').toString()
    agent.value = (current?.agent || '').toString()
    subtopic.value = (current?.subtopic || '').toString()
    miTechnique.value = (current?.miTechnique || '').toString()
    list.value = normalizeMenus(current.menus, node)
    previewActive.value = Boolean(current?.previewActive)
    subtopicActive.value = Boolean(current?.subtopicActive)
    relationActive.value = Boolean(current?.relationActive)
    relationDim.value = Boolean(current?.relationDim)
    if (shouldSyncNormalizedMenus(current?.menus, list.value)) {
      syncNodeMenus(node, list.value)
    }
    reconcileOptionChildren(node, list.value)
    void nextTick(syncMeasuredLayout)
  })
})

onBeforeUnmount(() => {
  flushAgentEditCommit()
  clearAgentEditTimer()
  if (stageLayoutObserver) {
    stageLayoutObserver.disconnect()
    stageLayoutObserver = null
  }
})
</script>

<style lang="scss" scoped>
.stage-node {
  --state-bg: #f8fbff;
  --state-border: #bdd6f2;
  --state-accent: #2f6ea6;
  --state-glow: rgba(47, 110, 166, 0.24);
  width: 300px;
  font-size: 14px;
  min-height: 90px;
  border: 2px solid var(--state-border);
  border-left: 6px solid var(--state-accent);
  border-radius: 5px;
  padding: 8px 8px 6px;
  background: var(--state-bg);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, border-width 0.2s ease;

  &.is-subtopic-active {
    box-shadow:
      0 0 0 2px var(--state-glow),
      0 0 14px var(--state-glow);
  }

  &.is-relation-active {
    box-shadow:
      0 0 0 3px rgba(22, 119, 255, 0.32),
      0 0 16px rgba(22, 119, 255, 0.28);
  }

  &.is-relation-dim {
    opacity: 0.45;
  }

  &.is-preview-active {
    border-width: 3px;
    border-color: #0958d9;
    box-shadow:
      0 0 0 3px rgba(22, 119, 255, 0.35),
      0 0 16px rgba(22, 119, 255, 0.4);

    .title-row > .name {
      color: #0958d9;
      font-weight: 800;
    }

    .btn-preview {
      color: #0958d9;
    }
  }

  & > .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 34px;
    margin-bottom: 8px;
    min-width: 0;
  }

  .btn-preview,
  .btn-ai-rewrite {
    color: var(--state-accent);
    margin-left: auto;
    min-width: 30px;
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 999px;
  }

  .btn-ai-rewrite {
    margin-left: 0;
  }

  .btn-preview :deep(.anticon),
  .btn-ai-rewrite :deep(.anticon) {
    font-size: 19px;
  }

  .title-row > .name {
    flex: 1;
    min-width: 0;
    min-height: 24px;
    text-align: center;
    margin: 0;
    line-height: 1.3;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.01em;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .title-input {
    flex: 1;
    min-width: 0;
    height: 30px;
    margin: 2px 0;
    font-size: 16px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .meta-chip {
    margin-inline-end: 0;
    font-size: 13px;
    line-height: 22px;
    color: var(--state-accent);
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid var(--state-border);
    font-weight: 600;
    padding-inline: 8px;
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
  }

  .mi-chip,
  .subtopic-chip {
    cursor: pointer;
  }

  .role-chip {
    background: rgba(255, 255, 255, 0.96);
  }

  .meta-select {
    min-width: 110px;
    max-width: 100%;

    &:deep(.ant-select-selector) {
      min-height: 26px;
      border-color: var(--state-border);
      background: rgba(255, 255, 255, 0.9);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--state-accent);
    }

    &:deep(.ant-select-selection-item),
    &:deep(.ant-select-selection-placeholder) {
      color: var(--state-accent);
      line-height: 24px;
    }
  }

  .meta-select-subtopic {
    flex: 1 1 120px;
  }

  .meta-select-mi {
    flex: 1 1 150px;
  }

  .mi-help-button {
    flex: 0 0 auto;
    padding-inline: 8px;
    color: var(--state-accent);
    font-size: 11px;
    border: 1px solid color-mix(in srgb, var(--state-border) 78%, #ffffff 22%);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);

    :deep(.anticon) {
      font-size: 12px;
    }
  }

  & > .agent {
    height: 200px;
    font-size: 14px;
    line-height: 1.55;
  }

  & > .btn-suggest {
    margin: 5px 0;
    font-size: 13px;
    font-weight: 700;
  }

  & > .menus {
    list-style: none;
    margin: 0;
    padding: 0;

    & > .menu-item {
      display: flex;
      align-items: center;
      height: 46px;
      font-size: 13px;
      padding: 0 5px;
      margin: 0;
      border-radius: 3px;

      & > .icon-del {
        cursor: pointer;
        margin-right: 5px;
      }
    }
  }
}

.rewrite-panel {
  width: 340px;

  .rewrite-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #1f1f1f;
  }

  .rewrite-generate {
    margin-top: 8px;
  }

  .rewrite-alert {
    margin-top: 8px;
  }

  .rewrite-result {
    margin-top: 10px;

    .rewrite-result-title {
      margin-bottom: 6px;
      color: #1f1f1f;
      font-size: 12px;
      font-weight: 600;
    }
  }

  .rewrite-actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.mi-technique-content {
  max-width: 280px;

  .mi-technique-name {
    font-weight: 600;
    margin-bottom: 6px;
    color: #1f1f1f;
  }

  .mi-technique-desc {
    font-size: 12px;
    color: #444;
    line-height: 1.5;
  }
}

.subtopic-content {
  max-width: 300px;

  .subtopic-name {
    font-weight: 700;
    margin-bottom: 6px;
    color: #1f1f1f;
    font-size: 13px;
  }

  .subtopic-desc {
    font-size: 12px;
    color: #444;
    line-height: 1.55;
    white-space: pre-wrap;
  }
}

.suggestion-list {
  margin-top: 16px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}

.suggestion-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafafa;
}

.suggestion-header {
  margin-bottom: 8px;
  font-weight: 600;
}

.suggestion-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.state-select {
  width: 100%;
}

.state-preview {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 8px;
  background: #fff;
}

.state-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #1f1f1f;
  margin-bottom: 4px;
}

.state-preview-agent {
  font-size: 12px;
  color: #555;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
}
</style>
<style lang="scss">
.ant-modal {
  .new-option-label {
    display: inline-block;
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }

  .new-option-suggest {
    margin-left: 6px;
    color: #8c8c8c;
    font-size: 12px;
    vertical-align: middle;
  }
}

.state-rewrite-popover {
  .ant-popover-inner-content {
    padding: 10px;
  }
}

.mi-technique-popover {
  .ant-popover-inner-content {
    padding: 10px;
  }
}

.subtopic-popover {
  .ant-popover-inner-content {
    padding: 10px;
  }
}
</style>















