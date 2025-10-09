<template>
  <div class="import-wrapper">
    <a-steps class="step-wrapper" :current="step" @change="onChangeStep">
      <a-step title="Author" description="Set context & source" />
      <a-step title="Review" description="Check generated topic plan" />
    </a-steps>

    <div class="steps-content">
      <a-card v-if="step === 0" class="step-author">
        <a-form layout="vertical" class="authoring-form">
          <div class="form-grid">
            <a-form-item label="Goal" required>
              <a-select
                v-model:value="goalValue"
                :options="goalSelectOptions"
                placeholder="Select a goal"
                size="large"
              />
            </a-form-item>
            <a-form-item label="Age Range">
              <a-space align="center" class="age-range">
                <a-input-number
                  v-model:value="ageMinValue"
                  :min="0"
                  placeholder="Min"
                  size="large"
                />
                <span class="divider">to</span>
                <a-input-number
                  v-model:value="ageMaxValue"
                  :min="0"
                  placeholder="Max"
                  size="large"
                />
              </a-space>
            </a-form-item>
            <a-form-item label="Gender">
              <a-input v-model:value="genderValue" placeholder="Optional" size="large" />
            </a-form-item>
            <a-form-item label="Persona">
              <a-textarea
                v-model:value="personaValue"
                :rows="2"
                placeholder="Optional"
                size="large"
              />
            </a-form-item>
          </div>
        </a-form>

        <a-divider class="section-divider" />

        <div class="convert-type-section">
          <div class="convert-type-header">
            <span class="section-title">Source Content</span>
            <a-radio-group v-model:value="type" button-style="solid" size="large">
              <a-radio-button :value="convertType.TEXT">Text</a-radio-button>
              <a-radio-button :value="convertType.IMPORT">Upload</a-radio-button>
            </a-radio-group>
          </div>
          <div class="input-area">
            <a-textarea
              v-if="type === convertType.TEXT"
              v-model:value="convertContent"
              placeholder="Paste or type the source material"
              :rows="7"
            />
            <a-upload-dragger
              v-else
              v-model:fileList="fileList"
              name="file"
              :multiple="false"
              :customRequest="onCustomRequest"
              :showUploadList="true"
              @change="handleChange"
            >
              <p class="ant-upload-drag-icon">
                <inbox-outlined />
              </p>
              <p class="ant-upload-text">Click or drag file to this area to upload</p>
              <p class="ant-upload-hint">Supported: plain text, UTF-8</p>
            </a-upload-dragger>
          </div>
        </div>

        <div class="author-footer">
          <a-button
            type="primary"
            size="large"
            :loading="convertLoading"
            @click="onConvertToTopic"
          >
            Generate Topic Plan
          </a-button>
        </div>
      </a-card>

      <a-card v-else class="step-review">
        <a-spin
          :spinning="convertLoading || queryTopicStrucLoading"
          :tip="convertLoading ? 'Generating topic plan...' : 'Preparing dialogue...'"
        >
          <template #indicator>
            <a-spin :spinning="true" />
          </template>

          <div v-if="reviewSessions.length" class="review-layout">
            <div class="review-navigation">
              <a-collapse
                :activeKey="expandedSessionKeys"
                expand-icon-position="end"
                @change="onChangeSession"
              >
                <a-collapse-panel
                  v-for="(session, sessionIndex) in reviewSessions"
                  :key="getSessionKey(sessionIndex)"
                  :header="session.sessionName"
                >
                  <div class="topic-tree">
                    <div
                      v-for="(topic, topicIndex) in session.topics"
                      :key="getTopicKey(sessionIndex, topicIndex)"
                      class="topic-node"
                    >
                      <button
                        type="button"
                        class="topic-button"
                        :class="{ active: isActiveTopic(sessionIndex, topicIndex) }"
                        @click="onToggleTopic(sessionIndex, topicIndex)"
                      >
                        <span class="topic-label">{{ topic.topicName }}</span>
                        <span class="topic-toggle-icon">
                          <DownOutlined v-if="isTopicExpanded(sessionIndex, topicIndex)" />
                          <RightOutlined v-else />
                        </span>
                      </button>
                      <ul
                        v-show="isTopicExpanded(sessionIndex, topicIndex)"
                        class="subtopic-list"
                      >
                        <li
                          v-for="(subtopic, subtopicIndex) in topic.subtopics"
                          :key="getSubtopicKey(sessionIndex, topicIndex, subtopicIndex)"
                          class="subtopic-item"
                        >
                          <button
                            type="button"
                            class="subtopic-button"
                            :class="{
                              active: isActiveSubtopic(sessionIndex, topicIndex, subtopicIndex),
                            }"
                            @click="onSelectSubtopic(sessionIndex, topicIndex, subtopicIndex)"
                          >
                            {{ subtopic.name }}
                          </button>
                        </li>
                        <li v-if="!topic.subtopics.length" class="subtopic-item subtopic-empty">
                          No subtopics for this topic yet.
                        </li>
                      </ul>
                    </div>
                  </div>
                </a-collapse-panel>
              </a-collapse>
            </div>

            <div class="review-detail">
              <div v-if="currentTopic" class="detail-card">
                <div class="detail-header">
                  <h2 class="detail-title">{{ currentTopic.topicName }}</h2>
                  <span class="detail-session">{{ currentSession?.sessionName }}</span>
                </div>
                <div v-if="currentSubtopics.length" class="detail-subtopics">
                  <div
                    v-for="(subtopic, index) in currentSubtopics"
                    :key="getSubtopicKey(activeSelection.sessionIndex, activeSelection.topicIndex, index)"
                    class="subtopic-detail"
                    :ref="setSubtopicRef(getSubtopicKey(activeSelection.sessionIndex, activeSelection.topicIndex, index))"
                  >
                    <h3 class="subtopic-title">{{ subtopic.name }}</h3>
                    <p class="subtopic-brief" v-if="subtopic.brief">
                      {{ subtopic.brief }}
                    </p>
                    <p class="subtopic-brief placeholder" v-else>
                      No brief provided.
                    </p>
                    <div class="subtopic-mi">
                      <span class="label">Motivational Interview Technique:</span>
                      <span class="value">{{ subtopic.miTechnique || 'Pending refinement.' }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="detail-empty">This topic does not have any subtopics yet.</div>
              </div>
              <a-empty v-else description="Select a subtopic to see details." />
            </div>
          </div>
          <a-empty v-else description="Generate a topic plan to review." />

          <div class="review-footer">
            <a-textarea
              v-model:value="newConvertContent"
              :rows="3"
              placeholder="Optional: mentor directions for regenerate / dialogue generation"
            />
            <div class="actions">
              <a-button size="large" @click="onBack">Back</a-button>
              <a-button
                size="large"
                :disabled="!sessionTopics.length"
                :loading="convertLoading"
                @click="onRegenerate"
              >
                Regenerate
              </a-button>
              <a-button
                type="primary"
                size="large"
                :disabled="!sessionTopics.length"
                :loading="queryTopicStrucLoading"
                @click="onGenerateDialogue"
              >
                Generate Dialogue
              </a-button>
            </div>
          </div>
        </a-spin>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadChangeParam, type UploadProps } from 'ant-design-vue'
