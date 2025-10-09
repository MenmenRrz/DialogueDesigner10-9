<template>

  <div class="convert-wrapper">

    <div class="header">

      <a-space class="header-actions">

        <a-button type="primary" :disabled="queryTopicStrucLoading" @click="onCreate"

          >Create State</a-button

        >

        <a-button :disabled="queryTopicStrucLoading" @click="onExport">Export</a-button>

        <a-button :disabled="queryTopicStrucLoading" @click="onSaveWorkspace">Save</a-button>

      </a-space>

      <div class="header-stats">

        <span class="stat-item">

          <span class="stat-value">{{ topicStats.totalStages }}</span> states

        </span>

        <span class="stat-item">

          approx. <span class="stat-value">{{ estimatedMinutesDisplay }}</span> min

          <span class="stat-sub">({{ totalWordsDisplay }} words)</span>

        </span>

      </div>

      <span class="auto-save-indicator" v-if="autoSaveMessage">{{ autoSaveMessage }}</span>

    </div>
    <div
      v-if="hasQueuedTopics"
      class="generation-banner"
      :class="{
        active: hasActiveGeneration,
        failed: !hasActiveGeneration && generationStats.failed > 0,
      }"
    >
      <span v-if="hasActiveGeneration">
        Generating topics ({{ generationStats.completed }} / {{ generationStats.total }})
        <span v-if="activeTopicName">- {{ activeTopicName }}</span>
      </span>
      <span v-else-if="hasPausedGeneration">
        Generation paused ({{ generationStats.completed }} / {{ generationStats.total }}). Resume when ready.
      </span>
      <span v-else-if="hasPendingTopics">
        Topics queued ({{ generationStats.completed }} / {{ generationStats.total }}). Resume when ready.
      </span>
      <span v-else-if="generationStats.failed > 0">
        Generation finished with {{ generationStats.failed }} topic<span v-if="generationStats.failed > 1">s</span> needing attention.
      </span>
      <span v-else>
        All topics generated successfully.
      </span>
      <a-button
        v-if="hasActiveGeneration"
        size="small"
        type="link"
        :disabled="!canPauseGeneration"
        @click="onPauseGeneration"
      >
        Pause
      </a-button>
      <a-button
        v-else-if="canResumeGeneration"
        size="small"
        type="link"
        @click="onResumeGeneration"
      >
        Resume
      </a-button>
      <a-button
        v-if="!hasActiveGeneration && hasFailedTopics"
        size="small"
        type="link"
        @click="onRetryFailedTopics"
      >
        Retry failed
      </a-button>
    </div>
    <a-spin :spinning="queryTopicStrucLoading" tip="generating">

      <div class="content">

        <div class="sidebar">

          <div class="sidebar-header">

            <a-button

              type="dashed"

              block

              size="small"

              @click="openTopicEditorForCreate"

              >+ New Topic</a-button

            >

          </div>

          <div v-if="planTopics.length" class="topic-navigation">

            <div v-for="topic in planTopics" :key="topic.id" class="topic-node">

              <div class="topic-node-header">

                <button

                  type="button"

                  class="topic-button"

                  :class="{ active: activeSelection.topicId === topic.id }"

                  @click="onTopicClick(topic)"

                >

                  <span class="topic-label-group">
                    <span class="topic-label">{{ topic.name || 'Untitled Topic' }}</span>
                    <span
                      v-if="getTopicStatusLabel(topic.name) || getTopicStatusIcon(topic.name)"
                      class="topic-status-badge"
                      :class="getTopicStatusClass(topic.name)"
                    >
                      <span v-if="getTopicStatusIcon(topic.name)" class="topic-status-icon">
                        {{ getTopicStatusIcon(topic.name) }}
                      </span>
                      <span v-if="getTopicStatusLabel(topic.name)">
                        {{ getTopicStatusLabel(topic.name) }}
                      </span>
                    </span>
                    <span
                      v-if="hasTopicWarnings(topic.name)"
                      class="topic-warning"
                      :title="getTopicWarningTooltip(topic.name)"
                    >
                      !
                    </span>
                  </span>
                  <span class="topic-toggle-icon" @click.stop="toggleTopicExpansion(topic.id)">
                    <DownOutlined v-if="isTopicExpanded(topic.id)" />
                    <RightOutlined v-else />
                  </span>
                </button>
                <div v-if="topicJobError(topic.name)" class="topic-error-message">
                  {{ topicJobError(topic.name) }}
                </div>

                <a-button

                  v-if="canRetryTopic(topic.name)"

                  type="link"

                  size="small"

                  class="topic-retry-btn"

                  @click.stop="onRetryTopic(topic.name)"

                >

                  Retry

                </a-button>

                <a-button

                  type="text"

                  size="small"

                  class="topic-edit-btn"

                  @click.stop="openTopicEditor(topic)"

                >

                  Edit

                </a-button>

              </div>

              <div v-show="isTopicExpanded(topic.id)" class="subtopic-list">

                <div

                  v-for="subtopic in topic.subtopics"

                  :key="getSubtopicKey(topic.id, subtopic.id)"

                  class="subtopic-item"

                >

                  <button

                    type="button"

                    class="subtopic-button"

                    :class="{

                      active:

                        activeSelection.topicId === topic.id &&

                        activeSelection.subtopicId === subtopic.id,

                    }"

                    @click="onSubtopicClick(topic.id, subtopic.id)"

                  >

                    <span class="subtopic-name">{{ subtopic.name || 'Untitled Subtopic' }}</span>

                    <span class="subtopic-preview">

                      {{ subtopic.miTips ? truncate(subtopic.miTips) : 'No design notes yet' }}

                    </span>

                  </button>

                </div>

              </div>

            </div>

          </div>

          <a-empty v-else description="No topics yet" />

        </div>

        <div class="designer">

          <div class="container" ref="container"></div>

        </div>

      <a-modal

        v-model:open="topicEditor.visible"

        :title="topicEditor.mode === 'create' ? 'New Topic' : 'Edit Topic'"

        :destroyOnClose="true"

        @cancel="handleTopicEditorCancel"

      >

        <a-form layout="vertical">

          <a-form-item

            label="Topic name"

            :validate-status="topicEditor.nameError ? 'error' : ''"

            :help="topicEditor.nameError || ''"

          >

            <a-input

              v-model:value="topicEditor.name"

              :disabled="!topicEditor.nameEditable"

              placeholder="Enter topic name"

            />

          </a-form-item>



          <div class="topic-editor-subtopics">

            <div

              v-for="(subtopic, index) in topicEditor.subtopics"

              :key="subtopic.id"

              class="topic-editor-subtopic"

            >

              <div class="topic-editor-subtopic-header">

                <span>Subtopic {{ index + 1 }}</span>

                <a-button type="link" size="small" danger @click="removeEditorSubtopic(subtopic.id)">

                  Delete

                </a-button>

              </div>

              <a-input v-model:value="subtopic.name" placeholder="Subtopic name" />

              <a-textarea

                v-model:value="subtopic.miTips"

                :rows="3"

                placeholder="Design prompt or notes"

              />

            </div>

            <a-button type="dashed" block @click="addEditorSubtopic">Add Subtopic</a-button>

          </div>

        </a-form>

        <template #footer>

          <div class="topic-editor-footer">

            <a-popconfirm

              v-if="topicEditor.mode === 'edit' && topicEditor.isCustom"

              title="Delete this topic?"

              ok-text="Delete"

              cancel-text="Cancel"

              @confirm="handleTopicEditorDelete"

            >

              <a-button danger type="link">Delete topic</a-button>

            </a-popconfirm>

            <div class="topic-editor-footer-actions">

              <a-button @click="handleTopicEditorCancel">Cancel</a-button>

              <a-button type="primary" @click="handleTopicEditorOk">OK</a-button>

            </div>

          </div>

        </template>

      </a-modal>

      </div>

    </a-spin>

  </div>

</template>



<script setup lang="ts">

import { useDesignerStore, type SubtopicSummary, type TopicJob, type TopicJobStatus } from '@/stores/designer'

import { storeToRefs } from 'pinia'

import { computed, onMounted, onBeforeUnmount, ref, reactive, createVNode, watch, nextTick } from 'vue'

import { register } from '@antv/x6-vue-shape'

import StageNode from '@/components/StageNode.vue'

import { Cell, Graph, Path, Shape } from '@antv/x6'

import OptionNode from '@/components/OptionNode.vue'

import { Modal, message } from 'ant-design-vue'

import { DownOutlined, ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons-vue'

import { v4 as uuidV4 } from 'uuid'

import type { StageNodeMenu } from '@/utils/formatGeneticCounseling'



register({

  shape: 'stage-node',

  width: 150,

  height: 150,

  component: StageNode,

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

  },

})



register({

  shape: 'option-node',

  width: 258,

  height: 36,

  ports: {

    groups: {

      right: {

        position: 'right',

        attrs: {

          circle: {

            magnet: true,

            stroke: '#8f8f8f',

            r: 5,

          },

        },

      },

    },

  },

  component: OptionNode,

})





const designerStore = useDesignerStore()



const {
  updateGraph,
  selectGraphTopic,
  queryTopicStructure,
  updateConvertContent,
  updateSelectedGraphTopic,
  createTopicGraph,
  removeTopicGraph,
  cancelTopicGeneration,
  resumeTopicGeneration,
  retryTopic,
  restoreGenerationState,
  flushAllTopicGraphs,
} = designerStore

const {
  graph,
  convertContent,
  stateContent,
  topicGraph,
  topicGraphSelected,
  generationQueue,
  generationCancelled,
  generationProcessing,
  queryTopicStrucLoading,
  topicIssues,
  api1Result,
} = storeToRefs(designerStore)



type PlanSubtopic = {

  id: string

  name: string

  miTips: string

  brief: string

  miTechnique: string

}



type PlanTopic = {

  id: string

  name: string

  subtopics: PlanSubtopic[]

  isCustom: boolean

}



const planTopics = ref<PlanTopic[]>([])

const expandedTopicIds = ref<string[]>([])

const activeSelection = ref<{

  topicId: string | null

  subtopicId: string | null

}>({

  topicId: null,

  subtopicId: null,

})



const autoSaveMessage = ref('')

let autoSaveTimer: number | null = null



const topicStats = reactive({

  totalStages: 0,

  totalWords: 0,

  estimatedMinutes: 0,

})



type TopicEditorSubtopicDraft = {

  id: string

  name: string

  miTips: string

  brief: string

  miTechnique: string

}







const topicEditor = reactive({

  visible: false,

  mode: 'create' as 'create' | 'edit',

  name: '',

  nameEditable: true,

  nameError: '',

  isCustom: true,

  topicId: null as string | null,

  subtopics: [] as TopicEditorSubtopicDraft[],

})