import { InboxOutlined, DownOutlined, RightOutlined } from '@ant-design/icons-vue'
import { storeToRefs } from 'pinia'

import {
  ConvertType,
  AuthoringGoal,
  useDesignerStore,
  type SubtopicSummary,
} from '@/stores/designer'

type ReviewSubtopic = {
  name: string
  brief: string
  miTechnique: string
}

type ReviewTopic = {
  topicName: string
  subtopics: ReviewSubtopic[]
}

type ReviewSession = {
  sessionName: string
  topics: ReviewTopic[]
}

const router = useRouter()
const designerStore = useDesignerStore()
const convertType = ref(ConvertType)

const {
  step,
  type,
  convertContent,
  newConvertContent,
  convertLoading,
  sessionTopics,
  api1Result,
  authoringContext,
  queryTopicStrucLoading,
} = storeToRefs(designerStore)

const { updateStep, convert2topic, updateAuthoringContext, queryTopicStructure, goalOptions } =
  designerStore

const fileList = ref([])

const goalValue = computed({
  get: () => authoringContext.value.goal,
  set: (value: AuthoringGoal) => updateAuthoringContext({ goal: value }),
})

const ageMinValue = computed<number | null>({
  get: () => authoringContext.value.ageMin,
  set: (value) => updateAuthoringContext({ ageMin: value }),
})