const WORKSPACE_STORAGE_KEY = 'designer-convert-workspace'

const WORKSPACE_FINGERPRINT_KEY = 'designer-convert-fingerprint'



const getSubtopicKey = (topicId: string, subtopicId: string) => `${topicId}::${subtopicId}`



const truncate = (value: string, length = 64) => {

  if (!value) return ''

  return value.length > length ? `${value.slice(0, length - 3)}...` : value

}



const isTopicExpanded = (topicId: string) => expandedTopicIds.value.includes(topicId)



const toggleTopicExpansion = (topicId: string, expand?: boolean) => {

  const current = isTopicExpanded(topicId)

  const shouldExpand = expand ?? !current

  if (shouldExpand && !current) {

    expandedTopicIds.value = [...expandedTopicIds.value, topicId]

  } else if (!shouldExpand && current) {

    expandedTopicIds.value = expandedTopicIds.value.filter((id) => id !== topicId)

  }

}



const ensureTopicExpanded = (topicId: string | null | undefined) => {

  if (!topicId) return

  if (!isTopicExpanded(topicId)) {

    expandedTopicIds.value = [...expandedTopicIds.value, topicId]

  }

}



const isTopicNameTaken = (name: string) => {

  const normalized = name.trim()

  if (!normalized) return false

  if (planTopics.value.some((topic) => topic.name === normalized)) {

    return true

  }

  return topicGraph.value.has(normalized)

}



const resetTopicEditor = () => {

  topicEditor.visible = false

  topicEditor.mode = 'create'

  topicEditor.name = ''

  topicEditor.nameEditable = true

  topicEditor.nameError = ''

  topicEditor.isCustom = true

  topicEditor.topicId = null

  topicEditor.subtopics = []

}



const openTopicEditorForCreate = () => {

  resetTopicEditor()

  topicEditor.visible = true

  addEditorSubtopic()

}



const openTopicEditor = (topic: PlanTopic) => {

  resetTopicEditor()

  topicEditor.mode = 'edit'

  topicEditor.visible = true

  topicEditor.name = topic.name

  topicEditor.nameEditable = false

  topicEditor.isCustom = topic.isCustom

  topicEditor.topicId = topic.id

  topicEditor.subtopics = topic.subtopics.map((subtopic) => ({

    id: subtopic.id,

    name: subtopic.name,

    miTips: subtopic.miTips,

    brief: subtopic.brief,

    miTechnique: subtopic.miTechnique,

  }))

  if (!topicEditor.subtopics.length) {

    addEditorSubtopic()

  }

}



const addEditorSubtopic = () => {

  topicEditor.subtopics = [

    ...topicEditor.subtopics,

    {

      id: uuidV4(),

      name: '',

      miTips: '',

      brief: '',

      miTechnique: '',

    },

  ]

}



const removeEditorSubtopic = (subtopicId: string) => {

  topicEditor.subtopics = topicEditor.subtopics.filter((entry) => entry.id !== subtopicId)

}



const handleTopicEditorCancel = () => {

  resetTopicEditor()

}



const buildEditorSubtopics = (): PlanSubtopic[] => {

  return topicEditor.subtopics.map((entry, index) => ({

    id: entry.id || uuidV4(),

    name: entry.name.trim() || `Subtopic ${index + 1}`,

    miTips: entry.miTips.trim(),

    brief: entry.brief,

    miTechnique: entry.miTechnique,

  }))

}



const removeTopicById = (topicId: string) => {

  const index = planTopics.value.findIndex((topic) => topic.id === topicId)

  if (index === -1) return

  const topic = planTopics.value[index]

  if (!topic.isCustom) return

  const wasSelected = activeSelection.value.topicId === topicId

  planTopics.value = planTopics.value.filter((entry) => entry.id !== topicId)

  removeTopicGraph(topic.name)

  if (!planTopics.value.length) {

    activeSelection.value = { topicId: null, subtopicId: null }

    return

  }

  if (wasSelected) {

    const fallback = planTopics.value[Math.min(index, planTopics.value.length - 1)]

    onTopicClick(fallback)

  }

}



const handleTopicEditorDelete = () => {

  if (!topicEditor.topicId) return

  removeTopicById(topicEditor.topicId)

  resetTopicEditor()

}



const handleTopicEditorOk = () => {

  topicEditor.nameError = ''

  const normalizedName = topicEditor.name.trim()



  if (topicEditor.mode === 'create') {

    if (!normalizedName) {

      topicEditor.nameError = 'Topic name is required'

      return

    }

    if (isTopicNameTaken(normalizedName)) {

      topicEditor.nameError = 'Topic name already exists'

      return

    }

  }



  const subtopics = buildEditorSubtopics()

  if (!subtopics.length) {

    message.error('Please add at least one subtopic')

    return

  }



  if (topicEditor.mode === 'create') {

    const topicId = uuidV4()

    const newTopic: PlanTopic = {

      id: topicId,

      name: normalizedName,

      subtopics,

      isCustom: true,

    }

    planTopics.value = [...planTopics.value, newTopic]

    activeSelection.value = {

      topicId,

      subtopicId: subtopics[0]?.id ?? null,

    }

    ensureTopicExpanded(topicId)

    createTopicGraph(newTopic.name)

  } else if (topicEditor.topicId) {

    const index = planTopics.value.findIndex((topic) => topic.id === topicEditor.topicId)

    if (index !== -1) {

      const original = planTopics.value[index]

      const updated: PlanTopic = {

        ...original,

        subtopics,

      }

      planTopics.value = [

        ...planTopics.value.slice(0, index),

        updated,

        ...planTopics.value.slice(index + 1),

      ]

      if (activeSelection.value.topicId === updated.id) {

        ensureTopicExpanded(updated.id)

        const stillSelected = subtopics.some((entry) => entry.id === activeSelection.value.subtopicId)

        activeSelection.value.subtopicId = stillSelected

          ? activeSelection.value.subtopicId

          : subtopics[0]?.id ?? null

      }

    }

  }



  resetTopicEditor()

}



const onTopicClick = (topic: PlanTopic) => {

  ensureTopicExpanded(topic.id)

  activeSelection.value = {

    topicId: topic.id,

    subtopicId:

      topic.subtopics.find((subtopic) => subtopic.id === activeSelection.value.subtopicId)?.id ??

      topic.subtopics[0]?.id ??

      null,

  }

  if (topicGraph.value.has(topic.name)) {

    selectGraphTopic(topic.name)

  } else if (topic.isCustom) {

    createTopicGraph(topic.name)

  }

}



const onSubtopicClick = (topicId: string, subtopicId: string) => {

  ensureTopicExpanded(topicId)

  activeSelection.value = { topicId, subtopicId }

}



watch(

  () => api1Result.value?.all_topics,

  (allTopics) => {

    if (!allTopics || planTopics.value.length) {

      return

    }

    const seeds: PlanTopic[] = Object.entries(allTopics).map(([topicName, subtopics]) => ({

      id: uuidV4(),

      name: topicName,

      subtopics: (subtopics ?? []).map((entry) => {

        if (typeof entry === 'string') {

          return {

            id: uuidV4(),

            name: entry,

            miTips: '',

            brief: '',

            miTechnique: '',

          }

        }

        const normalized = entry as SubtopicSummary

        const displayName = normalized.name?.trim() ? normalized.name : 'Untitled Subtopic'

        const brief = normalized.brief ?? ''

        const miTechnique = normalized.miTechnique ?? ''

        return {

          id: uuidV4(),

          name: displayName,

          miTips: miTechnique || brief,

          brief,

          miTechnique,

        }

      }),

      isCustom: false,

    }))

    planTopics.value = seeds

    if (seeds.length) {

      activeSelection.value = {

        topicId: seeds[0].id,

        subtopicId: seeds[0].subtopics[0]?.id ?? null,

      }

      ensureTopicExpanded(seeds[0].id)

    }

  },

  { immediate: true },

)



watch(

  planTopics,

  (topics) => {

    const topicIds = topics.map((topic) => topic.id)

    expandedTopicIds.value = expandedTopicIds.value.filter((id) => topicIds.includes(id))

    if (!topics.length) {

      expandedTopicIds.value = []

      activeSelection.value = { topicId: null, subtopicId: null }

      return

    }

    if (!topics.some((topic) => topic.id === activeSelection.value.topicId)) {

      activeSelection.value.topicId = topics[0].id

    }

    const selectedTopicEntry =

      topics.find((topic) => topic.id === activeSelection.value.topicId) ?? topics[0]

    ensureTopicExpanded(selectedTopicEntry.id)

    if (

      !selectedTopicEntry.subtopics.some(

        (subtopic) => subtopic.id === activeSelection.value.subtopicId,

      )

    ) {

      activeSelection.value.subtopicId = selectedTopicEntry.subtopics[0]?.id ?? null

    }

  },

  { deep: true },

)



const topicJobLookup = computed(() => {
  const map = new Map<string, TopicJob>()
  generationQueue.value.forEach((job) => {
    if (!map.has(job.topicName)) {
      map.set(job.topicName, job)
    }
  })
  return map
})

type TopicStatusKey = TopicJobStatus | 'idle'