const ageMaxValue = computed<number | null>({
  get: () => authoringContext.value.ageMax,
  set: (value) => updateAuthoringContext({ ageMax: value }),
})

const genderValue = computed({
  get: () => authoringContext.value.gender,
  set: (value: string) => updateAuthoringContext({ gender: value }),
})

const personaValue = computed({
  get: () => authoringContext.value.persona,
  set: (value: string) => updateAuthoringContext({ persona: value }),
})

const goalSelectOptions = goalOptions.map((option) => ({
  label: option.label,
  value: option.value,
}))

const expandedSessionKeys = ref<string[]>([])
const expandedTopics = ref<Record<string, string[]>>({})
const activeSelection = ref<{ sessionIndex: number; topicIndex: number; subtopicIndex: number }>(
  {
    sessionIndex: -1,
    topicIndex: -1,
    subtopicIndex: -1,
  },
)

const subtopicRefs = new Map<string, HTMLElement>()

const getSessionKey = (sessionIndex: number) => sessionIndex.toString()
const getTopicKey = (sessionIndex: number, topicIndex: number) => `${sessionIndex}-${topicIndex}`
const getSubtopicKey = (
  sessionIndex: number,
  topicIndex: number,
  subtopicIndex: number,
) => `${sessionIndex}-${topicIndex}-${subtopicIndex}`

const setSubtopicRef = (key: string) => (el: HTMLElement | null) => {
  if (el) {
    subtopicRefs.set(key, el)
  } else {
    subtopicRefs.delete(key)
  }
}