const statusLabelMap: Record<TopicStatusKey, string> = {
  idle: '',
  pending: 'Queued',
  running: 'Running',
  success: '',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const statusIconMap: Record<TopicStatusKey, string> = {
  idle: '',
  pending: '',
  running: '',
  success: '\u2713',
  failed: '!',
  cancelled: '\u23F8',
}

const statusClassMap: Record<TopicStatusKey, string> = {
  idle: 'status-idle',
  pending: 'status-pending',
  running: 'status-running',
  success: 'status-success',
  failed: 'status-failed',
  cancelled: 'status-cancelled',
}

const getTopicStatus = (topicName: string): TopicStatusKey => {
  return topicJobLookup.value.get(topicName)?.status ?? 'idle'
}

const getTopicStatusLabel = (topicName: string) => statusLabelMap[getTopicStatus(topicName)]

const getTopicStatusIcon = (topicName: string) => statusIconMap[getTopicStatus(topicName)]

const getTopicStatusClass = (topicName: string) => statusClassMap[getTopicStatus(topicName)]

const hasTopicWarnings = (topicName: string) => Boolean(topicIssues.value.get(topicName)?.length)

const topicJobError = (topicName: string) => topicJobLookup.value.get(topicName)?.error ?? ''

const generationStats = computed(() => {
  const total = generationQueue.value.length
  let completed = 0
  let failed = 0
  let running: TopicJob | null = null

  generationQueue.value.forEach((job) => {
    if (job.status === 'success') {
      completed += 1
    } else if (job.status === 'failed') {
      failed += 1
    }

    if (job.status === 'running') {
      running = job
    }
  })

  return {
    total,
    completed,
    failed,
    running,
  }
})

const activeTopicName = computed(() => generationStats.value.running?.topicName ?? '')

const hasQueuedTopics = computed(() => generationQueue.value.length > 0)

const hasRunningTopics = computed(() =>
  generationQueue.value.some((job: TopicJob) => job.status === 'running'),
)

const hasPendingTopics = computed(() =>
  generationQueue.value.some((job: TopicJob) => job.status === 'pending'),
)

const hasCancelledTopics = computed(() =>
  generationQueue.value.some((job: TopicJob) => job.status === 'cancelled'),
)

const hasFailedTopics = computed(() =>
  generationQueue.value.some((job: TopicJob) => job.status === 'failed'),
)

const hasPausedGeneration = computed(
  () => generationCancelled.value && (hasPendingTopics.value || hasCancelledTopics.value),
)

const hasActiveGeneration = computed(() => generationProcessing.value || hasRunningTopics.value)

const canPauseGeneration = computed(() => hasRunningTopics.value && !generationCancelled.value)

const canResumeGeneration = computed(() =>
  !hasRunningTopics.value && (hasPendingTopics.value || hasCancelledTopics.value),
)

const onPauseGeneration = () => {
  cancelTopicGeneration()
}

const onResumeGeneration = async () => {
  try {
    await resumeTopicGeneration()
  } catch (error) {
    console.error('Failed to resume generation', error)
    message.error('Failed to resume generation.')
  }
}

const onRetryTopic = async (topicName: string) => {
  try {
    await retryTopic(topicName)
  } catch (error) {
    console.error('Failed to retry topic generation', error)
    message.error('Failed to retry topic.')
  }
}

const onRetryFailedTopics = async () => {
  const targets = generationQueue.value.filter((job: TopicJob) => job.status === 'failed')
  if (!targets.length) {
    return
  }
  for (const job of targets) {
    await onRetryTopic(job.topicName)
  }
}

const canRetryTopic = (topicName: string) => {
  const status = getTopicStatus(topicName)
  return status === 'failed' || status === 'cancelled'
}

const getTopicWarningTooltip = (topicName: string) => {
  const issues = topicIssues.value.get(topicName) ?? []
  if (!issues.length) {
    return 'Parser warnings detected for this topic.'
  }
  return issues.map((issue) => issue.message).join('\n')
}


function computeTopicStats(cells: Cell.Properties[] | undefined) {

  const stageNodes = (cells || []).filter((entry) => entry.shape === 'stage-node')

  const totalStages = stageNodes.length

  const totalWords = stageNodes.reduce((sum, stage) => {

    const agentText = (stage.data?.agent ?? '').toString()

    if (!agentText) return sum

    const words = agentText

      .replace(/\r?\n/g, ' ')

      .split(/\s+/)

      .filter((word) => word.length > 0)

    return sum + words.length

  }, 0)

  topicStats.totalStages = totalStages

  topicStats.totalWords = totalWords

  topicStats.estimatedMinutes = totalWords > 0 ? Math.max(0.2, totalWords / 200) : 0

}



function updateTopicStatsForTopic(topicName?: string | null) {

  const key = topicName ?? topicGraphSelected.value

  if (key) {

    if (topicGraph.value.has(key)) {

      computeTopicStats(topicGraph.value.get(key))

      return

    }

    if (graph.value && topicGraphSelected.value === key) {

      const snapshot = ((graph.value.toJSON().cells ?? []) as Cell.Properties[])

      computeTopicStats(snapshot)

      return

    }

  }

  computeTopicStats(undefined)

}



watch(

  () => topicGraphSelected.value,

  (topicName) => {

    updateTopicStatsForTopic(topicName)

    if (!topicName) return

    const topic = planTopics.value.find((entry) => entry.name === topicName)

    if (!topic) return

    activeSelection.value.topicId = topic.id

    ensureTopicExpanded(topic.id)

    if (!topic.subtopics.some((subtopic) => subtopic.id === activeSelection.value.subtopicId)) {

      activeSelection.value.subtopicId = topic.subtopics[0]?.id ?? null

    }

  },

  { immediate: true },

)



const estimatedMinutesDisplay = computed(() => {

  const minutes = topicStats.estimatedMinutes || 0

  if (!Number.isFinite(minutes) || minutes <= 0) {

    return '0.0'

  }

  return minutes >= 1 ? minutes.toFixed(1) : minutes.toFixed(2)

})



const totalWordsDisplay = computed(() => {

  return topicStats.totalWords.toLocaleString('en-US')

})



const captureGraphSnapshot = () => {

  if (!graph.value) return

  const key = topicGraphSelected.value

  if (!key) return

  const snapshot = ((graph.value.toJSON().cells ?? []) as Cell.Properties[])

  topicGraph.value.set(key, snapshot)

  computeTopicStats(snapshot)

}



const graphEventNames = ['node:change:data', 'node:added', 'node:removed', 'edge:added', 'edge:removed']



const buildWorkspaceFingerprint = () => {

  if (!api1Result.value) {

    return convertContent.value

  }

  try {

    const topicKeys = Array.from(topicGraph.value.keys()).sort().join('::')

    return `${convertContent.value.length}:${topicKeys}`

  } catch (error) {

    return convertContent.value

  }

}



const persistWorkspace = (): boolean => {

  if (typeof window === 'undefined') {

    return false

  }

  try {

    updateSelectedGraphTopic()
    flushAllTopicGraphs()

    const planTopicsSnapshot = planTopics.value.map((topic) => ({

      ...topic,

      subtopics: topic.subtopics.map((subtopic) => ({ ...subtopic })),

    }))

    const topicGraphSnapshot = Array.from(topicGraph.value.entries()).map(([topicName, cells]) => [

      topicName,

      JSON.parse(JSON.stringify(cells)) as Cell.Properties[],

    ])

    const payload = {

      planTopics: planTopicsSnapshot,

      topicGraph: topicGraphSnapshot,

      topicGraphSelected: topicGraphSelected.value,

      convertContent: convertContent.value,

      stateContent: stateContent.value,

    }

    const fingerprint = buildWorkspaceFingerprint()

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload))

    window.localStorage.setItem(WORKSPACE_FINGERPRINT_KEY, fingerprint)

    updateTopicStatsForTopic(topicGraphSelected.value)

    return true

  } catch (error) {

    console.error('Failed to save workspace', error)

    return false

  }

}



const onSaveWorkspace = () => {

  if (typeof window === 'undefined') {

    message.error('Browser storage is unavailable.')

    return

  }

  const success = persistWorkspace()

  if (success) {

    message.success('Dialogue saved to browser.')

    autoSaveMessage.value = 'Saved at ' + new Date().toLocaleTimeString()

  } else {

    message.error('Failed to save dialogue to browser.')

  }

}



const runAutoSave = () => {

  if (typeof window === 'undefined') {

    return

  }

  autoSaveMessage.value = 'Auto-saving...'

  const success = persistWorkspace()

  if (success) {

    autoSaveMessage.value = 'Auto-saved at ' + new Date().toLocaleTimeString()

    window.setTimeout(() => {

      autoSaveMessage.value = ''

    }, 4000)

  } else {

    autoSaveMessage.value = 'Auto-save failed'

  }

}



const restoreWorkspace = () => {

  if (typeof window === 'undefined') {

    return false

  }

  const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)

  const storedFingerprint = window.localStorage.getItem(WORKSPACE_FINGERPRINT_KEY)

  if (!raw) {

    return false

  }

  try {

    const currentFingerprint = buildWorkspaceFingerprint()
    const hasLocalEdits =
      typeof convertContent.value === 'string' && convertContent.value.trim().length > 0

    if (storedFingerprint && storedFingerprint !== currentFingerprint && hasLocalEdits) {

      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)

      window.localStorage.removeItem(WORKSPACE_FINGERPRINT_KEY)

      return false

    }

    const parsed = JSON.parse(raw) as {

      planTopics?: PlanTopic[]

      topicGraph?: Array<[string, Cell.Properties[]]>

      topicGraphSelected?: string | null

      convertContent?: string

      stateContent?: string

    }

    if (Array.isArray(parsed.planTopics)) {

      planTopics.value = parsed.planTopics.map((topic) => ({

        ...topic,

        subtopics: Array.isArray(topic.subtopics)

          ? topic.subtopics.map((subtopic) => ({ ...subtopic }))

          : [],

      }))

    }

    if (Array.isArray(parsed.topicGraph)) {

      topicGraph.value.clear()

      parsed.topicGraph.forEach((entry) => {

        if (!Array.isArray(entry) || entry.length !== 2) return

        const [topicName, cells] = entry as [unknown, unknown]

        if (typeof topicName !== 'string' || !Array.isArray(cells)) return

        topicGraph.value.set(topicName, cells as Cell.Properties[])

      })

    }

    if (typeof parsed.convertContent === 'string') {

      updateConvertContent(parsed.convertContent)

    }

    if (typeof parsed.stateContent === 'string') {

      stateContent.value = parsed.stateContent

    }

    if (typeof parsed.topicGraphSelected === 'string' || parsed.topicGraphSelected === null) {

      topicGraphSelected.value = parsed.topicGraphSelected

    }

    nextTick(() => {

      const preferred =

        typeof parsed.topicGraphSelected === 'string' &&

        topicGraph.value.has(parsed.topicGraphSelected)

          ? parsed.topicGraphSelected

          : topicGraph.value.keys().next().value

      if (preferred) {

        selectGraphTopic(preferred)

        updateTopicStatsForTopic(preferred)

      } else if (graph.value) {

        const clearCells = (graph.value as any).clearCells

        if (typeof clearCells === 'function') {

          clearCells.call(graph.value)

        } else {

          graph.value.fromJSON([] as any)

        }

        computeTopicStats(undefined)

      }

    })

    message.success('Dialogue restored from browser.')

    window.localStorage.setItem(WORKSPACE_FINGERPRINT_KEY, currentFingerprint)

    return true

  } catch (error) {

    console.error('Failed to restore workspace', error)

    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)

    message.error('Failed to restore dialogue from browser.')

    return false

  }

}



const container = ref()





const onUpload = () => {}



const onCreate = () => {

  if (graph.value) {

    const node = graph.value.createNode({

      children: [],

      data: {

        agent: '',

        name: 'new_state',

        menus: [],

      },

      id: uuidV4(),

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

      position: {

        x: 0,

        y: 0,

      },

      shape: 'stage-node',

      size: { width: 300, height: 329 },

      view: 'vue-shape-view',

      zIndex: 10,

    })

    graph.value.addNode(node)

  }

}