const scrollToSubtopic = (key: string) => {
  nextTick(() => {
    const target = subtopicRefs.get(key)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const topicDetailLookup = computed(() => {
  const lookup = new Map<string, Map<string, ReviewSubtopic>>()
  const allTopicsRecord = (api1Result.value?.all_topics ?? {}) as Record<string, Array<string | SubtopicSummary>>
  Object.entries(allTopicsRecord).forEach(([topicName, entries]) => {
    const topicKey = topicName.trim().toLowerCase()
    if (!topicKey) return
    const details = new Map<string, ReviewSubtopic>()
    entries.forEach((entry) => {
      if (!entry) return
      if (typeof entry === 'string') {
        const name = entry.trim()
        if (!name) return
        const nameKey = name.toLowerCase()
        if (!details.has(nameKey)) {
          details.set(nameKey, {
            name,
            brief: '',
            miTechnique: '',
          })
        }
        return
      }
      const normalized = entry as SubtopicSummary
      const name = normalized.name?.trim() ?? ''
      if (!name) return
      details.set(name.toLowerCase(), {
        name,
        brief: normalized.brief ?? '',
        miTechnique: normalized.miTechnique ?? '',
      })
    })
    if (details.size) {
      lookup.set(topicKey, details)
    }
  })
  return lookup
})
const reviewSessions = computed<ReviewSession[]>(() => {
  const detailLookup = topicDetailLookup.value
  return sessionTopics.value.map((session) => ({
    sessionName: session.sessionName,
    topics: session.topics.map((topic) => {
      const topicKey = topic.topicName.trim().toLowerCase()
      const subtopicDetails = topicKey ? detailLookup.get(topicKey) : undefined
      return {
        topicName: topic.topicName,
        subtopics: (topic.list ?? []).map((subtopic) => {
          const normalizedName = subtopic.name?.trim() ?? ''
          const detail = normalizedName ? subtopicDetails?.get(normalizedName.toLowerCase()) : undefined
          const displayName = detail?.name ?? (normalizedName || 'Untitled Subtopic')
          return {
            name: displayName,
            brief: detail?.brief ?? subtopic.brief ?? '',
            miTechnique: detail?.miTechnique ?? subtopic.miTechnique ?? '',
          }
        }),
      }
    }),
  }))
})

const isTopicExpanded = (sessionIndex: number, topicIndex: number) => {
  const sessionKey = getSessionKey(sessionIndex)
  const topicKey = getTopicKey(sessionIndex, topicIndex)
  return expandedTopics.value[sessionKey]?.includes(topicKey) ?? false
}

const setActiveSelection = (
  sessionIndex: number,
  topicIndex: number,
  subtopicIndex: number,
) => {
  activeSelection.value = { sessionIndex, topicIndex, subtopicIndex }
}

const resolveDefaultSubtopicIndex = (sessionIndex: number, topicIndex: number) => {
  const subtopics = reviewSessions.value[sessionIndex]?.topics?.[topicIndex]?.subtopics ?? []
  return subtopics.length ? 0 : -1
}

const ensureSessionExpanded = (sessionIndex: number) => {
  const key = getSessionKey(sessionIndex)
  if (!expandedSessionKeys.value.includes(key)) {
    expandedSessionKeys.value = [...expandedSessionKeys.value, key]
  }
}

const ensureTopicExpanded = (sessionIndex: number, topicIndex: number) => {
  const sessionKey = getSessionKey(sessionIndex)
  const topicKey = getTopicKey(sessionIndex, topicIndex)
  const current = expandedTopics.value[sessionKey] ?? []
  if (!current.includes(topicKey)) {
    expandedTopics.value = {
      ...expandedTopics.value,
      [sessionKey]: [...current, topicKey],
    }
  }
}

const toggleTopicExpansion = (sessionIndex: number, topicIndex: number, expand?: boolean) => {
  const sessionKey = getSessionKey(sessionIndex)
  const topicKey = getTopicKey(sessionIndex, topicIndex)
  const current = expandedTopics.value[sessionKey] ?? []
  const isExpanded = current.includes(topicKey)
  const shouldExpand = expand ?? !isExpanded
  if (shouldExpand && !isExpanded) {
    expandedTopics.value = {
      ...expandedTopics.value,
      [sessionKey]: [...current, topicKey],
    }
  } else if (!shouldExpand && isExpanded) {
    expandedTopics.value = {
      ...expandedTopics.value,
      [sessionKey]: current.filter((key) => key !== topicKey),
    }
  }
}

const isActiveTopic = (sessionIndex: number, topicIndex: number) => {
  return (
    activeSelection.value.sessionIndex === sessionIndex &&
    activeSelection.value.topicIndex === topicIndex
  )
}

const isActiveSubtopic = (
  sessionIndex: number,
  topicIndex: number,
  subtopicIndex: number,
) => {
  return (
    isActiveTopic(sessionIndex, topicIndex) &&
    activeSelection.value.subtopicIndex === subtopicIndex
  )
}

const currentSession = computed(() => {
  const { sessionIndex } = activeSelection.value
  return sessionIndex >= 0 ? reviewSessions.value[sessionIndex] ?? null : null
})

const currentTopic = computed(() => {
  const { sessionIndex, topicIndex } = activeSelection.value
  if (sessionIndex < 0 || topicIndex < 0) return null
  return reviewSessions.value[sessionIndex]?.topics?.[topicIndex] ?? null
})

const currentSubtopics = computed(() => currentTopic.value?.subtopics ?? [])

const onChangeSession = (keys: string | string[]) => {
  const normalized = Array.isArray(keys) ? keys : [keys]
  expandedSessionKeys.value = normalized
  const lastKey = normalized[normalized.length - 1]
  if (lastKey === undefined) {
    return
  }
  const sessionIndex = Number(lastKey)
  if (Number.isNaN(sessionIndex)) return
  const session = reviewSessions.value[sessionIndex]
  const topicIndex = session?.topics.length ? 0 : -1
  const subtopicIndex = topicIndex >= 0 ? resolveDefaultSubtopicIndex(sessionIndex, topicIndex) : -1
  if (topicIndex >= 0) {
    toggleTopicExpansion(sessionIndex, topicIndex, true)
  }
  setActiveSelection(sessionIndex, topicIndex, subtopicIndex)
  if (subtopicIndex >= 0) {
    scrollToSubtopic(getSubtopicKey(sessionIndex, topicIndex, subtopicIndex))
  }
}

const onToggleTopic = (sessionIndex: number, topicIndex: number) => {
  const expanded = isTopicExpanded(sessionIndex, topicIndex)
  toggleTopicExpansion(sessionIndex, topicIndex, !expanded)
  ensureSessionExpanded(sessionIndex)
  if (!expanded) {
    const subtopicIndex = resolveDefaultSubtopicIndex(sessionIndex, topicIndex)
    setActiveSelection(sessionIndex, topicIndex, subtopicIndex)
    if (subtopicIndex >= 0) {
      scrollToSubtopic(getSubtopicKey(sessionIndex, topicIndex, subtopicIndex))
    }
  }
}

const onSelectSubtopic = (sessionIndex: number, topicIndex: number, subtopicIndex: number) => {
  ensureSessionExpanded(sessionIndex)
  ensureTopicExpanded(sessionIndex, topicIndex)
  setActiveSelection(sessionIndex, topicIndex, subtopicIndex)
  scrollToSubtopic(getSubtopicKey(sessionIndex, topicIndex, subtopicIndex))
}

watch(
  sessionTopics,
  (topics) => {
    if (!topics.length) {
      expandedSessionKeys.value = []
      expandedTopics.value = {}
      activeSelection.value = { sessionIndex: -1, topicIndex: -1, subtopicIndex: -1 }
      return
    }
    const sessionIndex = Math.min(
      Math.max(activeSelection.value.sessionIndex, 0),
      topics.length - 1,
    )
    const session = topics[sessionIndex]
    const topicIndex = session.topics.length
      ? Math.min(Math.max(activeSelection.value.topicIndex, 0), session.topics.length - 1)
      : -1
    const subtopicIndex =
      topicIndex >= 0
        ? Math.min(
            Math.max(activeSelection.value.subtopicIndex, 0),
            (session.topics[topicIndex].list?.length ?? 0) - 1,
          )
        : -1

    activeSelection.value = {
      sessionIndex,
      topicIndex,
      subtopicIndex,
    }

    const sessionKey = getSessionKey(sessionIndex)
    expandedSessionKeys.value = [sessionKey]

    if (topicIndex >= 0) {
      const topicKey = getTopicKey(sessionIndex, topicIndex)
      expandedTopics.value = {
        [sessionKey]: [topicKey],
      }
    } else {
      expandedTopics.value = {
        [sessionKey]: [],
      }
    }
  },
  { immediate: true, deep: true },
)

const onConvertToTopic = () => {
  if (!convertContent.value.trim()) {
    message.warning('Please provide content before generating a plan.')
    return
  }
  updateStep(1)
  convert2topic(convertContent.value, newConvertContent.value)
}

const onBack = () => {
  updateStep(0)
}

const onRegenerate = () => {
  if (!convertContent.value.trim()) {
    message.warning('Please provide content before regenerating.')
    return
  }
  convert2topic(convertContent.value, newConvertContent.value)
}

const onGenerateDialogue = () => {
  if (!sessionTopics.value.length) {
    message.warning('Generate a topic plan before creating a dialogue.')
    return
  }
  queryTopicStructure(newConvertContent.value)
  router.push('/convert')
}

const onChangeStep = (current: number) => {
  updateStep(current)
}

const onCustomRequest: UploadProps['customRequest'] = (options) => {
  setTimeout(() => {
    options.onSuccess?.(options.file)
  })
}

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status
  if (status === 'done') {
    message.success(`${info.file.name} uploaded.`)
    const reader = new FileReader()
    reader.readAsText(info.file.originFileObj!, 'UTF-8')
    reader.onload = function () {
      convertContent.value = String(this.result ?? '')
    }
  } else if (status === 'error') {
    message.error(`${info.file.name} upload failed.`)
  }
}
</script>

<style lang="scss" scoped>
.import-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .step-wrapper {
    padding: 12px 18vw;

    ::v-deep(.ant-steps-item-description) {
      white-space: nowrap;
      font-size: 15px;
    }
  }
}

.steps-content {
  height: calc(100vh - 80px - $layout-header-height - 32px);
  padding: 0 32px 24px;

  & > .ant-card {
    height: 100%;
    border-radius: 12px;
  }
}

.step-author {
  ::v-deep(.ant-card-body) {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: 100%;
  }

  .authoring-form {
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px 24px;
    }

    ::v-deep(.ant-form-item-label > label) {
      font-size: 15px;
      font-weight: 600;
    }

    ::v-deep(.ant-input),
    ::v-deep(.ant-input-number),
    ::v-deep(.ant-select-selector),
    ::v-deep(.ant-input-password) {
      font-size: 15px;
    }
  }

  .section-divider {
    margin: 0;
  }

  .convert-type-section {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .convert-type-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      .section-title {
        font-size: 16px;
        font-weight: 600;
      }
    }

    .input-area {
      width: 100%;

      ::v-deep(.ant-input) {
        font-size: 15px;
      }

      ::v-deep(.ant-upload) {
        padding: 32px;
        font-size: 15px;
      }
    }
  }

  .author-footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
  }
}