const onExport = () => {

  updateSelectedGraphTopic()

  const desiredTopicName = topicGraphSelected.value



  const sections: string[] = []



  if (desiredTopicName && topicGraph.value.has(desiredTopicName)) {

    const cells = topicGraph.value.get(desiredTopicName) ?? []

    const stages = cells.filter((entry) => entry.shape === 'stage-node')



    if (stages.length) {

      sections.push('')

      sections.push('//' + desiredTopicName)



      stages.forEach((stage) => {

        const stateName = stage.data?.name ?? ''

        const agentLine = stage.data?.agent ?? ''

        sections.push('STATE: ' + stateName)

        sections.push('AGENT: ' + agentLine)

        sections.push('USERMENU:')



        const menus: StageNodeMenu[] = stage.data?.menus ?? []

        menus.forEach((menu, menuIndex) => {

          const optionCellId = stage.children?.[menuIndex]

          const edgeCell = optionCellId

            ? cells.find((cell) => cell.shape === 'edge' && cell.source?.cell === optionCellId)

            : undefined

          const nextState = edgeCell?.target?.cell ?? ''

          sections.push(menu.title + ' => ' + nextState)

        })



        sections.push('')

      })

    }

  }



  const outputs = sections.join('\r\n')



  const blob = new Blob([outputs], { type: 'text/plain' })

  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')

  anchor.href = url

  anchor.download = desiredTopicName || 'conversation-export'

  document.body.appendChild(anchor)

  anchor.click()

  document.body.removeChild(anchor)

  URL.revokeObjectURL(url)

}



onMounted(() => {

  Graph.registerConnector(

    'algo-connector',

    (s, e) => {

      const offset = 4

      const deltaY = Math.abs(e.y - s.y)

      const control = Math.floor((deltaY / 3) * 2)



      const v1 = { x: s.x, y: s.y + offset + control }

      const v2 = { x: e.x, y: e.y - offset - control }



      return Path.normalize(

        `M ${s.x} ${s.y}

        L ${s.x} ${s.y + offset}

        C ${v1.x} ${v1.y} ${v2.x} ${v2.y} ${e.x} ${e.y - offset}

        L ${e.x} ${e.y}

        `,

      )

    },

    true,

  )



  const graph = new Graph({

    container: container.value,

    background: {

      color: '#F2F7FA',

    },

    grid: {

      visible: true,

      type: 'doubleMesh',

      args: [

        {

          color: '#eee',

          thickness: 1,

        },

        {

          color: '#ddd',

          thickness: 1,

          factor: 4,

        },

      ],

    },

    autoResize: true,

    panning: true,

    mousewheel: true,

    translating: {

      restrict(view) {

        if (view) {

          const cell = view.cell

          if (cell.isNode()) {

            if (cell.shape === 'option-node') {

              const { x, y } = cell.getPosition()

              return {

                x,

                y,

                width: 0,

                height: 0,

              }

            }

            const parent = cell.getParent()

            if (parent) {

              const { x, y } = cell.getPosition()

              return {

                x,

                y,

                width: 0,

                height: 0,

              }

            }

          }

        }

        return null

      },

    },

    connecting: {

      snap: true,

      allowBlank: false,

      allowLoop: false,

      highlight: false,

      connector: 'algo-connector',

      connectionPoint: 'anchor',

      anchor: 'center',

      createEdge() {

        return new Shape.Edge({

          attrs: {

            line: {

              strokeWidth: 0.8,

            },

          },

        })

      },

      validateMagnet({ magnet }) {

        return magnet.getAttribute('port-group') !== 'top'

      },

    },

  })

  updateGraph(graph)

  graphEventNames.forEach((event) => {

    graph.on(event, captureGraphSnapshot)

  })

  const restoredWorkspace = restoreWorkspace()
  const restoredGeneration = restoreGenerationState()
  flushAllTopicGraphs()

  if (topicGraph.value.size) {

    const preferredTopic =

      topicGraphSelected.value && topicGraph.value.has(topicGraphSelected.value)

        ? topicGraphSelected.value

        : topicGraph.value.keys().next().value

    if (preferredTopic) {

      selectGraphTopic(preferredTopic)

    }

  } else if (

    !restoredGeneration &&

    api1Result.value &&

    convertContent.value &&

    !queryTopicStrucLoading.value &&

    !graph.value?.getNodes()?.length

  ) {

    queryTopicStructure()

  }



  if (typeof window !== 'undefined') {

    autoSaveTimer = window.setInterval(() => {

      runAutoSave()

    }, 120000)

  }



  graph.on('node:mouseenter', ({ e, node, view }) => {

    if (!node.hasTool('button-remove') && node.shape === 'stage-node') {

      node.addTools({

        name: 'button-remove',

        args: {

          x: 0,

          y: 0,

          offset: { x: 0, y: 0 },

          onClick() {

            Modal.confirm({

              title: 'Do you Want to delete this stage?',

              icon: createVNode(ExclamationCircleOutlined),

              onOk() {

                graph.removeNode(node)

              },

              onCancel() {

                e.preventDefault()

              },

            })

          },

        },

      })

    }

  })



  graph.on('edge:mouseenter', ({ e, cell }) => {

    if (!cell.hasTool('button-remove')) {

      cell.addTools([

        { name: 'vertices' },

        {

          name: 'button-remove',

          args: {

            onClick() {

              Modal.confirm({

                title: 'Do you Want to delete this line?',

                icon: createVNode(ExclamationCircleOutlined),

                onOk() {

                  graph.removeCell(cell)

                },

                onCancel() {

                  e.preventDefault()

                },

              })

            },

          },

        },

      ])

    }

  })



  graph.on('edge:mouseleave', ({ cell }) => {

    if (cell.hasTool('button-remove')) {

      cell.removeTool('button-remove')

    }

  })

})

onBeforeUnmount(() => {

  if (autoSaveTimer !== null) {

    window.clearInterval(autoSaveTimer)

    autoSaveTimer = null

  }

  if (graph.value) {

    graphEventNames.forEach((event) => {

      graph.value?.off?.(event, captureGraphSnapshot)

    })

  }

})



</script>



<style lang="scss" scoped>

.convert-wrapper {

  & > .header {

    display: flex;

    align-items: center;

    height: 60px;

    padding: 0 16px;

    background-color: #fff;

    border-bottom: 1px solid #ccc;

    gap: 16px;



    .header-actions {

      flex-shrink: 0;

    }



    .header-stats {

      flex: 1;

      display: flex;

      justify-content: center;

      gap: 20px;

      font-size: 13px;

      color: #595959;



      .stat-item {

        display: inline-flex;

        align-items: baseline;

        gap: 4px;

      }



      .stat-value {

        font-weight: 700;

        color: #1f1f1f;

      }



      .stat-sub {

        font-size: 12px;

        color: #8c8c8c;

      }

    }



    .auto-save-indicator {

      flex-shrink: 0;

      font-size: 13px;

      color: #8c8c8c;

    }

  }



  .ant-spin-nested-loading {

    width: 100%;

    height: calc(100vh - 60px - $layout-header-height);



    ::v-deep(.ant-spin-container) {

      height: 100%;

    }

  }



  .content {

    @include flex(flex-start, flex-start);

    height: calc(100vh - 60px - $layout-header-height);



    .sidebar {

      flex: 0 0 320px;

      height: 100%;

      overflow-y: auto;

      border-right: 1px solid #ccc;

      background: #fff;

      padding: 16px;

      display: flex;

      flex-direction: column;

      gap: 16px;

    }



    .sidebar-header {

      margin-bottom: 4px;

    }



    .topic-navigation {

      display: flex;

      flex-direction: column;

      gap: 12px;

    }



    .topic-node {

      display: flex;

      flex-direction: column;

      gap: 12px;

      padding: 12px;

      border: 1px solid #f0f0f0;

      border-radius: 8px;

      background: #fafafa;

    }



    .topic-node-header {

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 8px;

    }



    .topic-edit-btn {

      padding: 0;

    }



    .topic-button {

      display: flex;

      align-items: center;

      justify-content: space-between;

      padding: 10px 12px;

      border: none;

      background: transparent;

      border-radius: 8px;

      font: inherit;

      font-weight: 600;

      color: inherit;

      cursor: pointer;

      text-align: left;

      transition: background-color 0.2s ease;

    }

    .topic-retry-btn {
      padding: 0;
      margin-left: 4px;
    }
.topic-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      font-size: 12px;
      line-height: 20px;
      color: #1d39c4;
      background: #f0f5ff;
      letter-spacing: 0.02em;
    }

    .topic-status-badge.status-running {
      color: #ad6800;
      background: #fff7e6;
    }

    .topic-status-badge.status-failed {
      color: #a8071a;
      background: #fff1f0;
    }

    .topic-status-badge.status-cancelled {
      color: #595959;
      background: #f5f5f5;
    }

    .topic-status-badge.status-pending {
      color: #1f1f1f;
      background: #fafafa;
    }

    .topic-status-badge.status-success {
      color: #096dd9;
      background: #e6f4ff;
    }

    .topic-status-icon {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
    }




    .topic-button:hover {

      background: #f5f5f5;

    }



    .topic-button.active {

      background: #f0f5ff;

      color: #2f54eb;

    }



    .topic-toggle-icon {

      display: flex;

      align-items: center;

    }



    .subtopic-list {

      display: flex;

      flex-direction: column;

      gap: 10px;

    }



    .subtopic-item {

      display: flex;

      flex-direction: column;

      gap: 6px;

    }



    .subtopic-button {

      flex: 1;

      padding: 8px 12px;

      border: none;

      background: transparent;

      border-radius: 6px;

      font: inherit;

      text-align: left;

      color: inherit;

      cursor: pointer;

      transition: background-color 0.2s ease;

      display: flex;

      flex-direction: column;

      gap: 4px;

    }



    .subtopic-button:hover {

      background: #f5f5f5;

    }



    .subtopic-button.active {

      background: #fff7e6;

      color: #d46b08;

    }



    .subtopic-name {

      font-weight: 600;

    }



    .subtopic-preview {

      font-size: 12px;

      color: #8c8c8c;

    }



    .designer {

      flex: 1;

      height: 100%;



      & > .container {

        height: 100%;

      }

    }

  }

}

</style>

































<style lang="scss">

.ant-modal {

  .topic-editor-subtopics {

    display: flex;

    flex-direction: column;

    gap: 12px;

    max-height: 360px;

    overflow-y: auto;

  }



  .topic-editor-subtopic {

    display: flex;

    flex-direction: column;

    gap: 8px;

    padding: 12px;

    margin-bottom: 12px;

    border: 1px solid #f0f0f0;

    border-radius: 6px;

    background: #fafafa;

  }



  .topic-editor-subtopic-header {

    display: flex;

    align-items: center;

    justify-content: space-between;

    font-weight: 600;

  }



  .topic-editor-footer {

    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 12px;

  }



  .topic-editor-footer-actions {

    display: flex;

    align-items: center;

    gap: 8px;

  }

}

</style>