.step-review {
  ::v-deep(.ant-card-body) {
    display: flex;
    flex-direction: column;
    gap: 24px;
    height: 100%;
  }

  .review-layout {
    flex: 1;
    display: flex;
    gap: 16px;
    overflow: hidden;
  }

  .review-navigation {
    flex: 1.2;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    background: #fff;
    overflow: auto;
  }

  .topic-tree {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .topic-node {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .topic-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: inherit;
  }

  .topic-button:hover {
    background: #f5f5f5;
  }

  .topic-button:focus {
    outline: none;
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
    margin: 0;
    padding: 0 0 0 12px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .subtopic-item {
    width: 100%;
  }

  .subtopic-button {
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    text-align: left;
    font: inherit;
    font-size: 14px;
    color: inherit;
    cursor: pointer;
  }

  .subtopic-button:hover {
    background: #f5f5f5;
  }

  .subtopic-button.active {
    background: #fff1f0;
    color: #cf1322;
    font-weight: 600;
  }

  .subtopic-empty {
    padding: 6px 12px;
    font-size: 14px;
    color: #999;
  }

  .review-detail {
    flex: 2;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    background: #fff;
    overflow: auto;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .detail-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .detail-session {
    font-size: 14px;
    color: #8c8c8c;
  }

  .detail-subtopics {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .subtopic-detail {
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 16px;
    background: #fafafa;
  }

  .subtopic-title {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .subtopic-brief {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: #1f1f1f;
  }

  .subtopic-brief.placeholder {
    color: #999;
    font-style: italic;
  }

  .subtopic-mi {
    display: flex;
    gap: 8px;
    font-size: 14px;
    color: #1f1f1f;
  }

  .subtopic-mi .label {
    font-weight: 600;
  }

  .detail-empty {
    padding: 24px;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    text-align: center;
    color: #999;
  }

  .review-footer {
    display: grid;
    gap: 16px;

    ::v-deep(.ant-input) {
      font-size: 15px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: flex-end;
    }
  }
}

.age-range {
  width: 100%;

  .divider {
    font-size: 15px;
    color: #777;
  }
}
</style>
