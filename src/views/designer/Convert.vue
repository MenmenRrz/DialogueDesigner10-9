<template>

  <div class="convert-wrapper">

    <div class="header">
      <div class="header-row header-row-main">
        <div class="header-actions header-actions-left">
          <a-button
            class="toolbar-btn toolbar-btn-create"
            data-tour="add-state"
            type="primary"
            :disabled="isGenerationUiBusy || !topicGraphSelected"
            @click="onCreate"
          >
            Add State
          </a-button>
          <a-button
            class="toolbar-btn toolbar-btn-jump"
            data-tour="add-transition"
            :disabled="isGenerationUiBusy || !topicGraphSelected"
            @click="onCreateJumpState"
          >
            Add Transition
          </a-button>
          <a-button
            class="toolbar-btn"
            :disabled="isGenerationUiBusy || importLoading"
            :loading="importLoading"
            @click="onImportClick"
          >
            Import
          </a-button>
          <a-button
            class="toolbar-btn toolbar-btn-stop"
            :disabled="isGenerationUiBusy || !activePreviewTopic"
            @click="onStopPreview"
          >
            Stop Preview
          </a-button>
        </div>

        <div class="header-actions header-actions-center">
          <span class="attention-anchor">
            <span v-if="shouldPulseGuideAction" class="attention-callout guide-callout">Next: open guide</span>
            <a-button
              class="toolbar-btn toolbar-btn-guide"
              :class="{ 'attention-pulse attention-strong': shouldPulseGuideAction }"
              @click="onStartGuide"
            >
              Guide
            </a-button>
          </span>
        </div>

        <div class="header-actions header-actions-right">
          <span class="header-status">
            <strong>{{ topicStats.totalStages }}</strong> states
          </span>
          <span class="auto-save-indicator" v-if="autoSaveMessage">{{ autoSaveMessage }}</span>
          <a-button class="toolbar-btn" :disabled="isGenerationUiBusy" @click="onSaveWorkspace">Save</a-button>
          <a-button
            class="toolbar-btn"
            data-tour="coach-preview"
            :type="agentPanelVisible ? 'primary' : 'default'"
            @click="toggleAgentPanelVisibility"
          >
            Coach Preview
          </a-button>
          <a-tooltip :title="exportDisabledReason">
            <span class="toolbar-tooltip-wrap">
              <a-button
                class="toolbar-btn toolbar-btn-export"
                data-tour="export-dialogue"
                type="primary"
                :disabled="isGenerationUiBusy || exportLoading || !canBuildConversation"
                :loading="exportLoading"
                @click="onExport"
              >
                Export
              </a-button>
            </span>
          </a-tooltip>
        </div>
      </div>

      <input
        ref="importInput"
        type="file"
        accept=".script,.txt,.md,.json,.text"
        style="display: none"
        @change="handleImportChange"
      />

    </div>
    <div v-if="isManualAuthoringMode" class="manual-mode-banner">
      <div class="manual-mode-banner-title">Manual Authoring Mode</div>
      <div class="manual-mode-banner-copy">
        Build the patient-facing dialogue yourself. Start by creating the topics and subtopics you
        need, then open each topic and add states one by one. Review every message, option, and
        transition so the conversation is safe, fits your counseling style, and can support at least
        a 5 minute patient conversation. Use <strong>Coach Preview</strong> to test how it feels.
      </div>
    </div>
    <div
      v-if="!isManualAuthoringMode && hasQueuedTopics"
      class="generation-banner"
      :class="{
        active: hasActiveGeneration,
        failed: !hasActiveGeneration && generationStats.failed > 0,
      }"
    >
      <div class="generation-banner-copy">
        <div class="generation-banner-kicker">Dialogue status</div>
        <h2 v-if="hasActiveGeneration">
          Generating dialogue steps
          <span v-if="activeTopicName">for {{ activeTopicName }}</span>
        </h2>
        <h2 v-else-if="hasPausedGeneration">Generation is paused</h2>
        <h2 v-else-if="hasPendingTopics">Ready to generate the full dialogue</h2>
        <h2 v-else-if="generationStats.failed > 0">Some topics need attention</h2>
        <h2 v-else>All topics are generated</h2>
        <p v-if="hasActiveGeneration">
          Building editable coach messages, patient choices, and transitions.
        </p>
        <p v-else-if="hasPendingTopics || hasPausedGeneration">
          Generate dialogue content for all queued topics. You can edit every message on the canvas.
        </p>
        <p v-else-if="generationStats.failed > 0">
          {{ generationStats.failed }} topic<span v-if="generationStats.failed > 1">s</span> did not finish. Retry them before previewing the full dialogue.
        </p>
        <p v-else>
          Pick a topic on the left to review and edit the generated dialogue.
        </p>
        <a-progress
          class="generation-progress"
          :percent="generationProgressPercent"
          :show-info="false"
          :status="generationStats.failed > 0 && !hasActiveGeneration ? 'exception' : 'active'"
        />
        <div class="generation-count">
          {{ generationStats.completed }} of {{ generationStats.total }} topics generated
        </div>
      </div>
      <div class="generation-banner-actions">
        <a-button
          v-if="hasActiveGeneration"
          size="large"
          :disabled="!canPauseGeneration"
          @click="onPauseGeneration"
        >
          Pause Generation
        </a-button>
        <span v-else-if="canResumeGeneration" class="attention-anchor generation-action-anchor">
          <span v-if="shouldPulseGenerateAction" class="attention-callout generate-callout">Start here</span>
          <a-button
            class="generation-primary-action"
            :class="{ 'attention-pulse attention-strong': shouldPulseGenerateAction }"
            type="primary"
            size="large"
            @click="onResumeGeneration"
          >
            Generate Dialogue
          </a-button>
        </span>
        <a-button
          v-if="!hasActiveGeneration && hasFailedTopics"
          size="large"
          @click="onRetryFailedTopics"
        >
          Retry Failed Topics
        </a-button>
      </div>
    </div>
    <a-spin :spinning="isGenerationUiBusy" tip="AI is drafting dialogue...">

      <div class="content">

        <div class="sidebar" data-tour="topic-sidebar">

          <div class="sidebar-header">

            <a-button

              type="dashed"

              block

              size="small"

              @click="openTopicEditorForCreate"

            >+ New Topic</a-button

            >

            <div v-if="isManualAuthoringMode" class="manual-sidebar-tip">
              Select a topic, then use <strong>Add State</strong> to create each part of the
              patient conversation. Connect user options to the next state. Use <strong>Add
              Transition</strong> only when the dialogue should move to another topic.
            </div>

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
                  <span class="topic-button-main">
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
                  </span>
                </button>

                <div class="topic-header-footer">
                  <div v-if="topicJobError(topic.name)" class="topic-error-message">
                    {{ topicJobError(topic.name) }}
                  </div>

                  <div class="topic-action-row">
                    <a-button

                      v-if="!isManualAuthoringMode && canRetryTopic(topic.name)"

                      type="link"

                      size="small"

                      class="topic-retry-btn"

                      :disabled="isGenerationUiBusy"

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
                </div>

              </div>

              <div v-show="isTopicExpanded(topic.id)" class="subtopic-list">

                <div

                  v-for="(subtopic, subtopicIndex) in topic.subtopics"

                  :key="getSubtopicKey(topic.id, subtopic.id)"

                  class="subtopic-item"

                  data-tour="subtopic-list"

                >

                  <button

                    type="button"

                    class="subtopic-button"
                    :style="getSubtopicButtonStyle(subtopicIndex)"

                    :class="{

                      active:

                        activeSelection.topicId === topic.id &&

                        activeSelection.subtopicId === subtopic.id,

                    }"

                    @click="onSubtopicClick(topic.id, subtopic.id)"

                  >

                    <span class="subtopic-name">{{ subtopic.name || 'Untitled Subtopic' }}</span>

                    <span class="subtopic-preview">

                      {{
                        subtopic.brief
                          ? truncate(subtopic.brief)
                          : subtopic.miTips
                          ? truncate(subtopic.miTips)
                          : 'No description yet'
                      }}

                    </span>

                  </button>

                </div>

              </div>

            </div>

          </div>

          <div v-else class="empty-topic-panel">
            <a-empty description="No topics yet" />
            <p>
              Create a topic first, then add states, patient options, and transitions in the
              dialogue canvas.
            </p>
            <a-button type="primary" block @click="openTopicEditorForCreate">New Topic</a-button>
          </div>

        </div>

        <div
          ref="designerSurface"
          class="designer"
          data-tour="dialogue-canvas"
          :class="{ 'with-agent-panel': agentPanelVisible, 'panel-collapsed': agentPanelVisible && agentPanelCollapsed }"
        >

          <div class="container" ref="container"></div>

        </div>

        <div
          v-if="agentPanelVisible"
          class="agent-preview-panel"
          :class="{ collapsed: agentPanelCollapsed, resizing: agentPanelResizeActive }"
          :style="agentPanelStyle"
        >
          <button
            v-if="!agentPanelCollapsed"
            type="button"
            class="agent-preview-resize-edge resize-left"
            aria-label="Resize agent panel width"
            @mousedown.prevent="startAgentPanelResize('width', $event)"
          />
          <button
            v-if="!agentPanelCollapsed"
            type="button"
            class="agent-preview-resize-edge resize-top"
            aria-label="Resize agent panel height"
            @mousedown.prevent="startAgentPanelResize('height', $event)"
          />
          <button
            v-if="!agentPanelCollapsed"
            type="button"
            class="agent-preview-resize-corner"
            aria-label="Resize agent panel"
            @mousedown.prevent="startAgentPanelResize('both', $event)"
          />
          <div class="agent-preview-header">
            <span class="title">Unity Agent Preview</span>
            <div class="agent-switcher">
              <a-button
                size="small"
                :type="selectedPreviewAgent === 'Laura' ? 'primary' : 'default'"
                :disabled="isPreviewBusy"
                @click="onSelectPreviewAgent('Laura')"
              >
                <span class="agent-chip-icon">L</span>
                Laura
              </a-button>
              <a-button
                size="small"
                :type="selectedPreviewAgent === 'Mary' ? 'primary' : 'default'"
                :disabled="isPreviewBusy"
                @click="onSelectPreviewAgent('Mary')"
              >
                <span class="agent-chip-icon">M</span>
                Mary
              </a-button>
            </div>
            <a-space size="small">
              <a-button
                size="small"
                :disabled="isGenerationUiBusy || isPreviewBusy || !canBuildConversation"
                :loading="isPreviewBusy"
                @click="onPreviewConversation"
              >
                Preview
              </a-button>
              <a-button size="small" :disabled="isPreviewBusy || !activePreviewTopic" @click="onStopPreview">Stop</a-button>
              <a-button size="small" @click="toggleAgentPanelCollapsed">
                {{ agentPanelCollapsed ? 'Expand' : 'Collapse' }}
              </a-button>
            </a-space>
          </div>
          <div class="agent-preview-url">{{ agentPreviewUrl }}</div>
          <div v-if="previewStatusText" class="agent-preview-status" :class="{ loading: isPreviewBusy }">
            <a-spin v-if="isPreviewBusy" size="small" />
            <span>{{ previewStatusText }}</span>
          </div>
          <div v-show="!agentPanelCollapsed" class="agent-preview-body">
            <iframe
              ref="agentPreviewFrame"
              class="agent-preview-frame"
              :src="agentPreviewUrl"
              allow="autoplay; fullscreen"
              @load="onAgentFrameLoad"
            />
            <div v-if="previewErrorSummary" class="agent-preview-error">
              <div class="error-summary">
                <span>{{ previewErrorSummary }}</span>
                <a-button type="link" size="small" @click="previewErrorExpanded = !previewErrorExpanded">
                  {{ previewErrorExpanded ? 'Hide details' : 'Details' }}
                </a-button>
              </div>
              <pre v-if="previewErrorExpanded" class="error-details">{{ previewErrorDetail }}</pre>
            </div>
          </div>
        </div>

        <div v-if="tourActive" class="tour-overlay" role="dialog" aria-modal="true" aria-label="Design Studio guide">
          <div
            v-if="tourHighlightStyle"
            class="tour-highlight"
            :style="tourHighlightStyle"
          ></div>
          <div class="tour-card" :style="tourCardStyle">
            <div class="tour-step-count">Step {{ tourStepIndex + 1 }} of {{ activeTourSteps.length }}</div>
            <h2>{{ currentTourStep.title }}</h2>
            <p>{{ currentTourStep.body }}</p>
            <div v-if="currentTourStep.note" class="tour-note">{{ currentTourStep.note }}</div>
            <div class="tour-actions">
              <a-button size="small" @click="endTour">Skip</a-button>
              <a-button size="small" :disabled="tourStepIndex === 0" @click="previousTourStep">Back</a-button>
              <a-button
                size="small"
                type="primary"
                @click="tourStepIndex === activeTourSteps.length - 1 ? endTour() : nextTourStep()"
              >
                {{ tourStepIndex === activeTourSteps.length - 1 ? 'Done' : 'Next' }}
              </a-button>
            </div>
          </div>
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

              :placeholder="
                isManualAuthoringMode
                  ? 'e.g. Discuss Screening Options'
                  : 'Enter topic name'
              "

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

              <a-input
                v-model:value="subtopic.name"
                :placeholder="
                  isManualAuthoringMode ? 'e.g. Explore Concerns' : 'Subtopic name'
                "
              />

              <a-textarea

                v-model:value="subtopic.miTips"

                :rows="3"

                :placeholder="
                  isManualAuthoringMode
                    ? 'What should this subtopic cover? Eg ask what worries the user most and reflect it back.'
                    : 'Design prompt or notes'
                "

              />

            </div>

            <a-button type="dashed" block @click="addEditorSubtopic">Add Subtopic</a-button>

          </div>

        </a-form>

        <template #footer>

          <div class="topic-editor-footer">

            <a-popconfirm

              v-if="topicEditor.mode === 'edit' && (topicEditor.isCustom || isManualAuthoringMode)"

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

      <a-modal

        v-model:open="userNameModalVisible"

        title="Set workspace user"

        :closable="!userNameModalRequired"

        :maskClosable="!userNameModalRequired"

        destroyOnClose

        @cancel="handleUserNameCancel"

      >

        <p class="user-modal-desc">

          Enter a user name to open that user's workspace. Using the same name resumes that thread;
          a new name starts a blank one.

        </p>

        <a-form layout="vertical">

          <a-form-item

            label="User name"

            :validate-status="userNameError ? 'error' : ''"

            :help="userNameError || ''"

          >

            <a-input

              v-model:value="pendingUserName"

              placeholder="Enter your name, e.g. Test_01"

              @pressEnter="handleUserNameSubmit"

            />

          </a-form-item>

        </a-form>

        <template #footer>

          <div class="user-modal-footer">

            <a-button v-if="!userNameModalRequired" @click="handleUserNameCancel">Cancel</a-button>

            <a-button type="primary" @click="handleUserNameSubmit">Save</a-button>

          </div>

        </template>

      </a-modal>

      </div>

    </a-spin>

  </div>

</template>



<script setup lang="ts">

import {
  useDesignerStore,
  type SubtopicSummary,
  type TopicJob,
  type TopicJobStatus,
  type ImportedTopicSummary,
} from '@/stores/designer'

import { storeToRefs } from 'pinia'

import { computed, onMounted, onBeforeUnmount, ref, reactive, createVNode, watch, nextTick } from 'vue'

import { register } from '@antv/x6-vue-shape'

import StageNode from '@/components/StageNode.vue'
import { Cell, Graph, Path, Shape } from '@antv/x6'
import OptionNode from '@/components/OptionNode.vue'
import JumpNode from '@/components/JumpNode.vue'
import { Modal, message } from 'ant-design-vue'
import { DownOutlined, ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons-vue'
import { v4 as uuidV4 } from 'uuid'
import { buildConversationScript } from '@/utils/conversationScript'
import { buildTopicScriptFromCells, sanitizeTopicName } from '@/utils/topicScript'
import { transform2AntvJson } from '@/utils/transform2AntvJson'
import type { StageNode as ImportedStageNode } from '@/utils/formatGeneticCounseling'
import { sanitizeMenuTitle } from '@/utils/menuText'
import {
  buildDefaultTopicChoiceLabel,
  buildOrderedPlanTopicNames,
  normalizeTopicRouting,
} from '@/utils/topicRouting'
import { compareFlowOrder, getFlowOrderDepth, hasFlowOrder, parseFlowOrder } from '@/utils/flowOrder'
import { paletteByIndex } from '@/utils/statePalette'
import {
  END_CONVERSATION_TARGET,
  JUMP_NODE_HEIGHT,
  JUMP_NODE_SHAPE,
  JUMP_NODE_WIDTH,
  getJumpNodeTargetState,
  getJumpNodeTargetTopic,
  isEndConversationTarget,
  isCrossTopicOptionCell,
  isJumpNodeCell,
  stripCrossTopicArtifacts,
  stripManagedCrossTopicArtifacts,
} from '@/utils/crossTopicJumps'
import {
  STAGE_NODE_OPTION_ITEM_HEIGHT,
  STAGE_NODE_OPTION_ITEM_LEFT,
  STAGE_NODE_OPTION_ITEM_WIDTH,
  STAGE_NODE_TOP_CONTENT_HEIGHT,
  STAGE_NODE_WIDTH,
  calcStageNodeHeight,
} from '@/constants/stageLayout'
import {
  parseR2JError,
  requestR2JExportTopic,
  requestR2JHealth,
  requestR2JPreview,
  type R2JErrorPayload,
} from '@/services/r2j'
import { requestWorkspacePresence } from '@/services/workspaceStorage'
import { useGraphSnapshotQueue } from '@/composables/useGraphSnapshotQueue'
import { useConvertTour } from '@/composables/useConvertTour'
import { useFrameScheduler } from '@/composables/useFrameScheduler'
import { useWorkspacePersistence } from '@/composables/useWorkspacePersistence'

const STAGE_PORT_ATTRS = {
  magnet: true,
  stroke: '#8f8f8f',
  r: 7,
}

const JUMP_PORT_ATTRS = {
  magnet: true,
  stroke: '#8f8f8f',
  fill: '#ffffff',
  r: 7,
}

const OPTION_PORT_DISCONNECTED_ATTRS = {
  magnet: true,
  stroke: '#ff4d4f',
  fill: '#fff1f0',
  r: 8,
}

const OPTION_PORT_CONNECTED_ATTRS = {
  magnet: true,
  stroke: '#52c41a',
  fill: '#f6ffed',
  r: 7,
}

const EDGE_LINE_BASE_ATTRS = {
  stroke: '#5c6678',
  strokeWidth: 1,
  strokeOpacity: 0.62,
}

const EDGE_LINE_MAINLINE_ATTRS = {
  stroke: '#2f67d8',
  strokeWidth: 2.8,
  strokeOpacity: 0.94,
}

const EDGE_LINE_ACTIVE_ATTRS = {
  stroke: '#1677ff',
  strokeWidth: 2.2,
  strokeOpacity: 0.95,
}

const EDGE_LINE_DIM_ATTRS = {
  stroke: '#9aa3b2',
  strokeWidth: 1,
  strokeOpacity: 0.22,
}

let cachedMainlineEdgeIds = new Set<string>()

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
            ...STAGE_PORT_ATTRS,
          },
        },
      },
    },
  },
})

register({
  shape: 'option-node',
  width: STAGE_NODE_OPTION_ITEM_WIDTH,
  height: STAGE_NODE_OPTION_ITEM_HEIGHT,
  ports: {
    groups: {
      right: {
        position: 'right',
        attrs: {
          circle: {
            ...OPTION_PORT_DISCONNECTED_ATTRS,
          },
        },
      },
    },
  },
  component: OptionNode,
})

register({
  shape: JUMP_NODE_SHAPE,
  width: JUMP_NODE_WIDTH,
  height: JUMP_NODE_HEIGHT,
  component: JumpNode,
  ports: {
    groups: {
      left: {
        position: 'left',
        attrs: {
          circle: {
            ...JUMP_PORT_ATTRS,
          },
        },
      },
    },
  },
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
  restoreLastUserSession,
  switchUserSession,
  buildUserScopedKey,
  importDialogueFromScript,
  applyUserThreadSnapshot,
  applyGenerationStateSnapshot,
  applyAnalyticsStateSnapshot,
  persistAllUserScopedState,
  recordAnalyticsEvent,
  buildCurrentAnalyticsSummary,
  buildUserThreadSnapshot,
  buildGenerationStateSnapshot,
  buildAnalyticsStateSnapshot,
  prepareTopicGeneration,
  consumeNextConvertWorkspaceRestoreSkipped,
  saveWorkspaceToServer,
  loadWorkspaceFromServer,
  upsertManualTopicPlan,
  deleteManualTopicPlan,
} = designerStore

const {
  graph,
  convertContent,
  stateContent,
  topicGraph,
  topicScripts,
  topicGraphSelected,
  generationQueue,
  generationCancelled,
  generationProcessing,
  queryTopicStrucLoading,
  topicIssues,
  api1Result,
  sessionTopics,
  authoringMode,
  userName,
  userSessionReady,
  analyticsState,
} = storeToRefs(designerStore)

const isManualAuthoringMode = computed(() => authoringMode.value === 'manual')

const importInput = ref<HTMLInputElement | null>(null)
const importLoading = ref(false)
const exportLoading = ref(false)
const previewLoading = ref(false)

const designerSurface = ref<HTMLElement | null>(null)
const agentPreviewFrame = ref<HTMLIFrameElement | null>(null)
const agentPanelVisible = ref(false)
const agentPanelCollapsed = ref(false)
const agentPanelWidth = ref(520)
const agentPanelHeight = ref(340)
const agentPanelResizeActive = ref(false)
const previewErrorSummary = ref('')
const previewErrorDetail = ref('')
const previewErrorExpanded = ref(false)
const guidePulseDismissed = ref(false)

const activePreviewTopic = ref<string | null>(null)
const activePreviewState = ref<string | null>(null)
const selectedGraphState = ref<string | null>(null)
const previewLastStateByTopic = reactive<Record<string, string>>({})
const pendingPreviewMessages = ref<Record<string, unknown>[]>([])
const previewRuntimeReady = ref(false)
let previewReadyTimer: number | null = null
const previewQueueInFlight = ref(false)
const queuedPreviewState = ref<string | null | undefined>(undefined)
const relationFocusStateNodeId = ref<string | null>(null)

const PREVIEW_EVENT_NAME = 'healthdial:preview-from-state'
const AGENT_HOST_EVENT_PREFIX = 'healthdial-agent'
const DEFAULT_UNITY_PREVIEW_URL = 'https://ragstudy.ccs.neu.edu/cervix/healthdialrag/'
const PREVIEW_CACHE_TTL_MS = 120000
const AGENT_SWITCH_TYPE = `${AGENT_HOST_EVENT_PREFIX}:switch-agent`
const AGENT_PANEL_COLLAPSED_WIDTH = 224
const AGENT_PANEL_MIN_WIDTH = 320
const AGENT_PANEL_MIN_HEIGHT = 220
const AGENT_PANEL_MAX_WIDTH = 860
const AGENT_PANEL_MAX_HEIGHT = 680
const PREVIEW_AGENT_ALIASES = {
  Laura: 'Church',
  Mary: 'Roleplay1',
} as const

type AgentPanelResizeMode = 'width' | 'height' | 'both'

let agentPanelResizeSession:
  | {
      mode: AgentPanelResizeMode
      startX: number
      startY: number
      startWidth: number
      startHeight: number
    }
  | null = null

type PreviewAgentName = keyof typeof PREVIEW_AGENT_ALIASES

type PreviewBeatCacheEntry = {
  beatJson: string
  createdAt: number
}

const previewBeatCache = new Map<string, PreviewBeatCacheEntry>()
const selectedPreviewAgent = ref<PreviewAgentName>('Laura')
const isPreviewBusy = computed(() => previewLoading.value || previewQueueInFlight.value)
const previewStatusText = computed(() => {
  if (previewLoading.value) {
    return 'Loading dialogue preview...'
  }
  if (previewQueueInFlight.value && queuedPreviewState.value !== undefined) {
    return 'Updating to your latest selected state...'
  }
  if (agentPanelVisible.value && !previewRuntimeReady.value) {
    return 'Waiting for Unity runtime...'
  }
  return ''
})

const {
  tourActive,
  tourStepIndex,
  activeTourSteps,
  currentTourStep,
  tourHighlightStyle,
  tourCardStyle,
  startTour,
  endTour,
  nextTourStep,
  previousTourStep,
  updateTourTarget,
} = useConvertTour({
  isManualAuthoringMode,
  agentPanelVisible,
})

const getAgentPanelBounds = () => {
  const surfaceWidth = designerSurface.value?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280)
  const surfaceHeight = designerSurface.value?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 720)
  return {
    maxWidth: Math.max(AGENT_PANEL_MIN_WIDTH, Math.min(AGENT_PANEL_MAX_WIDTH, surfaceWidth - 24)),
    maxHeight: Math.max(AGENT_PANEL_MIN_HEIGHT, Math.min(AGENT_PANEL_MAX_HEIGHT, surfaceHeight - 24)),
  }
}

const clampAgentPanelSize = (width: number, height: number) => {
  const { maxWidth, maxHeight } = getAgentPanelBounds()
  return {
    width: Math.min(maxWidth, Math.max(AGENT_PANEL_MIN_WIDTH, Math.round(width))),
    height: Math.min(maxHeight, Math.max(AGENT_PANEL_MIN_HEIGHT, Math.round(height))),
  }
}

const applyAgentPanelSize = (width: number, height: number) => {
  const next = clampAgentPanelSize(width, height)
  agentPanelWidth.value = next.width
  agentPanelHeight.value = next.height
}

const syncAgentPanelSizeToViewport = () => {
  applyAgentPanelSize(agentPanelWidth.value, agentPanelHeight.value)
}

const agentPanelStyle = computed(() => {
  if (agentPanelCollapsed.value) {
    return {
      width: `${AGENT_PANEL_COLLAPSED_WIDTH}px`,
    }
  }

  return {
    width: `${agentPanelWidth.value}px`,
    height: `${agentPanelHeight.value}px`,
  }
})

const stopAgentPanelResize = () => {
  agentPanelResizeSession = null
  agentPanelResizeActive.value = false

  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onAgentPanelResizeMove)
    window.removeEventListener('mouseup', stopAgentPanelResize)
  }

  persistWorkspace()
}

function onAgentPanelResizeMove(event: MouseEvent) {
  if (!agentPanelResizeSession) {
    return
  }

  const deltaX = event.clientX - agentPanelResizeSession.startX
  const deltaY = event.clientY - agentPanelResizeSession.startY
  const nextWidth =
    agentPanelResizeSession.mode === 'height'
      ? agentPanelResizeSession.startWidth
      : agentPanelResizeSession.startWidth - deltaX
  const nextHeight =
    agentPanelResizeSession.mode === 'width'
      ? agentPanelResizeSession.startHeight
      : agentPanelResizeSession.startHeight - deltaY

  applyAgentPanelSize(nextWidth, nextHeight)
}

const startAgentPanelResize = (mode: AgentPanelResizeMode, event: MouseEvent) => {
  if (agentPanelCollapsed.value) {
    return
  }

  agentPanelResizeSession = {
    mode,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: agentPanelWidth.value,
    startHeight: agentPanelHeight.value,
  }
  agentPanelResizeActive.value = true

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onAgentPanelResizeMove)
    window.addEventListener('mouseup', stopAgentPanelResize)
  }
}

const resolveAgentPreviewUrl = () => {
  const fromEnv = ((import.meta.env.VITE_UNITY_PREVIEW_URL as string) || '').trim()
  if (fromEnv) {
    return fromEnv
  }
  return DEFAULT_UNITY_PREVIEW_URL
}
const agentPreviewUrl = ref(resolveAgentPreviewUrl())

const getAgentPreviewOrigin = () => {
  if (typeof window === 'undefined') {
    return '*'
  }

  try {
    return new URL(agentPreviewUrl.value, window.location.href).origin
  } catch (error) {
    console.warn('Failed to resolve Unity preview origin from URL:', agentPreviewUrl.value, error)
    return '*'
  }
}

const OPTION_NODE_SHAPE = 'option-node'
const STAGE_NODE_SHAPE = 'stage-node'
const GRAPH_HYDRATING_FLAG = '__healthdialHydrating'

const normalizeTopicKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')

const toCellId = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : ''
  }
  return ''
}

const getStageChildId = (child: unknown) => {
  if (typeof child === 'string') {
    return child
  }
  if (child && typeof child === 'object' && 'id' in child) {
    const id = (child as { id?: unknown }).id
    return typeof id === 'string' ? id : ''
  }
  return ''
}

const normalizeDisplayLabel = (value: string, fallback = 'Untitled Topic') => {
  const normalized = value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (!normalized.length) {
    return fallback
  }

  return normalized
    .split(' ')
    .filter((entry) => entry.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const buildDefaultRouteLabel = (topicName: string) => {
  if (isEndConversationTarget(topicName)) {
    return "Thank you, that's all for now."
  }
  return buildDefaultTopicChoiceLabel(topicName)
}

const isGraphHydrating = () => Boolean((graph.value as any)?.[GRAPH_HYDRATING_FLAG])

const replaceGraphCells = (cells: Cell.Properties[]) => {
  if (!graph.value) {
    return
  }

  const graphInstance = graph.value as any
  graphInstance[GRAPH_HYDRATING_FLAG] = true
  try {
    const clearCells = (graph.value as any).clearCells
    if (typeof clearCells === 'function') {
      clearCells.call(graph.value)
    }
    graph.value.fromJSON(cells as any)
  } finally {
    graphInstance[GRAPH_HYDRATING_FLAG] = false
  }

  void nextTick(() => {
    realignAllStageOptionLayouts()
    refreshEdgePresentation()
    if (topicGraphSelected.value) {
      flushGraphSnapshot(topicGraphSelected.value)
    }
  })
}

const userNameModalVisible = ref(false)
const userNameModalRequired = ref(false)
const pendingUserName = ref('')
const userNameError = ref('')

const userNameDisplay = computed(() => (userName.value || '').trim())

const openUserNameModal = (required = false) => {
  userNameModalRequired.value = required
  pendingUserName.value = required && !userSessionReady.value ? '' : userNameDisplay.value
  userNameError.value = ''
  userNameModalVisible.value = true
}

const handleUserNameSubmit = async () => {
  const trimmed = pendingUserName.value.trim()
  if (!trimmed.length) {
    userNameError.value = 'Please enter your name.'
    return
  }
  if (userSessionReady.value && userNameDisplay.value) {
    persistWorkspace({ forceCurrentGraphSnapshot: true })
    await syncWorkspaceToServer({
      reason: 'user-switch',
      createSnapshot: true,
      silent: true,
      forceCurrentGraphSnapshot: true,
    })
  }
  const result = switchUserSession(trimmed)
  if (result.threadChanged) {
    await applyUserSwitch(result)
    message.success(
      result.restored
        ? `Loaded workspace for ${result.userName}.`
        : `Started a new workspace for ${result.userName}.`,
    )
  }
  userNameModalVisible.value = false
}

const handleUserNameCancel = () => {
  if (userNameModalRequired.value) {
    return
  }
  userNameError.value = ''
  userNameModalVisible.value = false
}

const handleGlobalUserNameModalRequest = () => {
  openUserNameModal()
}

const applyOptionPortAttrs = (node: any, attrs: Record<string, unknown>) => {
  const ports = node?.getPorts?.() ?? []
  if (!ports.length) {
    return
  }
  const { id } = ports[0]
  if (!id) {
    return
  }
  Object.entries(attrs).forEach(([key, value]) => {
    node.setPortProp?.(id, `attrs/circle/${key}`, value)
  })
}

const updateOptionNodePortState = (node: any) => {
  if (!node || node.shape !== OPTION_NODE_SHAPE) {
    return
  }
  const edges = graph.value?.getConnectedEdges?.(node) ?? []
  const isConnected = edges.some((edge: any) => edge?.getSourceCellId?.() === node.id)
  const attrs = isConnected ? OPTION_PORT_CONNECTED_ATTRS : OPTION_PORT_DISCONNECTED_ATTRS
  applyOptionPortAttrs(node, attrs)
}

const normalizeEdgeTerminalPort = (edge: any, terminal: 'source' | 'target') => {
  if (!edge || !graph.value) {
    return
  }

  const cellId =
    terminal === 'source' ? edge?.getSourceCellId?.() : edge?.getTargetCellId?.()
  if (!cellId) {
    return
  }

  const cell = graph.value.getCellById?.(cellId) as any
  if (!cell) {
    return
  }

  if (
    cell.shape !== OPTION_NODE_SHAPE &&
    cell.shape !== STAGE_NODE_SHAPE &&
    cell.shape !== JUMP_NODE_SHAPE
  ) {
    return
  }

  const expectedPortId = getFirstPortId(cell)
  if (!expectedPortId) {
    return
  }

  const terminalPayload = {
    cell: cellId,
    port: expectedPortId,
    anchor: terminal === 'source' ? 'right' : 'left',
  }

  if (terminal === 'source') {
    edge.setSource(terminalPayload)
    return
  }

  edge.setTarget(terminalPayload)
}

const normalizeEdgeTerminals = (edge: any) => {
  normalizeEdgeTerminalPort(edge, 'source')
  normalizeEdgeTerminalPort(edge, 'target')
}

const syncOptionNodeCrossTopicState = (node: any) => {
  if (!node || node.shape !== OPTION_NODE_SHAPE || !graph.value) {
    return
  }

  const data = node.getData?.() ?? node.data ?? {}
  const outgoingEdges = graph.value
    .getEdges?.()
    ?.filter((edge: any) => String(edge?.getSourceCellId?.() ?? '') === String(node.id)) ?? []
  const pointsToJumpNode = outgoingEdges.some((edge: any) => {
    const targetCell = graph.value?.getCellById?.(edge?.getTargetCellId?.()) as any
    return targetCell?.shape === JUMP_NODE_SHAPE
  })
  const nextCrossTopic = Boolean(data.routeManaged || pointsToJumpNode)
  if (Boolean(data.crossTopic) === nextCrossTopic) {
    return
  }

  node.setData({
    ...data,
    crossTopic: nextCrossTopic,
  })
}

const updateOptionPortByCellId = (cellId: string | null | undefined) => {
  if (!cellId || !graph.value) {
    return
  }
  const cell = graph.value.getCellById(cellId)
  if (cell?.shape === OPTION_NODE_SHAPE) {
    updateOptionNodePortState(cell)
  }
}

const refreshAllOptionNodePorts = () => {
  const nodes = graph.value?.getNodes?.() ?? []
  nodes.forEach((node: any) => {
    updateOptionNodePortState(node)
    syncOptionNodeCrossTopicState(node)
  })
}

const applyEdgeVisualState = (edge: any, mode: 'default' | 'active' | 'dim') => {
  if (!edge) {
    return
  }
  const edgeId = String(edge?.id ?? '')
  const lineAttrs =
    mode === 'active'
      ? EDGE_LINE_ACTIVE_ATTRS
      : mode === 'dim'
      ? EDGE_LINE_DIM_ATTRS
      : cachedMainlineEdgeIds.has(edgeId)
      ? EDGE_LINE_MAINLINE_ATTRS
      : EDGE_LINE_BASE_ATTRS

  edge.setAttrs({
    line: {
      ...lineAttrs,
    },
  })
}

const applyEdgeRoutingAndStyle = (edge: any) => {
  if (!edge) {
    return
  }
  edge.removeTool?.('vertices')
  edge.removeProp?.('router')
  edge.removeProp?.('connector')
  if (!relationFocusStateNodeId.value) {
    applyEdgeVisualState(edge, 'default')
  }
}

const normalizeAllEdges = () => {
  rebuildMainlineEdgeCache()
  const edges = graph.value?.getEdges?.() ?? []
  edges.forEach((edge: any) => applyEdgeRoutingAndStyle(edge))
}

const setNodeRelationState = (node: any, active: boolean, dim: boolean) => {
  if (!node || (node.shape !== STAGE_NODE_SHAPE && node.shape !== OPTION_NODE_SHAPE && node.shape !== JUMP_NODE_SHAPE)) {
    return
  }
  const data = node.getData?.() ?? node.data ?? {}
  if (Boolean(data.relationActive) === active && Boolean(data.relationDim) === dim) {
    return
  }
  node.setData({
    ...data,
    relationActive: active,
    relationDim: dim,
  })
}

const clearRelationFocusHighlight = () => {
  relationFocusStateNodeId.value = null
  const nodes = graph.value?.getNodes?.() ?? []
  nodes.forEach((node: any) => {
    if (node.shape === STAGE_NODE_SHAPE || node.shape === OPTION_NODE_SHAPE || node.shape === JUMP_NODE_SHAPE) {
      setNodeRelationState(node, false, false)
    }
  })
  const edges = graph.value?.getEdges?.() ?? []
  edges.forEach((edge: any) => applyEdgeVisualState(edge, 'default'))
}

const highlightRelationByStateNode = (stateNode: any) => {
  if (!graph.value || !stateNode || stateNode.shape !== 'stage-node') {
    clearRelationFocusHighlight()
    return
  }

  relationFocusStateNodeId.value = stateNode.id
  const edges = graph.value.getEdges?.() ?? []
  const nodes = graph.value.getNodes?.() ?? []
  const outgoingOptionIds = new Set<string>(
    ((stateNode.getChildren?.() ?? []) as any[])
      .filter((child) => child?.shape === OPTION_NODE_SHAPE)
      .map((child) => String(child.id)),
  )

  const activeStageIds = new Set<string>([String(stateNode.id)])
  const activeOptionIds = new Set<string>(outgoingOptionIds)
  const activeJumpIds = new Set<string>()
  const activeEdgeIds = new Set<string>()

  edges.forEach((edge: any) => {
    const sourceId = String(edge?.getSourceCellId?.() ?? '')
    const targetId = String(edge?.getTargetCellId?.() ?? '')
    if (!sourceId || !targetId) {
      return
    }

    if (targetId === String(stateNode.id)) {
      activeEdgeIds.add(String(edge.id))
      activeOptionIds.add(sourceId)
      const sourceCell = graph.value?.getCellById?.(sourceId) as any
      const sourceParent = sourceCell?.getParent?.()
      if (sourceParent?.shape === 'stage-node') {
        activeStageIds.add(String(sourceParent.id))
      }
    }

    if (outgoingOptionIds.has(sourceId)) {
      activeEdgeIds.add(String(edge.id))
      activeOptionIds.add(sourceId)
      const targetCell = graph.value?.getCellById?.(targetId) as any
      if (targetCell?.shape === STAGE_NODE_SHAPE) {
        activeStageIds.add(String(targetCell.id))
      } else if (targetCell?.shape === JUMP_NODE_SHAPE) {
        activeJumpIds.add(String(targetCell.id))
      }
    }
  })

  nodes.forEach((node: any) => {
    if (node.shape === STAGE_NODE_SHAPE) {
      const isActive = activeStageIds.has(String(node.id))
      setNodeRelationState(node, isActive, !isActive)
      return
    }
    if (node.shape === OPTION_NODE_SHAPE) {
      const isActive = activeOptionIds.has(String(node.id))
      setNodeRelationState(node, isActive, !isActive)
      return
    }
    if (node.shape === JUMP_NODE_SHAPE) {
      const isActive = activeJumpIds.has(String(node.id))
      setNodeRelationState(node, isActive, !isActive)
    }
  })

  edges.forEach((edge: any) => {
    const isActive = activeEdgeIds.has(String(edge.id))
    applyEdgeVisualState(edge, isActive ? 'active' : 'dim')
  })
}

const refreshEdgePresentation = () => {
  normalizeAllEdges()
  if (!relationFocusStateNodeId.value) {
    return
  }
  const focusNode = graph.value?.getCellById?.(relationFocusStateNodeId.value) as any
  if (!focusNode || focusNode.shape !== 'stage-node') {
    clearRelationFocusHighlight()
    return
  }
  highlightRelationByStateNode(focusNode)
}

const {
  schedule: scheduleEdgePresentationRefresh,
  cancel: cancelScheduledEdgePresentationRefresh,
} = useFrameScheduler(refreshEdgePresentation)

const realignStageOptionLayout = (stageNode: any) => {
  if (!graph.value || !stageNode || stageNode.shape !== 'stage-node') {
    return
  }

  const data = stageNode.getData?.() ?? stageNode.data ?? {}
  const menus = Array.isArray(data?.menus) ? data.menus : []
  const measuredHeight = Number(data?.measuredHeight)
  const menuOffsetTop = Number(data?.menuOffsetTop)

  const expectedHeight = Math.max(
    calcStageNodeHeight(menus.length),
    Number.isFinite(measuredHeight) ? measuredHeight : 0,
  )
  const currentSize = stageNode.getSize?.() ?? stageNode.size?.()
  if (
    !currentSize ||
    Number(currentSize.width) !== STAGE_NODE_WIDTH ||
    Number(currentSize.height) !== expectedHeight
  ) {
    stageNode.resize(STAGE_NODE_WIDTH, expectedHeight)
  }

  const stagePosition = stageNode.getPosition?.() ?? { x: 0, y: 0 }
  const resolvedMenuOffsetTop =
    Number.isFinite(menuOffsetTop) && menuOffsetTop > 0
      ? menuOffsetTop
      : STAGE_NODE_TOP_CONTENT_HEIGHT
  menus.forEach((menu: any, index: number) => {
    const optionId = typeof menu?.id === 'string' ? menu.id : ''
    if (!optionId) return
    const optionNode = graph.value?.getCellById(optionId) as any
    if (!optionNode || optionNode.shape !== OPTION_NODE_SHAPE) return

    const expectedX = Number(stagePosition.x) + STAGE_NODE_OPTION_ITEM_LEFT
    const expectedY =
      Number(stagePosition.y) + resolvedMenuOffsetTop + index * STAGE_NODE_OPTION_ITEM_HEIGHT

    const optionPosition = optionNode.getPosition?.() ?? { x: NaN, y: NaN }
    if (Number(optionPosition.x) !== expectedX || Number(optionPosition.y) !== expectedY) {
      optionNode.position(expectedX, expectedY)
    }

    const optionSize = optionNode.getSize?.() ?? optionNode.size?.()
    if (
      !optionSize ||
      Number(optionSize.width) !== STAGE_NODE_OPTION_ITEM_WIDTH ||
      Number(optionSize.height) !== STAGE_NODE_OPTION_ITEM_HEIGHT
    ) {
      optionNode.resize(STAGE_NODE_OPTION_ITEM_WIDTH, STAGE_NODE_OPTION_ITEM_HEIGHT)
    }
  })
}

const realignAllStageOptionLayouts = () => {
  const nodes = graph.value?.getNodes?.().filter((node: any) => node.shape === 'stage-node') ?? []
  nodes.forEach((stageNode: any) => realignStageOptionLayout(stageNode))
}

type TopicStageCell = Cell.Properties & {
  data?: {
    name?: string
    agent?: string
    subtopic?: string
    miTechnique?: string
    isTopicStart?: boolean
    flowOrder?: string
    menus?: Array<Record<string, unknown>>
  }
  children?: Array<string | { id?: string }>
}

type TopicOptionCell = Cell.Properties & {
  data?: {
    title?: string
    status?: string
    crossTopic?: boolean
    routeManaged?: boolean
    nextStage?: string
  }
  ports?: Array<{ id?: string; group?: string }>
}

type TopicJumpCell = Cell.Properties & {
  data?: {
    targetTopic?: string
    targetState?: string
    sourceTopic?: string
    sourceState?: string
    routeManaged?: boolean
    routeTargetIndex?: number
  }
}

type TopicEdgeCell = Cell.Properties & {
  source?: { cell?: string | { id?: string }; port?: string }
  target?: { cell?: string | { id?: string }; port?: string }
}

type StageGraphStats = {
  incomingCount: number
  outgoingStageCount: number
  unresolvedOptionCount: number
}

const getStageCellName = (cell: Cell.Properties | undefined | null) => {
  const value = (cell as TopicStageCell | undefined)?.data?.name
  return typeof value === 'string' ? value.trim() : ''
}

const getTopicStageCells = (cells: Cell.Properties[] | undefined) =>
  (cells ?? []).filter((cell) => cell.shape === STAGE_NODE_SHAPE) as TopicStageCell[]

const getTopicOptionCells = (cells: Cell.Properties[] | undefined) =>
  (cells ?? []).filter((cell) => cell.shape === OPTION_NODE_SHAPE) as TopicOptionCell[]

const getTopicJumpCells = (cells: Cell.Properties[] | undefined) =>
  (cells ?? []).filter((cell) => isJumpNodeCell(cell)) as TopicJumpCell[]

const getTopicEdgeCells = (cells: Cell.Properties[] | undefined) =>
  (cells ?? []).filter((cell) => cell.shape === 'edge') as TopicEdgeCell[]

const cloneTopicGraphCells = (cells: Cell.Properties[] | undefined) => {
  if (!Array.isArray(cells)) {
    return [] as Cell.Properties[]
  }

  try {
    return JSON.parse(JSON.stringify(cells)) as Cell.Properties[]
  } catch {
    return [...cells]
  }
}

const normalizeStageOptionLayoutCells = (cells: Cell.Properties[] | undefined) => {
  const cloned = cloneTopicGraphCells(cells)
  const cellById = new Map(
    cloned
      .map((cell) => [typeof cell.id === 'string' ? cell.id : '', cell] as const)
      .filter(([id]) => id.length > 0),
  )

  cloned
    .filter((cell) => cell.shape === STAGE_NODE_SHAPE)
    .forEach((stageCell) => {
      const stagePosition = stageCell.position ?? {
        x: typeof (stageCell as { x?: unknown }).x === 'number' ? Number((stageCell as { x?: unknown }).x) : 0,
        y: typeof (stageCell as { y?: unknown }).y === 'number' ? Number((stageCell as { y?: unknown }).y) : 0,
      }
      const menus = Array.isArray((stageCell as TopicStageCell).data?.menus)
        ? ((stageCell as TopicStageCell).data?.menus ?? [])
        : []
      const menuOffsetTop = Number((stageCell as TopicStageCell).data?.menuOffsetTop)
      const resolvedMenuOffsetTop =
        Number.isFinite(menuOffsetTop) && menuOffsetTop > 0
          ? menuOffsetTop
          : STAGE_NODE_TOP_CONTENT_HEIGHT

      menus.forEach((menu: Record<string, unknown>, index: number) => {
        const optionId = typeof menu?.id === 'string' ? menu.id : ''
        const optionCell = optionId ? cellById.get(optionId) : null
        if (!optionCell || optionCell.shape !== OPTION_NODE_SHAPE) {
          return
        }

        optionCell.position = {
          x: Number(stagePosition.x ?? 0) + STAGE_NODE_OPTION_ITEM_LEFT,
          y: Number(stagePosition.y ?? 0) + resolvedMenuOffsetTop + index * STAGE_NODE_OPTION_ITEM_HEIGHT,
        }
        optionCell.size = {
          width: STAGE_NODE_OPTION_ITEM_WIDTH,
          height: STAGE_NODE_OPTION_ITEM_HEIGHT,
        }
        ;(optionCell as { width?: number; height?: number }).width = STAGE_NODE_OPTION_ITEM_WIDTH
        ;(optionCell as { width?: number; height?: number }).height = STAGE_NODE_OPTION_ITEM_HEIGHT
        optionCell.parent = typeof stageCell.id === 'string' ? stageCell.id : optionCell.parent
      })
    })

  return cloned
}

const sortTopicStageCells = (stages: TopicStageCell[]) =>
  [...stages].sort((left, right) => {
    const flowComparison = compareFlowOrder(left.data?.flowOrder, right.data?.flowOrder)
    if (flowComparison !== 0) return flowComparison
    const leftY = typeof left.position?.y === 'number' ? left.position.y : 0
    const rightY = typeof right.position?.y === 'number' ? right.position.y : 0
    if (leftY !== rightY) return leftY - rightY
    const leftX = typeof left.position?.x === 'number' ? left.position.x : 0
    const rightX = typeof right.position?.x === 'number' ? right.position.x : 0
    return leftX - rightX
  })

const resolveTopicStartStageId = (cells: Cell.Properties[] | undefined) => {
  const stages = sortTopicStageCells(getTopicStageCells(cells))
  if (!stages.length) {
    return null
  }

  const explicitStart = stages.find((cell) => Boolean(cell.data?.isTopicStart))
  if (typeof explicitStart?.id === 'string') {
    return explicitStart.id
  }

  const stageIds = new Set(
    stages
      .map((cell) => (typeof cell.id === 'string' ? cell.id : ''))
      .filter((cellId) => cellId.length > 0),
  )
  const incomingCounts = new Map<string, number>()
  stageIds.forEach((cellId) => incomingCounts.set(cellId, 0))

  getTopicEdgeCells(cells).forEach((edge) => {
    const targetCell = edge.target?.cell
    const targetCellId =
      typeof targetCell === 'string'
        ? targetCell
        : typeof (targetCell as { id?: string } | undefined)?.id === 'string'
          ? (targetCell as { id: string }).id
          : ''
    if (!stageIds.has(targetCellId)) {
      return
    }
    incomingCounts.set(targetCellId, (incomingCounts.get(targetCellId) || 0) + 1)
  })

  const rootStage = stages.find((cell) => {
    const cellId = typeof cell.id === 'string' ? cell.id : ''
    return cellId.length > 0 && (incomingCounts.get(cellId) || 0) === 0
  })

  if (typeof rootStage?.id === 'string') {
    return rootStage.id
  }

  return typeof stages[0]?.id === 'string' ? stages[0].id : null
}

const normalizeTopicStartFlags = (cells: Cell.Properties[] | undefined) => {
  const normalizedCells = cloneTopicGraphCells(cells)
  const startStageId = resolveTopicStartStageId(normalizedCells)
  let changed = false

  const nextCells = normalizedCells.map((cell: Cell.Properties) => {
    if (cell.shape !== STAGE_NODE_SHAPE) {
      return cell
    }

    const cellId = typeof cell.id === 'string' ? cell.id : ''
    const nextIsTopicStart = Boolean(startStageId && cellId === startStageId)
    if (Boolean((cell as TopicStageCell).data?.isTopicStart) === nextIsTopicStart) {
      return cell
    }

    changed = true
    return {
      ...cell,
      data: {
        ...(cell.data as Record<string, unknown> | undefined),
        isTopicStart: nextIsTopicStart,
      },
    }
  })

  return {
    cells: nextCells,
    changed,
    startStageId,
  }
}

const findParentStageForOptionNodeId = (optionNodeId: string) => {
  if (!optionNodeId || !graph.value) {
    return null
  }

  const stageNodes = graph.value.getNodes?.().filter((node: any) => node.shape === STAGE_NODE_SHAPE) ?? []
  return (
    stageNodes.find((node: any) =>
      ((node.getChildren?.() ?? []) as any[]).some((child: any) => String(child?.id ?? '') === optionNodeId),
    ) ?? null
  )
}

const rebuildMainlineEdgeCache = () => {
  cachedMainlineEdgeIds = new Set<string>()
  if (!graph.value) {
    return
  }

  const stageNodes = graph.value.getNodes?.().filter((node: any) => node.shape === STAGE_NODE_SHAPE) ?? []
  const mainlineNodes = stageNodes
    .filter((node: any) => getFlowOrderDepth(node?.getData?.()?.flowOrder ?? node?.data?.flowOrder) === 2)
    .sort((left: any, right: any) =>
      compareFlowOrder(
        left?.getData?.()?.flowOrder ?? left?.data?.flowOrder,
        right?.getData?.()?.flowOrder ?? right?.data?.flowOrder,
      ),
    )

  if (mainlineNodes.length < 2) {
    return
  }

  const edges = graph.value.getEdges?.() ?? []
  for (let index = 0; index < mainlineNodes.length - 1; index += 1) {
    const sourceStageId = String(mainlineNodes[index]?.id ?? '')
    const targetStageId = String(mainlineNodes[index + 1]?.id ?? '')
    const sourceFlow = parseFlowOrder(
      mainlineNodes[index]?.getData?.()?.flowOrder ?? mainlineNodes[index]?.data?.flowOrder,
    )
    const targetFlow = parseFlowOrder(
      mainlineNodes[index + 1]?.getData?.()?.flowOrder ?? mainlineNodes[index + 1]?.data?.flowOrder,
    )

    edges.forEach((edge: any) => {
      const sourceOptionId = String(edge?.getSourceCellId?.() ?? '')
      const targetCellId = String(edge?.getTargetCellId?.() ?? '')
      if (!sourceOptionId || targetCellId !== targetStageId) {
        return
      }

      const parentStage = findParentStageForOptionNodeId(sourceOptionId) as any
      if (!parentStage || String(parentStage.id ?? '') !== sourceStageId) {
        return
      }

      if (
        sourceFlow &&
        targetFlow &&
        sourceFlow.length === 2 &&
        targetFlow.length === 2 &&
        targetFlow[0] === sourceFlow[0] &&
        targetFlow[1] === sourceFlow[1] + 1
      ) {
        cachedMainlineEdgeIds.add(String(edge.id ?? ''))
      }
    })
  }
}

const getFirstPortId = (cell: any) => {
  const ports = Array.isArray(cell?.ports)
    ? cell.ports
    : Array.isArray(cell?.ports?.items)
      ? cell.ports.items
      : []
  const first = ports.find((entry: any) => typeof entry?.id === 'string' && entry.id.trim().length)
  return typeof first?.id === 'string' ? first.id : ''
}

const buildAvailableTopicNames = () => {
  const seeded = buildOrderedPlanTopicNames(
    (api1Result.value?.all_topics ?? null) as Record<string, unknown> | null,
    (api1Result.value?.sessions_topics ?? null) as Record<string, Record<string, unknown>> | null,
  )

  Array.from(topicGraph.value.keys()).forEach((topicName) => {
    if (
      topicName.trim().length &&
      !seeded.some((entry) => normalizeTopicKey(entry) === normalizeTopicKey(topicName))
    ) {
      seeded.push(topicName)
    }
  })

  return seeded
}

const getCurrentRoutingPlan = () =>
  normalizeTopicRouting(api1Result.value?.topic_routing ?? null, buildAvailableTopicNames())

const findRouteForTopic = (topicName: string) =>
  getCurrentRoutingPlan().routes.find(
    (route) => normalizeTopicKey(route.topicName) === normalizeTopicKey(topicName),
  ) ?? null

const buildManagedRouteTargets = (topicName: string) => {
  const route = findRouteForTopic(topicName)
  if (!route) {
    return []
  }

  if (route.transition === 'end') {
    return [
      {
        targetTopic: END_CONVERSATION_TARGET,
        label: buildDefaultRouteLabel(END_CONVERSATION_TARGET),
        routeTargetIndex: 0,
      },
    ]
  }

  if (!route.nextTopics.length) {
    return []
  }

  const seenTargets = new Set<string>()
  return route.nextTopics.reduce((acc, targetTopic, index) => {
    const targetKey = normalizeTopicKey(targetTopic)
    if (!targetKey.length || seenTargets.has(targetKey)) {
      return acc
    }
    seenTargets.add(targetKey)
    acc.push({
      targetTopic,
      label:
        route.transition === 'branch'
          ? route.branchMenu.find(
              (choice) => normalizeTopicKey(choice.targetTopic) === targetKey,
            )?.label || buildDefaultRouteLabel(targetTopic)
          : buildDefaultRouteLabel(targetTopic),
      routeTargetIndex: index,
    })
    return acc
  }, [] as Array<{ targetTopic: string; label: string; routeTargetIndex: number }>)
}

const tokenizeForRouteMatch = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 1)

const countSharedRouteTokens = (left: string, right: string) => {
  const rightTokens = new Set(tokenizeForRouteMatch(right))
  return tokenizeForRouteMatch(left).reduce(
    (count, token) => count + (rightTokens.has(token) ? 1 : 0),
    0,
  )
}

const scoreStageAsRouteAnchor = (
  stateName: string,
  stageCell: TopicStageCell,
  managedTargets: Array<{ targetTopic: string; label: string; routeTargetIndex: number }>,
  indexFromEnd: number,
) => {
  const agentText =
    typeof stageCell.data?.agent === 'string' ? stageCell.data.agent.trim() : ''
  const subtopicText =
    typeof stageCell.data?.subtopic === 'string' ? stageCell.data.subtopic.trim() : ''
  const menus = Array.isArray(stageCell.data?.menus) ? stageCell.data.menus : []
  const menuTitles = menus
    .map((menu: Record<string, unknown>) => String(menu?.title || '').trim())
    .filter((entry: string) => entry.length > 0)

  const combinedText = [stateName, subtopicText, agentText, ...menuTitles].join(' ')
  const routeText = managedTargets
    .flatMap((target) => [target.label, target.targetTopic])
    .join(' ')

  let score = Math.max(0, 120 - indexFromEnd * 18)
  score += countSharedRouteTokens(combinedText, routeText) * 16

  if (menuTitles.length >= managedTargets.length && managedTargets.length > 0) {
    score += 45
  }

  const bridgeHints = ['next', 'step', 'steps', 'option', 'options', 'choice', 'choices', 'bridge', 'ready']
  const bridgeHitCount = bridgeHints.reduce(
    (count, token) => count + (tokenizeForRouteMatch(combinedText).includes(token) ? 1 : 0),
    0,
  )
  score += bridgeHitCount * 8

  const strongAnchorPatterns = [
    /\bsummar/i,
    /\bbranch/i,
    /\bnext[_\s-]*step/i,
    /\bwhat would you like to do next\b/i,
    /\bwhere would you like to go next\b/i,
    /\bmove forward\b/i,
    /\blearn more\b/i,
    /\bdiscuss\b/i,
    /\boption/i,
  ]
  const weakLeafPatterns = [
    /\bprocedure\b/i,
    /\bfrequency\b/i,
    /\bfamily[_\s-]*history\b/i,
    /\bgeneral\b/i,
    /\bcautious\b/i,
    /\bdetail/i,
  ]

  strongAnchorPatterns.forEach((pattern) => {
    if (pattern.test(stateName) || pattern.test(agentText)) {
      score += 90
    }
  })

  weakLeafPatterns.forEach((pattern) => {
    if (pattern.test(stateName) || pattern.test(agentText)) {
      score -= 36
    }
  })

  return score
}

const resolveRouteAnchorState = (
  topicBuild: ReturnType<typeof buildTopicScriptFromCells>,
  baseCells: Cell.Properties[],
  managedTargets: Array<{ targetTopic: string; label: string; routeTargetIndex: number }>,
): { stateName: string; stageCell: TopicStageCell } | null => {
  const candidateStages = getTopicStageCells(baseCells)
  const flowOrderedStages = [...candidateStages]
    .filter((stageCell) => hasFlowOrder(stageCell.data?.flowOrder))
    .sort((left, right) => compareFlowOrder(left.data?.flowOrder, right.data?.flowOrder))
  if (flowOrderedStages.length) {
    const explicitLastStage = flowOrderedStages[flowOrderedStages.length - 1]
    const explicitLastStateName = getStageCellName(explicitLastStage)
    if (explicitLastStateName.length) {
      return {
        stateName: explicitLastStateName,
        stageCell: explicitLastStage,
      }
    }
  }

  const stageGraphStats = buildStageGraphStats(baseCells)
  const terminalLocalStages = candidateStages.filter((stageCell) => {
    const stats = stageGraphStats.get(String(stageCell.id || ''))
    return (stats?.outgoingStageCount ?? 0) === 0
  })
  if (terminalLocalStages.length === 1) {
    const terminalStage = terminalLocalStages[0]
    const terminalStateName = getStageCellName(terminalStage)
    if (terminalStateName.length) {
      return {
        stateName: terminalStateName,
        stageCell: terminalStage,
      }
    }
  }

  const lastOrderedStateName = topicBuild.orderedStates.at(-1) ?? ''
  if (lastOrderedStateName.length) {
    const explicitLastStage = findStageCellByName(baseCells, lastOrderedStateName)
    if (explicitLastStage) {
      return {
        stateName: lastOrderedStateName,
        stageCell: explicitLastStage,
      }
    }
  }
  const stageOrderIndex = new Map(
    topicBuild.orderedStates.map((stateName, index) => [normalizeTopicKey(stateName), index] as const),
  )
  const lastPreferredIndex = Math.max(
    0,
    topicBuild.orderedStates.length - Math.max(4, Math.ceil(topicBuild.orderedStates.length * 0.4)),
  )
  const stagePositions = candidateStages.map((stageCell) => ({
    stageCell,
    stateName: getStageCellName(stageCell),
    orderedIndex: stageOrderIndex.get(normalizeTopicKey(getStageCellName(stageCell))) ?? -1,
    positionX: typeof stageCell.position?.x === 'number' ? stageCell.position.x : 0,
  }))
  const maxPositionX = stagePositions.reduce(
    (maxX, entry) => Math.max(maxX, entry.positionX),
    0,
  )
  const rightMostThreshold = Math.max(0, maxPositionX - STAGE_NODE_WIDTH * 0.85)
  const preferredCandidates = stagePositions.filter(
    (entry) => entry.orderedIndex >= lastPreferredIndex || entry.positionX >= rightMostThreshold,
  )
  const effectiveCandidates = preferredCandidates.length ? preferredCandidates : stagePositions
  let bestStateName = ''
  let bestStage: TopicStageCell | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  effectiveCandidates.forEach(({ stageCell, stateName, orderedIndex, positionX }) => {
    if (!stateName.length) {
      return
    }

    const reverseIndex =
      orderedIndex >= 0 ? Math.max(topicBuild.orderedStates.length - orderedIndex - 1, 0) : 0
    const baseScore = scoreStageAsRouteAnchor(stateName, stageCell, managedTargets, reverseIndex)
    const stats = stageGraphStats.get(String(stageCell.id || ''))
    const positionY = typeof stageCell.position?.y === 'number' ? stageCell.position.y : 0
    const menuCount = Array.isArray(stageCell.data?.menus) ? stageCell.data.menus.length : 0
    const candidateScore =
      baseScore +
      Math.min(positionX / 5, 180) +
      Math.max(orderedIndex, 0) * 34 +
      Math.max(0, 42 - positionY / 30) +
      Math.min((stats?.incomingCount ?? 0) * 18, 54) +
      ((stats?.unresolvedOptionCount ?? 0) >= managedTargets.length ? 18 : 0) +
      ((stats?.outgoingStageCount ?? 0) === 0 && menuCount >= managedTargets.length ? 26 : 0)

    if (candidateScore > bestScore) {
      bestScore = candidateScore
      bestStateName = stateName
      bestStage = stageCell
    }
  })

  if (!bestStage) {
    return null
  }

  return {
    stateName: bestStateName,
    stageCell: bestStage,
  }
}

const pickReusableRouteMenus = (
  stageCell: TopicStageCell,
  managedTargets: Array<{ targetTopic: string; label: string; routeTargetIndex: number }>,
) => {
  const menus = Array.isArray(stageCell.data?.menus) ? stageCell.data.menus : []
  const children = Array.isArray(stageCell.children) ? stageCell.children : []
  const usedIndexes = new Set<number>()

  return managedTargets.map((target) => {
    let bestIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY

    menus.forEach((menu: Record<string, unknown>, menuIndex: number) => {
      if (usedIndexes.has(menuIndex)) {
        return
      }

      const title = String((menu as Record<string, unknown>)?.title || '').trim()
      let score =
        countSharedRouteTokens(title, target.label) * 12 +
        countSharedRouteTokens(title, target.targetTopic) * 8

      if (isEndConversationTarget(target.targetTopic)) {
        ;[
          /\bbye\b/i,
          /\bgoodbye\b/i,
          /\bthank/i,
          /\btake care\b/i,
          /\bfeel well\b/i,
          /\ball set\b/i,
          /\bdone\b/i,
          /\bthat helps\b/i,
        ].forEach((pattern) => {
          if (pattern.test(title)) {
            score += 80
          }
        })
      }

      if (score > bestScore) {
        bestScore = score
        bestIndex = menuIndex
      }
    })

    if (bestIndex >= 0 && bestScore > 0) {
      usedIndexes.add(bestIndex)
      const menu = menus[bestIndex] as Record<string, unknown>
      const optionId = getStageChildId(children[bestIndex])
      return {
        menuIndex: bestIndex,
        optionId,
        title: String(menu?.title || '').trim(),
      }
    }

    return null
  })
}

const findStageCellByName = (cells: Cell.Properties[], stateName: string) =>
  getTopicStageCells(cells).find(
    (cell) => normalizeTopicKey(getStageCellName(cell)) === normalizeTopicKey(stateName),
  ) ?? null

const buildStageGraphStats = (cells: Cell.Properties[]) => {
  const stageCells = getTopicStageCells(cells)
  const optionCells = getTopicOptionCells(cells)
  const edgeCells = getTopicEdgeCells(cells)
  const optionById = new Map(optionCells.map((cell) => [String(cell.id || ''), cell] as const))
  const stageById = new Map(stageCells.map((cell) => [String(cell.id || ''), cell] as const))
  const childIdsByStageId = new Map(
    stageCells.map((cell) => [
      String(cell.id || ''),
      new Set(
        (Array.isArray(cell.children) ? cell.children : [])
          .map((child) => getStageChildId(child))
          .filter((id) => id.length > 0),
      ),
    ] as const),
  )
  const statsByStageId = new Map<string, StageGraphStats>()
  stageCells.forEach((cell) => {
    statsByStageId.set(String(cell.id || ''), {
      incomingCount: 0,
      outgoingStageCount: 0,
      unresolvedOptionCount: 0,
    })
  })

  edgeCells.forEach((edge) => {
    const sourceId = toCellId(edge.source?.cell)
    const targetId = toCellId(edge.target?.cell)
    if (!sourceId.length || !targetId.length) {
      return
    }

    const sourceOption = optionById.get(sourceId)
    const targetStage = stageById.get(targetId)
    if (!sourceOption || !targetStage) {
      return
    }

    const parentStageId = Array.from(childIdsByStageId.entries()).find(([, childIds]) =>
      childIds.has(sourceId),
    )?.[0]
    if (!parentStageId) {
      return
    }

    const parentStats = statsByStageId.get(parentStageId)
    const targetStats = statsByStageId.get(String(targetStage.id || ''))
    if (parentStats) {
      parentStats.outgoingStageCount += 1
    }
    if (targetStats) {
      targetStats.incomingCount += 1
    }
  })

  stageCells.forEach((cell) => {
    const stageId = String(cell.id || '')
    const childIds = childIdsByStageId.get(stageId) ?? new Set<string>()
    const unresolvedOptionCount = Array.from(childIds).reduce((count, childId) => {
      const hasOutgoing = edgeCells.some((edge) => toCellId(edge.source?.cell) === childId)
      return count + (hasOutgoing ? 0 : 1)
    }, 0)
    const currentStats = statsByStageId.get(stageId)
    if (currentStats) {
      currentStats.unresolvedOptionCount = unresolvedOptionCount
    }
  })

  return statsByStageId
}

const buildManagedJumpLayout = (
  sourceStage: TopicStageCell,
  allStageCells: TopicStageCell[],
  index: number,
) => {
  const stageX = typeof sourceStage.position?.x === 'number' ? sourceStage.position.x : 0
  const stageY = typeof sourceStage.position?.y === 'number' ? sourceStage.position.y : 0
  const furthestStageRight = allStageCells.reduce((maxRight, stageCell) => {
    const positionX = typeof stageCell.position?.x === 'number' ? stageCell.position.x : 0
    return Math.max(maxRight, positionX + STAGE_NODE_WIDTH)
  }, stageX + STAGE_NODE_WIDTH)
  const jumpX = Math.max(stageX + STAGE_NODE_WIDTH + 180, furthestStageRight + 140)

  return {
    x: jumpX,
    y: stageY + index * (JUMP_NODE_HEIGHT + 18),
  }
}

const createJumpNodeCell = (options: {
  id?: string
  portId?: string
  position: { x: number; y: number }
  targetTopic: string
  targetState?: string
  sourceTopic: string
  sourceState?: string
  routeManaged?: boolean
  routeTargetIndex?: number
}) => ({
  id: options.id ?? uuidV4(),
  shape: JUMP_NODE_SHAPE,
  position: options.position,
  size: { width: JUMP_NODE_WIDTH, height: JUMP_NODE_HEIGHT },
  view: 'vue-shape-view',
  zIndex: 9,
  data: {
    targetTopic: options.targetTopic,
    targetState: options.targetState ?? '',
    sourceTopic: options.sourceTopic,
    sourceState: options.sourceState ?? '',
    routeManaged: Boolean(options.routeManaged),
    routeTargetIndex: options.routeTargetIndex ?? -1,
  },
  ports: {
    groups: {
      left: {
        position: 'left',
        attrs: {
          circle: {
            ...JUMP_PORT_ATTRS,
          },
        },
      },
    },
    items: [
      {
        id: options.portId ?? uuidV4(),
        group: 'left',
      },
    ],
  },
})

const createManagedOptionCell = (
  sourceStage: TopicStageCell,
  menuId: string,
  title: string,
  menuIndex: number,
  routeTargetIndex: number,
  existingOption?: TopicOptionCell,
) => {
  const stageX = typeof sourceStage.position?.x === 'number' ? sourceStage.position.x : 0
  const stageY = typeof sourceStage.position?.y === 'number' ? sourceStage.position.y : 0

  return {
    id: existingOption?.id ?? menuId,
    shape: OPTION_NODE_SHAPE,
    x: stageX + STAGE_NODE_OPTION_ITEM_LEFT,
    y: stageY + STAGE_NODE_TOP_CONTENT_HEIGHT + menuIndex * STAGE_NODE_OPTION_ITEM_HEIGHT,
    width: STAGE_NODE_OPTION_ITEM_WIDTH,
    height: STAGE_NODE_OPTION_ITEM_HEIGHT,
    label: title,
    zIndex: 10,
    data: {
      title,
      status: 'view',
      crossTopic: true,
      routeManaged: true,
      routeTargetIndex,
    },
    ports: [
      {
        id: getFirstPortId(existingOption) || uuidV4(),
        group: 'right',
      },
    ],
  }
}

const createTopicJumpEdge = (
  optionNode: TopicOptionCell,
  jumpNode: TopicJumpCell,
  existingEdge?: TopicEdgeCell,
) => ({
  id: existingEdge?.id ?? uuidV4(),
  shape: 'edge',
  source: {
    cell: optionNode.id,
    port: getFirstPortId(optionNode),
  },
  target: {
    cell: jumpNode.id,
    port: getFirstPortId(jumpNode),
  },
  zIndex: 10,
  attrs: {
    line: {
      ...EDGE_LINE_BASE_ATTRS,
    },
  },
})

const syncRouteManagedJumpsForTopic = (
  topicName: string,
  options: { reloadCurrent?: boolean } = {},
) => {
  const normalizedTopicName = topicName.trim()
  if (!normalizedTopicName || !topicGraph.value.has(normalizedTopicName)) {
    return false
  }

  const originalCells = topicGraph.value.get(normalizedTopicName) ?? []
  const managedTargets = buildManagedRouteTargets(normalizedTopicName)
  const existingJumpNodes = getTopicJumpCells(originalCells).filter(
    (cell) =>
      Boolean(cell.data?.routeManaged) &&
      normalizeTopicKey(cell.data?.sourceTopic) === normalizeTopicKey(normalizedTopicName),
  )
  const existingByIndex = new Map(
    existingJumpNodes.map((cell) => [Number(cell.data?.routeTargetIndex ?? -1), cell] as const),
  )
  const existingManagedOptionsByIndex = new Map(
    getTopicOptionCells(originalCells)
      .filter((cell) => Boolean(cell.data?.routeManaged))
      .map((cell) => [Number(cell.data?.routeTargetIndex ?? -1), cell] as const),
  )
  const optionCellsById = new Map(
    getTopicOptionCells(originalCells).map((cell) => [String(cell.id || ''), cell] as const),
  )
  const existingManagedEdgesByIndex = new Map<number, TopicEdgeCell>()
  getTopicEdgeCells(originalCells).forEach((edge) => {
    const sourceId = toCellId(edge.source?.cell)
    if (!sourceId.length) {
      return
    }
    const sourceOption = optionCellsById.get(sourceId)
    const routeTargetIndex = Number(sourceOption?.data?.routeTargetIndex ?? -1)
    if (!sourceOption?.data?.routeManaged || routeTargetIndex < 0) {
      return
    }
    existingManagedEdgesByIndex.set(routeTargetIndex, edge)
  })

  const baseCells = stripManagedCrossTopicArtifacts(originalCells)
  if (!managedTargets.length) {
    const changed = JSON.stringify(baseCells) !== JSON.stringify(originalCells)
    if (changed) {
      topicGraph.value.set(normalizedTopicName, baseCells)
      if (options.reloadCurrent && topicGraphSelected.value === normalizedTopicName && graph.value) {
        replaceGraphCells(baseCells)
      }
    }
    return changed
  }

  let topicBuild: ReturnType<typeof buildTopicScriptFromCells> | null = null
  try {
    topicBuild = buildTopicScriptFromCells(normalizedTopicName, stripCrossTopicArtifacts(baseCells))
  } catch (error) {
    console.warn('Failed to build route-managed jump layout for topic:', normalizedTopicName, error)
    return false
  }

  const routeAnchor = resolveRouteAnchorState(
    topicBuild,
    baseCells,
    managedTargets,
  )
  if (!routeAnchor) {
    return false
  }

  const terminalStateName = routeAnchor.stateName
  const sourceStage = routeAnchor.stageCell
  const stageCells = getTopicStageCells(baseCells)
  const reusableMenus = pickReusableRouteMenus(sourceStage, managedTargets)
  const reusedMenuIndexSet = new Set(
    reusableMenus
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => entry.menuIndex),
  )
  const removedOptionIds = new Set(
    reusableMenus
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => entry.optionId)
      .filter((entry) => entry.length > 0),
  )

  const prunedBaseCells = baseCells.filter((cell) => {
    const cellId = String(cell.id || '')
    if (removedOptionIds.has(cellId)) {
      return false
    }

    if (cell.shape === 'edge') {
      const sourceId = toCellId((cell as TopicEdgeCell).source?.cell)
      const targetId = toCellId((cell as TopicEdgeCell).target?.cell)
      if (removedOptionIds.has(sourceId) || removedOptionIds.has(targetId)) {
        return false
      }
    }

    return true
  })

  const sourceStageMenus = Array.isArray(sourceStage.data?.menus)
    ? sourceStage.data!.menus.filter((_: unknown, index: number) => !reusedMenuIndexSet.has(index))
    : []
  const sourceStageChildren = Array.isArray(sourceStage.children)
    ? sourceStage.children.filter((_: unknown, index: number) => !reusedMenuIndexSet.has(index))
    : []

  const appendedCells: Cell.Properties[] = []
  managedTargets.forEach((target, index) => {
    const preserved = existingByIndex.get(index)
    const reusedOption = reusableMenus[index]
    const preservedOption =
      existingManagedOptionsByIndex.get(index) ??
      (reusedOption?.optionId ? optionCellsById.get(reusedOption.optionId) : undefined)
    const preservedEdge = existingManagedEdgesByIndex.get(index)
    const preservedTargetState =
      preserved && normalizeTopicKey(getJumpNodeTargetTopic(preserved)) === normalizeTopicKey(target.targetTopic)
        ? getJumpNodeTargetState(preserved)
        : ''
    const jumpNode = createJumpNodeCell({
      id: preserved?.id as string | undefined,
      portId: getFirstPortId(preserved),
      position: buildManagedJumpLayout(sourceStage, stageCells, index),
      targetTopic: target.targetTopic,
      targetState: preservedTargetState,
      sourceTopic: normalizedTopicName,
      sourceState: terminalStateName,
      routeManaged: true,
      routeTargetIndex: index,
    }) as TopicJumpCell

    const menuId =
      String(preservedOption?.id || '').trim() ||
      reusedOption?.optionId ||
      uuidV4()
    const normalizedLabel =
      (typeof preservedOption?.data?.title === 'string' && preservedOption.data.title.trim()) ||
      reusedOption?.title ||
      target.label.trim() ||
      buildDefaultRouteLabel(target.targetTopic)
    const menuIndex = sourceStageMenus.length
    sourceStageMenus.push({
      id: menuId,
      title: normalizedLabel,
      status: 'view',
      nextStage: jumpNode.id,
      crossTopic: true,
      routeManaged: true,
    })
    sourceStageChildren.push(menuId)

    const optionNode = createManagedOptionCell(
      sourceStage,
      menuId,
      normalizedLabel,
      menuIndex,
      index,
      preservedOption,
    ) as TopicOptionCell
    appendedCells.push(jumpNode, optionNode, createTopicJumpEdge(optionNode, jumpNode, preservedEdge))
  })

  const updatedCells = prunedBaseCells.map((cell) => {
    if (String(cell.id || '') !== String(sourceStage.id || '')) {
      return cell
    }

    return {
      ...cell,
      children: sourceStageChildren,
      data: {
        ...(cell.data as Record<string, unknown> | undefined),
        menus: sourceStageMenus,
      },
    }
  })

  updatedCells.push(...appendedCells)

  const changed = JSON.stringify(updatedCells) !== JSON.stringify(originalCells)
  if (!changed) {
    return false
  }

  topicGraph.value.set(normalizedTopicName, updatedCells)
  if (options.reloadCurrent && topicGraphSelected.value === normalizedTopicName && graph.value) {
    replaceGraphCells(updatedCells)
  }
  return true
}

const syncRouteManagedJumpsForAllTopics = (options: { reloadCurrent?: boolean } = {}) => {
  const topicNames = Array.from(topicGraph.value.keys())
  topicNames.forEach((topicName) => {
    syncRouteManagedJumpsForTopic(topicName, options)
  })
}

const selectGraphTopicWithManagedJumps = (topicName: string) => {
  syncRouteManagedJumpsForTopic(topicName, { reloadCurrent: false })
  selectGraphTopic(topicName)
}

const getManualJumpDefaultTargetTopic = (sourceTopic: string) =>
  buildAvailableTopicNames().find(
    (topicName) => normalizeTopicKey(topicName) !== normalizeTopicKey(sourceTopic),
  ) ?? ''

const buildManualJumpPosition = () => {
  const selectedNode = selectedGraphState.value
    ? graph.value?.getNodes?.().find(
        (entry: any) =>
          entry.shape === STAGE_NODE_SHAPE &&
          normalizeTopicKey(entry.getData?.()?.name ?? entry.data?.name) ===
            normalizeTopicKey(selectedGraphState.value),
      )
    : null

  if (selectedNode) {
    const { x, y } = selectedNode.getPosition()
    return {
      x: x + STAGE_NODE_WIDTH + 180,
      y,
    }
  }

  const nodes = graph.value?.getNodes?.() ?? []
  const maxX = nodes.reduce((acc: number, node: any) => {
    const position = node.getPosition?.() ?? { x: 0 }
    const size = node.getSize?.() ?? { width: 0 }
    return Math.max(acc, Number(position.x) + Number(size.width || 0))
  }, 0)

  return {
    x: maxX + 120,
    y: 140,
  }
}



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

let presenceHeartbeatTimer: number | null = null
const isRestoringWorkspace = ref(false)



const topicStats = reactive({

  totalStages: 0,

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

const GUIDE_PULSE_DISMISSED_KEY = 'designer-convert-guide-pulse-dismissed'

const WORKSPACE_LAYOUT_VERSION = 'graph-depth-columns-v6'

const getWorkspaceStorageKey = () => buildUserScopedKey(WORKSPACE_STORAGE_KEY)

const getWorkspaceFingerprintKey = () => buildUserScopedKey(WORKSPACE_FINGERPRINT_KEY)

const getGuidePulseDismissedKey = () => buildUserScopedKey(GUIDE_PULSE_DISMISSED_KEY)

const loadGuidePulseDismissed = () => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(getGuidePulseDismissedKey()) === 'true'
  } catch (error) {
    console.warn('Failed to load guide pulse preference.', error)
    return false
  }
}

const saveGuidePulseDismissed = () => {
  guidePulseDismissed.value = true
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getGuidePulseDismissedKey(), 'true')
  } catch (error) {
    console.warn('Failed to save guide pulse preference.', error)
  }
}

watch(
  () => userName.value,
  () => {
    guidePulseDismissed.value = loadGuidePulseDismissed()
  },
  { immediate: true },
)



const getSubtopicKey = (topicId: string, subtopicId: string) => `${topicId}::${subtopicId}`

const getSubtopicButtonStyle = (subtopicIndex: number) => {
  const palette = paletteByIndex(subtopicIndex)
  return {
    '--subtopic-bg': palette.bg,
    '--subtopic-border': palette.border,
    '--subtopic-accent': palette.accent,
    '--subtopic-glow': palette.glow,
  }
}



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

  topicEditor.nameEditable = isManualAuthoringMode.value || topic.isCustom

  topicEditor.isCustom = isManualAuthoringMode.value || topic.isCustom

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

type ConvertWorkspaceSnapshot = {
  layoutVersion?: string
  planTopics?: PlanTopic[]
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

const syncManualTopicPlan = (
  topicName: string,
  subtopics: PlanSubtopic[],
  options: {
    originalTopicName?: string
  } = {},
) => {
  if (!isManualAuthoringMode.value) {
    return
  }

  upsertManualTopicPlan({
    topicName,
    originalTopicName: options.originalTopicName,
    subtopics: subtopics.map((entry) => ({
      name: entry.name,
      brief: entry.brief || entry.miTips,
      miTechnique: entry.miTechnique,
    })),
  })
}

const renameLocalTopicArtifacts = (fromTopicName: string, toTopicName: string) => {
  if (normalizeTopicLabel(fromTopicName) === normalizeTopicLabel(toTopicName)) {
    return
  }

  if (topicGraph.value.has(fromTopicName)) {
    const cells = topicGraph.value.get(fromTopicName)
    topicGraph.value.set(toTopicName, cells ?? [])
    topicGraph.value.delete(fromTopicName)
  }

  if (topicScripts.value.has(fromTopicName)) {
    const script = topicScripts.value.get(fromTopicName)
    if (typeof script === 'string') {
      topicScripts.value.set(
        toTopicName,
        script.replace(new RegExp(`//${fromTopicName}\\b`), `//${toTopicName}`),
      )
    }
    topicScripts.value.delete(fromTopicName)
  }

  if (topicGraphSelected.value === fromTopicName) {
    topicGraphSelected.value = toTopicName
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

  if (!topic.isCustom && !isManualAuthoringMode.value) return

  const wasSelected = activeSelection.value.topicId === topicId

  planTopics.value = planTopics.value.filter((entry) => entry.id !== topicId)

  removeTopicGraph(topic.name)

  if (isManualAuthoringMode.value) {
    deleteManualTopicPlan(topic.name)
  }

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

  if (
    topicEditor.mode === 'edit' &&
    isManualAuthoringMode.value &&
    normalizedName &&
    planTopics.value.some(
      (topic) =>
        topic.id !== topicEditor.topicId &&
        normalizeTopicLabel(topic.name) === normalizeTopicLabel(normalizedName),
    )
  ) {
    topicEditor.nameError = 'Topic name already exists'
    return
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
    syncManualTopicPlan(newTopic.name, subtopics)

    activeSelection.value = {

      topicId,

      subtopicId: subtopics[0]?.id ?? null,

    }

    ensureTopicExpanded(topicId)

    createTopicGraph(newTopic.name)
    ensureManualTopicStartState(newTopic.name)

  } else if (topicEditor.topicId) {

    const index = planTopics.value.findIndex((topic) => topic.id === topicEditor.topicId)

    if (index !== -1) {

      const original = planTopics.value[index]

      const updated: PlanTopic = {

        ...original,

        name: normalizedName || original.name,

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

      if (isManualAuthoringMode.value) {
        syncManualTopicPlan(updated.name, subtopics, {
          originalTopicName: original.name,
        })
        renameLocalTopicArtifacts(original.name, updated.name)
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
    selectGraphTopicWithManagedJumps(topic.name)

  } else if (topic.isCustom || isManualAuthoringMode.value) {

    createTopicGraph(topic.name)

  }

  ensureManualTopicStartState(topic.name)

  highlightSubtopicStates()

}

const buildPlanSubtopicSeed = (entry: string | SubtopicSummary): PlanSubtopic => {
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
  const prompt = normalized.prompt ?? ''

  return {
    id: uuidV4(),
    name: displayName,
    miTips: brief || miTechnique || prompt,
    brief,
    miTechnique,
  }
}



const onSubtopicClick = (topicId: string, subtopicId: string) => {

  ensureTopicExpanded(topicId)

  activeSelection.value = { topicId, subtopicId }

  const topic = planTopics.value.find((entry) => entry.id === topicId)
  if (topic) {
    if (topicGraph.value.has(topic.name)) {
      selectGraphTopicWithManagedJumps(topic.name)
    } else if (topic.isCustom || isManualAuthoringMode.value) {
      createTopicGraph(topic.name)
    }
    ensureManualTopicStartState(topic.name)
  }

  highlightSubtopicStates()

}


const buildPlanTopicSeeds = (
  allTopics?: Record<string, Array<string | SubtopicSummary>> | null,
  fallbackTopicNames: string[] = [],
): PlanTopic[] => {
  const defaultTopicNames = Object.keys(allTopics ?? {})
  const orderedTopicNames = normalizeTopicRouting(
    api1Result.value?.topic_routing ?? null,
    defaultTopicNames,
  ).routes.map((route) => route.topicName)
  const mergedTopicNames = [...orderedTopicNames]

  fallbackTopicNames.forEach((topicName) => {
    if (
      topicName &&
      !mergedTopicNames.some(
        (entry) => normalizeTopicLabel(entry) === normalizeTopicLabel(topicName),
      )
    ) {
      mergedTopicNames.push(topicName)
    }
  })

  return mergedTopicNames.map((topicName) => ({
    id: uuidV4(),
    name: topicName,
    subtopics: (allTopics?.[topicName] ?? []).map((entry) => buildPlanSubtopicSeed(entry)),
    isCustom: isManualAuthoringMode.value,
  }))
}

const syncPlanTopicsFromSource = (
  allTopics?: Record<string, Array<string | SubtopicSummary>> | null,
  fallbackTopicNames: string[] = [],
) => {
  const seeds = buildPlanTopicSeeds(allTopics, fallbackTopicNames)
  if (!seeds.length) {
    return false
  }

  if (!planTopics.value.length) {
    const preferredTopicName =
      typeof topicGraphSelected.value === 'string' && topicGraphSelected.value.trim().length
        ? topicGraphSelected.value
        : seeds[0].name

    const preferredTopic =
      seeds.find((topic) => normalizeTopicLabel(topic.name) === normalizeTopicLabel(preferredTopicName)) ??
      seeds[0]

    planTopics.value = seeds
    activeSelection.value = {
      topicId: preferredTopic.id,
      subtopicId: preferredTopic.subtopics[0]?.id ?? null,
    }
    ensureTopicExpanded(preferredTopic.id)
    return true
  }

  const existingByTopic = new Map(
    planTopics.value.map((topic) => [normalizeTopicLabel(topic.name), topic] as const),
  )
  const seedKeys = new Set(seeds.map((topic) => normalizeTopicLabel(topic.name)))

  const merged = seeds.map((seedTopic) => {
    const existingTopic = existingByTopic.get(normalizeTopicLabel(seedTopic.name))
    if (!existingTopic) {
      return seedTopic
    }

    const existingSubtopicsByName = new Map(
      existingTopic.subtopics.map((subtopic) => [normalizeTopicLabel(subtopic.name), subtopic] as const),
    )
    const seedSubtopicKeys = new Set(seedTopic.subtopics.map((subtopic) => normalizeTopicLabel(subtopic.name)))

    const mergedSubtopics = seedTopic.subtopics.map((seedSubtopic) => {
      const existingSubtopic = existingSubtopicsByName.get(normalizeTopicLabel(seedSubtopic.name))
      if (!existingSubtopic) {
        return seedSubtopic
      }

      return {
        ...existingSubtopic,
        miTips: seedSubtopic.miTips || existingSubtopic.miTips,
        brief: seedSubtopic.brief || existingSubtopic.brief,
        miTechnique: seedSubtopic.miTechnique || existingSubtopic.miTechnique,
      }
    })

    existingTopic.subtopics.forEach((existingSubtopic) => {
      if (!seedSubtopicKeys.has(normalizeTopicLabel(existingSubtopic.name))) {
        mergedSubtopics.push(existingSubtopic)
      }
    })

    return {
      ...existingTopic,
      subtopics: mergedSubtopics,
    }
  })

  planTopics.value.forEach((topic) => {
    if (!seedKeys.has(normalizeTopicLabel(topic.name))) {
      merged.push(topic)
    }
  })

  planTopics.value = merged
  return true
}

const ensurePlanTopicsSeeded = (options: { force?: boolean } = {}) => {
  if (planTopics.value.length && !options.force) {
    return false
  }

  const fallbackTopicNames = [
    ...generationQueue.value.map((job: TopicJob) => job.topicName),
    ...Array.from(topicGraph.value.keys()),
  ].filter(
    (topicName, index, entries) =>
      Boolean(topicName) &&
      entries.findIndex((entry) => normalizeTopicLabel(entry) === normalizeTopicLabel(topicName)) ===
        index,
  )

  return syncPlanTopicsFromSource(api1Result.value?.all_topics ?? null, fallbackTopicNames)
}



watch(

  () => api1Result.value?.all_topics,

  (allTopics) => {

    if (!allTopics) {

      return

    }

    syncPlanTopicsFromSource(allTopics)

  },

  { immediate: true, deep: true },

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

const selectedPlanTopic = computed(
  () => planTopics.value.find((topic) => topic.id === activeSelection.value.topicId) ?? null,
)

const buildRealtimeGraphProgress = () => {
  let stateCount = 0
  let optionCount = 0
  let jumpCount = 0

  topicGraph.value.forEach((cells) => {
    ;(Array.isArray(cells) ? cells : []).forEach((cell: Cell.Properties) => {
      if (cell?.shape === STAGE_NODE_SHAPE) {
        stateCount += 1
      } else if (cell?.shape === OPTION_NODE_SHAPE) {
        optionCount += 1
      } else if (isJumpNodeCell(cell)) {
        jumpCount += 1
      }
    })
  })

  return {
    planTopicCount: planTopics.value.length,
    graphTopicCount: topicGraph.value.size,
    stateCount,
    optionCount,
    jumpCount,
  }
}

const buildConvertPresencePayload = () => ({
  userName: userNameDisplay.value,
  workspaceId: 'default',
  authoringMode: authoringMode.value,
  step: 2,
  currentView: 'convert',
  currentRoute: '/convert',
  currentTopic: selectedPlanTopic.value?.name ?? topicGraphSelected.value ?? null,
  currentSubtopic: getActiveSubtopicName(),
  sessionId: analyticsState.value?.sessionId ?? null,
  analyticsEventCount: analyticsState.value?.events?.length ?? null,
  lastActivityAt:
    typeof analyticsState.value?.lastActivityAt === 'number'
      ? new Date(analyticsState.value.lastActivityAt).toISOString()
      : null,
  ...buildRealtimeGraphProgress(),
})

const sendConvertPresenceHeartbeat = async () => {
  if (!userSessionReady.value || !userNameDisplay.value) {
    return
  }

  try {
    await requestWorkspacePresence(buildConvertPresencePayload())
  } catch (error) {
    console.warn('Failed to update convert workspace presence', error)
  }
}

watch(
  () => [
    userSessionReady.value,
    userNameDisplay.value,
    authoringMode.value,
    activeSelection.value.topicId,
    activeSelection.value.subtopicId,
    topicGraphSelected.value,
  ],
  () => {
    void sendConvertPresenceHeartbeat()
  },
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

const generationStats = computed<{
  total: number
  completed: number
  failed: number
  running: TopicJob | null
}>(() => {
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
const generationProgressPercent = computed(() => {
  const total = generationStats.value.total
  if (!total) return 0
  return Math.round((generationStats.value.completed / total) * 100)
})

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
const isGenerationUiBusy = computed(() => hasActiveGeneration.value)

const canPauseGeneration = computed(() => hasRunningTopics.value && !generationCancelled.value)

const canResumeGeneration = computed(() =>
  !hasRunningTopics.value && (hasPendingTopics.value || hasCancelledTopics.value),
)

const isAllQueuedGenerationComplete = computed(
  () =>
    !isManualAuthoringMode.value &&
    hasQueuedTopics.value &&
    generationStats.value.total > 0 &&
    generationStats.value.completed === generationStats.value.total &&
    generationStats.value.failed === 0 &&
    !hasActiveGeneration.value,
)

const shouldPulseGenerateAction = computed(
  () => !isManualAuthoringMode.value && canResumeGeneration.value && !tourActive.value,
)

const shouldPulseGuideAction = computed(
  () => isAllQueuedGenerationComplete.value && !guidePulseDismissed.value && !tourActive.value,
)

const onPauseGeneration = () => {
  cancelTopicGeneration()
}

const onStartGuide = () => {
  saveGuidePulseDismissed()
  startTour()
}

watch(
  () => [
    queryTopicStrucLoading.value,
    generationProcessing.value,
    generationQueue.value.some((job: TopicJob) => job.status === 'running'),
  ],
  ([isLoading, isProcessing, hasRunningJobs]) => {
    if (isLoading && !isProcessing && !hasRunningJobs) {
      queryTopicStrucLoading.value = false
    }
  },
  { immediate: true },
)

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
    const errorDetail = topicJobLookup.value.get(topicName)?.error
    if (typeof errorDetail === 'string' && errorDetail.trim().length) {
      message.error(errorDetail)
    }
  } catch (error) {
    console.error('Failed to retry topic generation', error)
    message.error(error instanceof Error ? error.message : 'Failed to retry topic.')
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

const plannedExportTopicNames = computed(() =>
  buildOrderedPlanTopicNames(
    (api1Result.value?.all_topics ?? null) as Record<string, unknown> | null,
    (api1Result.value?.sessions_topics ?? null) as Record<string, Record<string, unknown>> | null,
  ),
)

const topicHasExportContent = (topicName: string) => {
  if (topicGraph.value.has(topicName)) {
    return true
  }

  const script = topicScripts.value.get(topicName)
  return typeof script === 'string' && script.trim().length > 0
}

const missingExportTopicNames = computed(() => {
  const plannedTopicNames = plannedExportTopicNames.value
  if (plannedTopicNames.length <= 1) {
    return []
  }

  return plannedTopicNames.filter((topicName) => !topicHasExportContent(topicName))
})

const canBuildConversation = computed(() => {
  const plannedTopicNames = plannedExportTopicNames.value

  if (plannedTopicNames.length > 1) {
    return missingExportTopicNames.value.length === 0
  }

  if (topicGraph.value.size > 0) {
    return true
  }

  return Array.from(topicScripts.value.values()).some(
    (script) => typeof script === 'string' && script.trim().length > 0,
  )
})

const exportDisabledReason = computed(() => {
  if (exportLoading.value) {
    return 'Export is already running.'
  }

  if (isGenerationUiBusy.value) {
    return 'Wait for dialogue generation to finish before exporting.'
  }

  if (canBuildConversation.value) {
    return ''
  }

  const missingTopics = missingExportTopicNames.value
  if (missingTopics.length > 0) {
    const visibleTopics = missingTopics.slice(0, 4).map((topicName) => normalizeDisplayLabel(topicName))
    const restCount = missingTopics.length - visibleTopics.length
    return `Export disabled. Missing dialogue for: ${visibleTopics.join(', ')}${
      restCount > 0 ? `, and ${restCount} more` : ''
    }. Generate these topics first.`
  }

  return 'Export disabled. Generate at least one dialogue topic first.'
})

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

  topicStats.totalStages = totalStages

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

const {
  graphMutationRevision,
  graphStructureRevision,
  flushGraphSnapshot,
  flushPendingGraphSnapshot,
  captureGraphSnapshot,
  clearGraphSnapshotTimer,
} = useGraphSnapshotQueue({
  graph,
  topicGraph,
  selectedTopic: topicGraphSelected,
  isGraphHydrating,
  computeTopicStats,
})

const flushCurrentGraphSnapshot = () => {
  if (flushPendingGraphSnapshot()) {
    return true
  }

  return flushGraphSnapshot(topicGraphSelected.value)
}

let routeManagedSyncTimer: number | null = null

const scheduleRouteManagedSync = (options: { reloadCurrent?: boolean } = {}) => {
  if (typeof window === 'undefined') {
    if (topicGraphSelected.value) {
      syncRouteManagedJumpsForTopic(topicGraphSelected.value, options)
    }
    return
  }

  if (routeManagedSyncTimer !== null) {
    window.clearTimeout(routeManagedSyncTimer)
  }

  routeManagedSyncTimer = window.setTimeout(async () => {
    routeManagedSyncTimer = null
    if (isGraphHydrating()) {
      return
    }
    let changed = false
    if (topicGraphSelected.value) {
      changed = syncRouteManagedJumpsForTopic(topicGraphSelected.value, options)
    }
    if (changed) {
      await nextTick()
      realignAllStageOptionLayouts()
      refreshEdgePresentation()
    }
  }, 220)
}



watch(

  () => topicGraphSelected.value,

  async (topicName) => {
    clearRelationFocusHighlight()

    updateTopicStatsForTopic(topicName)

    if (!topicName) {
      highlightSubtopicStates()
      return
    }

    const topic = planTopics.value.find((entry) => entry.name === topicName)

    if (!topic) return

    activeSelection.value.topicId = topic.id

    ensureTopicExpanded(topic.id)

    if (!topic.subtopics.some((subtopic) => subtopic.id === activeSelection.value.subtopicId)) {

      activeSelection.value.subtopicId = topic.subtopics[0]?.id ?? null

    }

    highlightSubtopicStates()
    if (isManualAuthoringMode.value) {
      await nextTick()
      ensureManualTopicStartState(topicName)
    }

  },

  { immediate: true },

)

watch(
  () => [
    activeSelection.value.topicId,
    activeSelection.value.subtopicId,
    topicGraphSelected.value,
    planTopics.value.length,
  ],
  async () => {
    await nextTick()
    highlightSubtopicStates()
  },
  { immediate: true },
)

watch(
  () => topicGraphSelected.value,
  async () => {
    if (isGraphHydrating()) {
      return
    }
    scheduleRouteManagedSync({ reloadCurrent: false })
  },
  { immediate: true },
)

watch(
  () => api1Result.value?.topic_routing,
  async () => {
    if (isGraphHydrating()) {
      return
    }
    if (typeof window !== 'undefined' && routeManagedSyncTimer !== null) {
      window.clearTimeout(routeManagedSyncTimer)
      routeManagedSyncTimer = null
    }
    syncRouteManagedJumpsForAllTopics({ reloadCurrent: false })
    await nextTick()
    realignAllStageOptionLayouts()
    refreshEdgePresentation()
  },
  { deep: true },
)

const currentRouteFingerprint = computed(() => {
  const topicName = topicGraphSelected.value
  const route = topicName ? findRouteForTopic(topicName) : null
  return route
    ? JSON.stringify({
        transition: route.transition,
        nextTopics: route.nextTopics,
        branchMenu: route.branchMenu,
      })
    : ''
})

watch(
  () => `${topicGraphSelected.value || ''}:${currentRouteFingerprint.value}:${graphStructureRevision.value}`,
  async () => {
    if (isGraphHydrating()) {
      return
    }
    scheduleRouteManagedSync({ reloadCurrent: false })
  },
)

watch(
  () => graphMutationRevision.value,
  () => {
    scheduleManualEditAutoSave()
  },
)

watch(
  () => planTopics.value,
  () => {
    scheduleManualEditAutoSave()
  },
  { deep: true },
)



const graphStructureEventNames = ['node:added', 'node:removed', 'edge:added', 'edge:removed']
const graphLayoutEventNames = ['node:change:position', 'node:change:size']



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

const buildWorkspacePayload = (
  options: { forceCurrentGraphSnapshot?: boolean } = {},
): ConvertWorkspaceSnapshot => {

  if (options.forceCurrentGraphSnapshot) {
    flushCurrentGraphSnapshot()
  } else {
    flushPendingGraphSnapshot()
  }
  flushAllTopicGraphs()

  const planTopicsSnapshot = planTopics.value.map((topic) => ({

    ...topic,

    subtopics: topic.subtopics.map((subtopic) => ({ ...subtopic })),

  }))

  const topicGraphSnapshot = Array.from(topicGraph.value.entries()).map(([topicName, cells]) => [

    topicName,

    normalizeStageOptionLayoutCells(cells),

  ]) as [string, Cell.Properties[]][]

  return {

    layoutVersion: WORKSPACE_LAYOUT_VERSION,

    planTopics: planTopicsSnapshot,

    topicGraph: topicGraphSnapshot,

    topicGraphSelected: topicGraphSelected.value,

    convertContent: convertContent.value,

    stateContent: stateContent.value,

    agentPanelVisible: agentPanelVisible.value,

    agentPanelCollapsed: agentPanelCollapsed.value,

    agentPanelSize: {
      width: agentPanelWidth.value,
      height: agentPanelHeight.value,
    },

  }

}

const applyWorkspacePayload = (
  parsed: ConvertWorkspaceSnapshot,
  options: { silent?: boolean; source?: 'browser' | 'server' | 'import'; forceStoredTopicGraph?: boolean } = {},
) => {

  if (Array.isArray(parsed.planTopics)) {

    planTopics.value = parsed.planTopics.map((topic) => ({

      ...topic,

      subtopics: Array.isArray(topic.subtopics)

        ? topic.subtopics.map((subtopic) => ({ ...subtopic }))

        : [],

    }))

  }

  const canReuseStoredTopicGraph =
    options.forceStoredTopicGraph || parsed.layoutVersion === WORKSPACE_LAYOUT_VERSION

  if (canReuseStoredTopicGraph && Array.isArray(parsed.topicGraph)) {

    topicGraph.value.clear()

    parsed.topicGraph.forEach((entry) => {

      if (!Array.isArray(entry) || entry.length !== 2) return

      const [topicName, cells] = entry as [unknown, unknown]

      if (typeof topicName !== 'string' || !Array.isArray(cells)) return

      topicGraph.value.set(
        topicName,
        normalizeStageOptionLayoutCells(cells as Cell.Properties[]),
      )

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

  if (typeof parsed.agentPanelVisible === 'boolean') {
    agentPanelVisible.value = parsed.agentPanelVisible
  }

  if (typeof parsed.agentPanelCollapsed === 'boolean') {
    agentPanelCollapsed.value = parsed.agentPanelCollapsed
  }

  if (parsed.agentPanelSize && typeof parsed.agentPanelSize === 'object') {
    const width =
      typeof parsed.agentPanelSize.width === 'number' ? parsed.agentPanelSize.width : agentPanelWidth.value
    const height =
      typeof parsed.agentPanelSize.height === 'number' ? parsed.agentPanelSize.height : agentPanelHeight.value
    applyAgentPanelSize(width, height)
  } else {
    syncAgentPanelSizeToViewport()
  }

  nextTick(() => {

    const preferred =

      typeof parsed.topicGraphSelected === 'string' &&

      topicGraph.value.has(parsed.topicGraphSelected)

        ? parsed.topicGraphSelected

        : topicGraph.value.keys().next().value

    if (preferred) {

      selectGraphTopicWithManagedJumps(preferred)

      updateTopicStatsForTopic(preferred)

    } else if (graph.value) {

      const clearCells = (graph.value as any).clearCells

      if (typeof clearCells === 'function') {
        ;(graph.value as any)[GRAPH_HYDRATING_FLAG] = true
        try {
          clearCells.call(graph.value)
        } finally {
          ;(graph.value as any)[GRAPH_HYDRATING_FLAG] = false
        }

      } else {

        replaceGraphCells([] as any)

      }

      computeTopicStats(undefined)

    }

  })

  if (!options.silent) {
    message.success(
      options.source === 'server'
        ? 'Dialogue restored from server.'
        : options.source === 'import'
          ? 'Dialogue restored from import.'
          : 'Dialogue restored from browser.',
    )
  }

}

const {
  syncWorkspaceToServer,
  restoreWorkspaceFromServer,
  persistWorkspace,
  saveWorkspaceNow: onSaveWorkspace,
  persistWorkspacePayloadToBrowser,
  runAutoSave,
  scheduleManualEditAutoSave,
  scheduleGenerationAutoSave,
  restoreWorkspace,
  startPeriodicAutoSave,
  clearPeriodicAutoSave,
  flushPendingAutoSaves,
} = useWorkspacePersistence<ConvertWorkspaceSnapshot>({
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
  hasLocalEdits: () => typeof convertContent.value === 'string' && convertContent.value.trim().length > 0,
  isGraphHydrating,
  updateCurrentTopicStats: () => updateTopicStatsForTopic(topicGraphSelected.value),
  notifyError: (content) => message.error(content),
  notifySuccess: (content) => message.success(content),
})

watch(
  () =>
    generationQueue.value
      .map((job: TopicJob) => `${job.id}:${job.status}:${job.finishedAt ?? ''}:${job.attempt}`)
      .join('|'),
  (fingerprint) => {
    if (!fingerprint || !generationQueue.value.some((job: TopicJob) => job.status === 'success')) {
      return
    }
    scheduleGenerationAutoSave()
  },
)

const resetConvertWorkspaceState = () => {
  planTopics.value = []
  expandedTopicIds.value = []
  activeSelection.value = {
    topicId: null,
    subtopicId: null,
  }
  autoSaveMessage.value = ''
  topicStats.totalStages = 0
  resetTopicEditor()
  selectedGraphState.value = null
  activePreviewTopic.value = null
  activePreviewState.value = null
  previewErrorSummary.value = ''
  previewErrorDetail.value = ''
  previewErrorExpanded.value = false
  pendingPreviewMessages.value = []
  clearRelationFocusHighlight()
  previewBeatCache.clear()
}

const restoreActiveUserWorkspace = async () => {
  const shouldUseCurrentPreparedState = consumeNextConvertWorkspaceRestoreSkipped()
  isRestoringWorkspace.value = true

  try {
    let restoredFromServer = false
    let restoredWorkspace = false
    let restoredGeneration = false

    if (!shouldUseCurrentPreparedState) {
      resetConvertWorkspaceState()
      restoredFromServer = await restoreWorkspaceFromServer({ silent: true })
      restoredWorkspace = restoredFromServer || restoreWorkspace({ silent: true })
      restoredGeneration = restoredFromServer
        ? generationQueue.value.length > 0 || topicScripts.value.size > 0
        : restoreGenerationState()
    } else {
      restoredGeneration = generationQueue.value.length > 0 || topicScripts.value.size > 0
    }

    flushAllTopicGraphs()
    ensurePlanTopicsSeeded()

    if (topicGraph.value.size) {
      const preferredTopic =
        topicGraphSelected.value && topicGraph.value.has(topicGraphSelected.value)
          ? topicGraphSelected.value
          : topicGraph.value.keys().next().value

      if (preferredTopic) {
        selectGraphTopicWithManagedJumps(preferredTopic)
      }
    } else if (isManualAuthoringMode.value && planTopics.value.length) {
      const selectedPlanTopic =
        planTopics.value.find((topic) => topic.id === activeSelection.value.topicId) ?? planTopics.value[0]
      if (selectedPlanTopic?.name?.trim()) {
        createTopicGraph(selectedPlanTopic.name)
      }
    } else if (
      !isManualAuthoringMode.value &&
      !restoredGeneration &&
      api1Result.value &&
      convertContent.value &&
      !queryTopicStrucLoading.value &&
      !graph.value?.getNodes?.()?.length
    ) {
      prepareTopicGeneration()
    }

    return {
      restoredWorkspace,
      restoredGeneration,
      restoredFromServer,
    }
  } finally {
    isRestoringWorkspace.value = false
  }
}

const applyUserSwitch = async (_result: { restored: boolean; userName: string }) => {
  await restoreActiveUserWorkspace()
}



const container = ref()

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else if (reader.result instanceof ArrayBuffer) {
        resolve(new TextDecoder().decode(reader.result))
      } else {
        reject(new Error('Unsupported file type'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'))
    reader.readAsText(file)
  })
}

const buildPlanTopicsFromImport = (topics: ImportedTopicSummary[]): PlanTopic[] => {
  return topics.map((topic) => {
    const normalizedName = topic.name?.trim() || 'Imported Topic'
    const stageNames = (topic.stageNames ?? []).filter((entry) => entry && entry.trim().length)
    const subtopics = stageNames.slice(0, 5).map((stageName) => ({
      id: uuidV4(),
      name: stageName,
      miTips: '',
      brief: '',
      miTechnique: '',
    }))

    if (!subtopics.length) {
      subtopics.push({
        id: uuidV4(),
        name: 'Imported flow',
        miTips: '',
        brief: '',
        miTechnique: '',
      })
    }

    return {
      id: uuidV4(),
      name: normalizedName,
      subtopics,
      isCustom: true,
    }
  })
}

type ImportedDesignerJson = {
  workspace: ConvertWorkspaceSnapshot
  userThread?: unknown
  generationState?: unknown
  analyticsState?: unknown
  label: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const parseJsonText = (text: string): unknown | null => {
  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

const looksLikeWorkspacePayload = (value: unknown): value is ConvertWorkspaceSnapshot => {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.planTopics) ||
    Array.isArray(value.topicGraph) ||
    typeof value.convertContent === 'string' ||
    typeof value.stateContent === 'string'
  )
}

const extractImportedDesignerJson = (value: unknown): ImportedDesignerJson | null => {
  if (!isRecord(value)) {
    return null
  }

  if (looksLikeWorkspacePayload(value)) {
    return {
      workspace: value,
      label: 'workspace',
    }
  }

  const workspaceCandidates = [
    value.workspace,
    value.convertWorkspace,
    isRecord(value.snapshot) ? value.snapshot.workspace : undefined,
    isRecord(value.snapshot) ? value.snapshot.convertWorkspace : undefined,
  ]

  const workspace = workspaceCandidates.find(looksLikeWorkspacePayload)
  if (!workspace) {
    return null
  }

  const snapshot = isRecord(value.snapshot) ? value.snapshot : value

  return {
    workspace,
    userThread: value.userThread ?? snapshot.userThread,
    generationState: value.generationState ?? snapshot.generationState,
    analyticsState: value.analyticsState ?? snapshot.analyticsState,
    label:
      value.bundleType === 'healthdial-support-bundle'
        ? 'support bundle'
        : isRecord(value.snapshot)
          ? 'server snapshot'
          : 'workspace export',
  }
}

const activateImportedWorkspaceSelection = async (workspace: ConvertWorkspaceSnapshot) => {
  await nextTick()

  const preferred =
    typeof workspace.topicGraphSelected === 'string' && topicGraph.value.has(workspace.topicGraphSelected)
      ? workspace.topicGraphSelected
      : topicGraph.value.keys().next().value

  const selectedTopic = preferred
    ? planTopics.value.find((topic) => normalizeTopicLabel(topic.name) === normalizeTopicLabel(preferred))
    : planTopics.value[0]

  if (selectedTopic) {
    ensureTopicExpanded(selectedTopic.id)
    activeSelection.value = {
      topicId: selectedTopic.id,
      subtopicId: selectedTopic.subtopics[0]?.id ?? null,
    }
  } else {
    activeSelection.value = { topicId: null, subtopicId: null }
  }

  if (preferred) {
    selectGraphTopicWithManagedJumps(preferred)
    updateTopicStatsForTopic(preferred)
  }
}

const applyImportedDesignerJson = async (raw: unknown) => {
  const imported = extractImportedDesignerJson(raw)
  if (!imported) {
    return false
  }

  if (imported.userThread) {
    applyUserThreadSnapshot(imported.userThread as Parameters<typeof applyUserThreadSnapshot>[0])
  }

  if (imported.generationState) {
    applyGenerationStateSnapshot(
      imported.generationState as Parameters<typeof applyGenerationStateSnapshot>[0],
    )
  }

  if (imported.analyticsState) {
    applyAnalyticsStateSnapshot(
      imported.analyticsState as Parameters<typeof applyAnalyticsStateSnapshot>[0],
    )
  }

  applyWorkspacePayload(imported.workspace, {
    silent: true,
    source: 'import',
    forceStoredTopicGraph: true,
  })
  await activateImportedWorkspaceSelection(imported.workspace)

  persistAllUserScopedState()
  persistWorkspacePayloadToBrowser(imported.workspace)
  void syncWorkspaceToServer({
    reason: 'import',
    createSnapshot: true,
    silent: true,
  })

  message.success(
    `Imported ${imported.label}: ${topicGraph.value.size} topic${topicGraph.value.size === 1 ? '' : 's'} restored.`,
  )
  return true
}

const extractBeatStates = (value: unknown): unknown[] | null => {
  if (!isRecord(value)) {
    return null
  }

  const directStates = value.States ?? value.states
  if (Array.isArray(directStates)) {
    return directStates
  }

  const beatPayload = readBeatPayload(value)
  if (isRecord(beatPayload)) {
    const nestedStates = beatPayload.States ?? beatPayload.states
    if (Array.isArray(nestedStates)) {
      return nestedStates
    }
  }

  return null
}

const firstSpeechFromBeatState = (state: Record<string, unknown>) => {
  const actionSets = Array.isArray(state.ActionSets)
    ? state.ActionSets
    : Array.isArray(state.actionSets)
      ? state.actionSets
      : []

  for (const actionSet of actionSets) {
    if (!Array.isArray(actionSet)) {
      continue
    }
    for (const action of actionSet) {
      if (!isRecord(action)) {
        continue
      }
      const speech = action.Speech ?? action.speech
      if (typeof speech === 'string' && speech.trim().length) {
        const cleaned = cleanBeatActionText(speech)
        if (cleaned.length) {
          return cleaned
        }
      }
    }
  }

  return ''
}

const beatMenuEntries = (state: Record<string, unknown>) => {
  const ui = isRecord(state.Ui) ? state.Ui : isRecord(state.ui) ? state.ui : null
  const menu = ui && (Array.isArray(ui.Menu) ? ui.Menu : Array.isArray(ui.menu) ? ui.menu : null)
  if (!menu) {
    return []
  }

  return menu.reduce((entries, item) => {
    if (!isRecord(item)) {
      return entries
    }

    const text = item.Text ?? item.text
    const nextState = item.NextState ?? item.nextState ?? item.next_state
    if (typeof text === 'string' && text.trim().length && typeof nextState === 'string' && nextState.trim().length) {
      entries.push({
        title: text.trim(),
        nextState: nextState.trim(),
      })
    }
    return entries
  }, [] as Array<{ title: string; nextState: string }>)
}

const cleanBeatActionText = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\b(?:cmd|dir|hand|gaze|posture|gesture)\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/\bBEAT\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getImportedBeatTopicName = (value: unknown, sourceName?: string) => {
  const raw =
    (isRecord(value) && typeof value.TopicName === 'string' ? value.TopicName.trim() : '') ||
    (isRecord(value) && typeof value.topicName === 'string' ? value.topicName.trim() : '') ||
    sourceName?.replace(/\.[^/.]+$/, '')?.replace(/BEAT$/i, '')?.trim() ||
    'Imported Topic'

  return raw || 'Imported Topic'
}

const parseBeatPrefixedStateName = (stateName: string) => {
  const normalized = stateName.trim()
  const directMatch = normalized.match(/^topic_(\d+)_(.+?)__(.+)$/i)
  if (directMatch) {
    return {
      topicKey: `topic_${directMatch[1]}_${directMatch[2]}`,
      topicName: directMatch[2],
      stateName: directMatch[3],
    }
  }

  return {
    topicKey: '',
    topicName: '',
    stateName: normalized,
  }
}

const buildStagesFromBeatJson = (value: unknown, fallbackTopicName: string) => {
  const states = extractBeatStates(value)
  if (!states?.length) {
    return null
  }

  const grouped = new Map<string, { topicName: string; stages: ImportedStageNode[] }>()
  const fallbackTopic = fallbackTopicName || 'Imported Topic'

  states.forEach((entry, index) => {
    if (!isRecord(entry)) {
      return
    }

    const stateName = entry.StateName ?? entry.stateName ?? entry.name
    if (typeof stateName !== 'string' || !stateName.trim().length) {
      return
    }

    const parsed = parseBeatPrefixedStateName(stateName)
    if (!parsed.topicKey && parsed.stateName.toLowerCase() === 'conversation_start') {
      return
    }

    const topicKey = parsed.topicKey || fallbackTopic
    const topicName = parsed.topicName || fallbackTopic
    const normalizedStateName = parsed.stateName
    const userOptions = beatMenuEntries(entry) as Array<{ title: string; nextState: string }>

    const stage: ImportedStageNode = {
      stageName: normalizedStateName,
      agent: firstSpeechFromBeatState(entry),
      subtopic:
        (typeof entry.Subtopic === 'string' && entry.Subtopic.trim()) ||
        (typeof entry.subtopic === 'string' && entry.subtopic.trim()) ||
        '',
      miTechnique:
        (typeof entry.MiTechnique === 'string' && entry.MiTechnique.trim()) ||
        (typeof entry.MI_TECHNIQUE === 'string' && entry.MI_TECHNIQUE.trim()) ||
        (typeof entry.miTechnique === 'string' && entry.miTechnique.trim()) ||
        '',
      flowOrder:
        (typeof entry.FlowOrder === 'string' && entry.FlowOrder.trim()) ||
        (typeof entry.flowOrder === 'string' && entry.flowOrder.trim()) ||
        `${index + 1}`,
      menus: userOptions.map((option, optionIndex) => {
        const parsedTarget = parseBeatPrefixedStateName(option.nextState)
        const isSameTopic =
          parsedTarget.topicKey.length === 0 ||
          parsedTarget.topicKey === topicKey

        return {
          title: sanitizeMenuTitle(cleanBeatActionText(option.title), `option_${optionIndex + 1}`),
          fromStage: normalizedStateName,
          nextStage: isSameTopic ? parsedTarget.stateName : option.nextState,
          id: uuidV4(),
        }
      }),
    }

    const group = grouped.get(topicKey) ?? { topicName, stages: [] }
    group.stages.push(stage)
    grouped.set(topicKey, group)
  })

  return grouped.size ? grouped : null
}

const buildPlanTopicFromStages = (topicName: string, stages: ImportedStageNode[]): PlanTopic => {
  const subtopicMap = new Map<string, PlanSubtopic>()

  stages.forEach((stage) => {
    const subtopicName = stage.subtopic?.trim()
    if (!subtopicName || subtopicMap.has(subtopicName)) {
      return
    }
    subtopicMap.set(subtopicName, {
      id: uuidV4(),
      name: subtopicName,
      miTips: stage.miTechnique?.trim() || '',
      brief: '',
      miTechnique: stage.miTechnique?.trim() || '',
    })
  })

  const subtopics = Array.from(subtopicMap.values())
  if (!subtopics.length) {
    subtopics.push({
      id: uuidV4(),
      name: 'Imported flow',
      miTips: '',
      brief: '',
      miTechnique: '',
    })
  }

  return {
    id: uuidV4(),
    name: topicName,
    subtopics,
    isCustom: true,
  }
}

const applyBeatJsonImport = async (raw: unknown, fileName: string) => {
  const fallbackTopicName = getImportedBeatTopicName(raw, fileName)
  const topicGroups = buildStagesFromBeatJson(raw, fallbackTopicName)
  if (!topicGroups) {
    return false
  }

  const stageMap = new Map<string, ImportedStageNode[]>()
  topicGroups.forEach((group) => {
    stageMap.set(group.topicName, group.stages)
  })
  const transformed = transform2AntvJson(stageMap)

  const nextTopicGraph = new Map<string, Cell.Properties[]>()
  transformed.forEach((cells, topicName) => {
    nextTopicGraph.set(topicName, cloneTopicGraphCells(cells))
  })

  const firstTopicName = nextTopicGraph.keys().next().value as string | undefined
  if (!firstTopicName) {
    return false
  }

  topicGraph.value = nextTopicGraph
  topicGraphSelected.value = firstTopicName
  topicScripts.value = new Map()
  stateContent.value = ''
  topicIssues.value.clear()
  generationQueue.value = []
  generationCancelled.value = false
  generationProcessing.value = false
  queryTopicStrucLoading.value = false

  const importedTopics = Array.from(topicGroups.values()).map((group) =>
    buildPlanTopicFromStages(group.topicName, group.stages),
  )
  planTopics.value = importedTopics
  const selectedPlanTopic = importedTopics[0]
  ensureTopicExpanded(selectedPlanTopic.id)
  activeSelection.value = {
    topicId: selectedPlanTopic.id,
    subtopicId: selectedPlanTopic.subtopics[0]?.id ?? null,
  }

  if (graph.value) {
    replaceGraphCells(nextTopicGraph.get(firstTopicName) ?? [])
  }
  updateTopicStatsForTopic(firstTopicName)
  persistWorkspace()
  void syncWorkspaceToServer({
    reason: 'import-beat-as-editable-states',
    createSnapshot: true,
    silent: true,
  })

  message.success(
    `Imported BEAT JSON as ${importedTopics.length} editable topic${importedTopics.length === 1 ? '' : 's'}.`,
  )
  return true
}

const onImportClick = () => {
  importInput.value?.click()
}

const handleImportChange = async (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    return
  }

  importLoading.value = true
  try {
    const text = await readFileAsText(file)
    const parsedJson = parseJsonText(text)
    if (parsedJson && (await applyImportedDesignerJson(parsedJson))) {
      return
    }
    if (parsedJson && (await applyBeatJsonImport(parsedJson, file.name))) {
      return
    }

    const summaries = await importDialogueFromScript(text, { sourceName: file.name })
    const importedTopics = buildPlanTopicsFromImport(summaries)
    planTopics.value = importedTopics

    if (importedTopics.length) {
      ensureTopicExpanded(importedTopics[0].id)
      onTopicClick(importedTopics[0])
    } else {
      activeSelection.value = { topicId: null, subtopicId: null }
    }

    message.success(
      `Imported ${summaries.length} topic${summaries.length === 1 ? '' : 's'} successfully.`,
    )
  } catch (error) {
    console.error('Failed to import dialogue', error)
    const messageText = error instanceof Error ? error.message : 'Failed to import dialogue.'
    message.error(messageText)
  } finally {
    importLoading.value = false
    if (target) {
      target.value = ''
    }
  }
}





const onCreate = () => {

  if (!topicGraphSelected.value) {
    message.info('Create or select a topic before adding states.')
    return
  }

  if (graph.value) {
    const metadata = getActiveSubtopicMetadata()
    const stateName = buildNextManualStateName()

    const node = graph.value.createNode(
      buildManualStageNodeDefinition({
        name: stateName,
        subtopic: metadata.subtopic,
        miTechnique: metadata.miTechnique,
        isTopicStart: false,
      }),
    )

    graph.value.addNode(node)
    recordAnalyticsEvent('state_added', 'manual', {
      topicName: (topicGraphSelected.value || '').trim(),
      stateName,
      meta: {
        shape: 'stage-node',
      },
    })

  }

}

const onCreateJumpState = () => {
  const sourceTopic = (topicGraphSelected.value || '').trim()
  if (!graph.value || !sourceTopic) {
    return
  }

  const targetTopic = getManualJumpDefaultTargetTopic(sourceTopic)
  const jumpNode = graph.value.createNode({
    ...createJumpNodeCell({
      position: buildManualJumpPosition(),
      targetTopic,
      sourceTopic,
      sourceState: selectedGraphState.value || '',
      routeManaged: false,
      routeTargetIndex: -1,
    }),
  })

  graph.value.addNode(jumpNode)
  recordAnalyticsEvent('state_added', 'manual', {
    topicName: sourceTopic,
    stateName: 'jump_state',
    meta: {
      shape: 'jump-node',
      targetTopic,
    },
  })
  message.success('Added a transition state. Connect an option to it when the dialogue should move to another topic.')
}



const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

const readBeatPayload = (value: unknown): unknown => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.beatJson !== undefined) return record.beatJson
    if (record.beat_json !== undefined) return record.beat_json
    if (record.data !== undefined) return record.data
  }
  return value
}

const normalizeBeatJsonString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) return null
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch (error) {
      return trimmed
    }
  }

  if (value && typeof value === 'object') {
    return safeJson(value)
  }

  return null
}

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

const buildPreviewScriptKey = (topicName: string, script: string) => `${topicName}::${hashText(script)}`

const prunePreviewCaches = (now = Date.now()) => {
  for (const [key, entry] of previewBeatCache.entries()) {
    if (now - entry.createdAt > PREVIEW_CACHE_TTL_MS) {
      previewBeatCache.delete(key)
    }
  }
}

const downloadText = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const roundMetric = (value: number, digits = 4) => {
  if (!Number.isFinite(value)) {
    return 0
  }
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const toIsoTimestamp = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value).toISOString()
    : null

const toDurationMinutes = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? roundMetric(value / 60_000, 2) : null

const buildAnalyticsFileName = () => {
  const safeUserName = sanitizeTopicName(userNameDisplay.value || analyticsState.value?.userName || 'user')
  return `analytic_${safeUserName}.json`
}

const buildSupportBundleFileName = () => {
  const safeUserName = sanitizeTopicName(userNameDisplay.value || analyticsState.value?.userName || 'user')
  return `support_bundle_${safeUserName}.json`
}

const buildAnalyticsExportPayload = () => {
  const currentAnalyticsState = analyticsState.value
  const summary = buildCurrentAnalyticsSummary(Date.now())
  if (!currentAnalyticsState || !summary) {
    return null
  }

  const topicNames = buildAvailableTopicNames()
  const routing = normalizeTopicRouting(api1Result.value?.topic_routing ?? null, topicNames)
  const eventCountsByType = currentAnalyticsState.events.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.type] = (accumulator[event.type] || 0) + 1
    return accumulator
  }, {})
  const eventCountsBySource = currentAnalyticsState.events.reduce<Record<string, number>>(
    (accumulator, event) => {
      accumulator[event.source] = (accumulator[event.source] || 0) + 1
      return accumulator
    },
    {},
  )

  return {
    summary: {
      generatedAt: toIsoTimestamp(summary.generatedAt),
      userName: currentAnalyticsState.userName,
      sessionId: currentAnalyticsState.sessionId,
      efficiencyAndWorkload: {
        sessionDurationMs: summary.sessionDurationMs,
        sessionDurationMinutes: toDurationMinutes(summary.sessionDurationMs),
        effectiveEditingDurationMs: summary.effectiveEditingDurationMs,
        effectiveEditingDurationMinutes: toDurationMinutes(summary.effectiveEditingDurationMs),
        timeToFirstPreviewMs: summary.timeToFirstPreviewMs,
        timeToFirstPreviewMinutes: toDurationMinutes(summary.timeToFirstPreviewMs),
        planGenerateWaitMs: summary.planGenerateWaitMs,
        planGenerateWaitMinutes: toDurationMinutes(summary.planGenerateWaitMs),
        topicGenerateWaitMsTotal: summary.topicGenerateWaitMsTotal,
        topicGenerateWaitMinutesTotal: toDurationMinutes(summary.topicGenerateWaitMsTotal),
        aiWaitRatio: roundMetric(summary.aiWaitRatio),
      },
      aiDependenceAndUse: {
        planGenerateCount: summary.planGenerateCount,
        topicRegenerateCount: summary.topicRegenerateCount,
        suggestOptionsRequestCount: summary.suggestOptionsRequestCount,
        suggestOptionsApplyCount: summary.suggestOptionsApplyCount,
        stateRewriteRequestCount: summary.stateRewriteRequestCount,
        stateRewriteApplyCount: summary.stateRewriteApplyCount,
        suggestionAcceptanceRate: roundMetric(summary.suggestionAcceptanceRate),
        aiAcceptanceRate: roundMetric(summary.aiAcceptanceRate),
        aiContributionRatio: roundMetric(summary.aiContributionRatio),
      },
      manualEditing: {
        manualEditBurstCount: summary.manualEditBurstCount,
        manualAgentEditCount: summary.manualAgentEditCount,
        manualOptionEditCount: summary.manualOptionEditCount,
        manualRouteEditCount: summary.manualRouteEditCount,
        modifiedStateCount: summary.modifiedStateCount,
        modifiedOptionCount: summary.modifiedOptionCount,
        stateAddedCount: summary.stateAddedCount,
        stateDeletedCount: summary.stateDeletedCount,
        edgeChangedCount: summary.edgeChangedCount,
        manualTextDelta: summary.manualTextDelta,
        directEditingIntensity: roundMetric(summary.directEditingIntensity),
        overwriteRatio: roundMetric(summary.overwriteRatio),
      },
      finalVsAiDifference: {
        finalTextModificationRatio: roundMetric(summary.finalTextModificationRatio),
        stateTextModificationRatio: roundMetric(summary.stateTextModificationRatio),
        optionTextModificationRatio: roundMetric(summary.optionTextModificationRatio),
        textChangeRatio: roundMetric(summary.textChangeRatio),
        stateChangedRatio: roundMetric(summary.stateChangedRatio),
        optionChangedRatio: roundMetric(summary.optionChangedRatio),
        structureChangeRatio: roundMetric(summary.structureChangeRatio),
        routeChangeRatio: roundMetric(summary.routeChangeRatio),
        finalVsAiDistance: roundMetric(summary.finalVsAiDistance),
      },
      currentDesign: {
        stateCount: summary.currentGraph.stateCount,
        optionCount: summary.currentGraph.optionCount,
        utteranceCount: summary.currentGraph.utteranceCount,
        edgeCount: summary.currentGraph.edgeCount,
        branchingFactorAvg: roundMetric(summary.currentGraph.branchingFactorAvg),
        branchingFactorMax: roundMetric(summary.currentGraph.branchingFactorMax),
        maxDepth: roundMetric(summary.currentGraph.maxDepth),
        avgDepth: roundMetric(summary.currentGraph.avgDepth),
        deadEndCount: summary.currentGraph.deadEndCount,
        orphanStateCount: summary.currentGraph.orphanStateCount,
        utteranceWordCount: summary.currentGraph.utteranceWordCount,
        utteranceCharCount: summary.currentGraph.utteranceCharCount,
        avgUtteranceWords: roundMetric(summary.currentGraph.avgUtteranceWords),
      },
    },
    session: {
      userName: currentAnalyticsState.userName,
      sessionId: currentAnalyticsState.sessionId,
      startedAt: toIsoTimestamp(currentAnalyticsState.startedAt),
      lastActivityAt: toIsoTimestamp(currentAnalyticsState.lastActivityAt),
      eventCount: currentAnalyticsState.events.length,
      eventCountsByType,
      eventCountsBySource,
    },
    detailedMetrics: summary,
    currentRouting: routing,
    planBaseline: currentAnalyticsState.planBaseline,
    topicBaselines: currentAnalyticsState.topicBaselines,
    events: currentAnalyticsState.events,
  }
}

const onDownloadAnalytics = () => {
  const payload = buildAnalyticsExportPayload()
  if (!payload) {
    message.warning('Analytics are not ready yet.')
    return
  }

  const fileName = buildAnalyticsFileName()
  downloadText(JSON.stringify(payload, null, 2), fileName)
  message.success(`Downloaded ${fileName}`)
}

const buildSupportBundlePayload = () => {
  const analyticsPayload = buildAnalyticsExportPayload()
  const workspacePayload = buildWorkspacePayload({ forceCurrentGraphSnapshot: true })
  const userThreadSnapshot = buildUserThreadSnapshot()
  const generationStateSnapshot = buildGenerationStateSnapshot()
  const analyticsSnapshot = buildAnalyticsStateSnapshot()
  const topicNames = buildAvailableTopicNames()
  const routing = normalizeTopicRouting(api1Result.value?.topic_routing ?? null, topicNames)

  const browserInfo =
    typeof window === 'undefined'
      ? null
      : {
          url: window.location.href,
          path: window.location.pathname,
          userAgent: window.navigator.userAgent,
          language: window.navigator.language,
          online: window.navigator.onLine,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }

  return {
    schemaVersion: 1,
    bundleType: 'healthdial-support-bundle',
    generatedAt: new Date().toISOString(),
    app: {
      name: 'healthdial-dialogue-designer',
      version: '0.0.1',
      baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    },
    user: {
      userName: userNameDisplay.value || analyticsState.value?.userName || '',
      authoringMode: authoringMode.value,
      userSessionReady: userSessionReady.value,
    },
    diagnostics: {
      selectedTopic: topicGraphSelected.value,
      selectedState: selectedGraphState.value,
      activePreviewTopic: activePreviewTopic.value,
      activePreviewState: activePreviewState.value,
      previewErrorSummary: previewErrorSummary.value || null,
      previewErrorDetail: previewErrorDetail.value || null,
      queryTopicStrucLoading: queryTopicStrucLoading.value,
      exportLoading: exportLoading.value,
      previewLoading: previewLoading.value,
      importLoading: importLoading.value,
      autoSaveMessage: autoSaveMessage.value,
    },
    browser: browserInfo,
    routing,
    workspace: workspacePayload,
    userThread: userThreadSnapshot,
    generationState: generationStateSnapshot,
    analyticsSummary: analyticsPayload?.summary ?? null,
    analyticsState: analyticsSnapshot,
    analyticsExport: analyticsPayload,
  }
}

const onDownloadSupportBundle = () => {
  const payload = buildSupportBundlePayload()
  const fileName = buildSupportBundleFileName()
  downloadText(JSON.stringify(payload, null, 2), fileName)
  message.success(`Downloaded ${fileName}`)
}

const setPreviewError = (payload: R2JErrorPayload) => {
  previewErrorSummary.value = payload.message
  previewErrorDetail.value = safeJson(payload)
  previewErrorExpanded.value = false
  message.error(payload.message)
}

const clearPreviewError = () => {
  previewErrorSummary.value = ''
  previewErrorDetail.value = ''
  previewErrorExpanded.value = false
}

const shouldProbeR2JHealth = (payload: R2JErrorPayload) => {
  if (!payload) return false
  if (payload.code === 'NETWORK_ERROR') return true
  if (payload.code === 'UNKNOWN_ERROR') return true
  if (
    typeof payload.message === 'string' &&
    /request failed with status code 500/i.test(payload.message) &&
    !payload.detail
  ) {
    return true
  }
  return false
}

const enrichR2JErrorWithHealthProbe = async (
  payload: R2JErrorPayload,
): Promise<R2JErrorPayload> => {
  if (!shouldProbeR2JHealth(payload)) {
    return payload
  }

  try {
    const health = await requestR2JHealth()
    if (health?.ok) {
      return payload
    }

    return {
      ...payload,
      code: 'R2J_BACKEND_UNHEALTHY',
      message: 'R2J preview backend is unhealthy.',
      detail:
        payload.detail ||
        `Health response: ${safeJson(health)}\nExpected: {"ok": true}.`,
    }
  } catch (healthError) {
    const healthPayload = parseR2JError(
      healthError,
      'R2J preview backend is unreachable.',
    )

    return {
      ...payload,
      code: 'R2J_BACKEND_UNAVAILABLE',
      message: 'R2J preview backend is unavailable.',
      detail:
        [
          payload.detail,
          healthPayload.detail,
          'Please run `npm run dev:backend` in `DialogueDesigner10-9`.',
        ]
          .filter((item) => typeof item === 'string' && item.trim().length > 0)
          .join('\n') ||
        'Please run `npm run dev:backend` in `DialogueDesigner10-9`.',
    }
  }
}

const getCurrentTopicScript = () => {
  flushCurrentGraphSnapshot()
  flushAllTopicGraphs()

  const topicName = topicGraphSelected.value
  if (!topicName) {
    throw new Error('Please select a topic before preview/export.')
  }

  if (!topicGraph.value.has(topicName)) {
    throw new Error(`Topic "${topicName}" does not have editable states.`)
  }

  const cells = topicGraph.value.get(topicName) ?? []
  if (!cells.length) {
    throw new Error(`Topic "${topicName}" is empty.`)
  }

  syncRouteManagedJumpsForTopic(topicName, { reloadCurrent: false })
  const latestCells = topicGraph.value.get(topicName) ?? cells
  return buildTopicScriptFromCells(topicName, stripCrossTopicArtifacts(latestCells))
}

const getConversationScript = () => {
  flushCurrentGraphSnapshot()
  flushAllTopicGraphs()

  const orderedTopicNames = buildOrderedPlanTopicNames(
    (api1Result.value?.all_topics ?? null) as Record<string, unknown> | null,
    (api1Result.value?.sessions_topics ?? null) as Record<string, Record<string, unknown>> | null,
  )

  const topicNames =
    orderedTopicNames.length > 0
      ? orderedTopicNames
      : Array.from(topicGraph.value.keys()).filter((topicName) => topicName.trim().length > 0)

  if (!topicNames.length) {
    throw new Error('Generate at least one topic before exporting the full conversation.')
  }

  const missingTopics = topicNames.filter((topicName) => !topicGraph.value.has(topicName))
  if (missingTopics.length) {
    throw new Error(`Generate these topics first: ${missingTopics.join(', ')}`)
  }

  const emptyTopics = topicNames.filter((topicName) => !(topicGraph.value.get(topicName) ?? []).length)
  if (emptyTopics.length) {
    throw new Error(`These topics do not have editable states yet: ${emptyTopics.join(', ')}`)
  }

  syncRouteManagedJumpsForAllTopics({ reloadCurrent: false })

  const topicSources = topicNames.map((topicName) => ({
    topicName,
    cells: topicGraph.value.get(topicName) ?? [],
  }))

  const routing = normalizeTopicRouting(api1Result.value?.topic_routing ?? null, topicNames)
  const conversationName =
    sessionTopics.value[0]?.sessionName?.trim()?.length
      ? `${sessionTopics.value[0].sessionName.trim()}_conversation`
      : 'full_conversation'

  return buildConversationScript({
    topicSources,
    topicRouting: routing,
    conversationName,
  })
}

const toStateName = (value: unknown): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length ? normalized : null
}

function normalizeTopicLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
}

function getActiveSubtopicName() {
  const { topicId, subtopicId } = activeSelection.value
  if (!topicId || !subtopicId) {
    return null
  }
  const topic = planTopics.value.find((entry) => entry.id === topicId)
  if (!topic) {
    return null
  }
  const subtopic = topic.subtopics.find((entry) => entry.id === subtopicId)
  return subtopic?.name?.trim() || null
}

function getActiveSubtopicMetadata() {
  const { topicId, subtopicId } = activeSelection.value
  if (!topicId || !subtopicId) {
    return {
      subtopic: '',
      miTechnique: '',
    }
  }

  const topic = planTopics.value.find((entry) => entry.id === topicId)
  if (!topic) {
    return {
      subtopic: '',
      miTechnique: '',
    }
  }

  const currentSubtopic = topic.subtopics.find((entry) => entry.id === subtopicId)
  return {
    subtopic: currentSubtopic?.name?.trim() || '',
    miTechnique: currentSubtopic?.miTechnique?.trim() || '',
  }
}

const buildManualStageNodeDefinition = (options: {
  name?: string
  subtopic?: string
  miTechnique?: string
  isTopicStart?: boolean
  position?: { x: number; y: number }
}) => ({
  children: [],
  data: {
    agent: '',
    name: options.name?.trim() || 'new_state',
    menus: [],
    subtopic: options.subtopic?.trim() || '',
    miTechnique: options.miTechnique?.trim() || '',
    isTopicStart: Boolean(options.isTopicStart),
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
  position: options.position ?? {
    x: 0,
    y: 0,
  },
  shape: STAGE_NODE_SHAPE,
  size: { width: STAGE_NODE_WIDTH, height: calcStageNodeHeight(0) },
  view: 'vue-shape-view',
  zIndex: 10,
})

const buildNextManualStateName = () => {
  const stageNodes = graph.value?.getNodes?.().filter((node: any) => node.shape === STAGE_NODE_SHAPE) ?? []
  const usedNames = new Set(
    stageNodes
      .map((node: any) => normalizeTopicKey((node?.data?.name ?? '').toString()))
      .filter((entry: string) => entry.length > 0),
  )

  let index = 1
  while (usedNames.has(normalizeTopicKey(`new_state_${index}`))) {
    index += 1
  }
  return `new_state_${index}`
}

const buildManualTopicStartPosition = () => {
  const stageNodes = graph.value?.getNodes?.().filter((node: any) => node.shape === STAGE_NODE_SHAPE) ?? []
  if (!stageNodes.length) {
    return {
      x: 0,
      y: 0,
    }
  }

  const minX = stageNodes.reduce((currentMin: number, node: any) => {
    const position = node.getPosition?.() ?? { x: 0 }
    return Math.min(currentMin, Number(position.x || 0))
  }, Number.POSITIVE_INFINITY)

  const yPositions = stageNodes.map((node: any) => Number(node.getPosition?.()?.y || 0))
  const minY = yPositions.length ? Math.min(...yPositions) : 0

  return {
    x: Math.min(0, minX - STAGE_NODE_WIDTH - 120),
    y: minY,
  }
}

const ensureManualTopicStartState = (topicName: string) => {
  const normalizedTopicName = topicName.trim()
  if (!isManualAuthoringMode.value || !normalizedTopicName) {
    return false
  }

  const currentCells = cloneTopicGraphCells(topicGraph.value.get(normalizedTopicName))
  const stageCells = getTopicStageCells(currentCells)

  if (!stageCells.length) {
    const metadata = getActiveSubtopicMetadata()
    const startCell = buildManualStageNodeDefinition({
      name: 'topic_start',
      subtopic: metadata.subtopic,
      miTechnique: metadata.miTechnique,
      isTopicStart: true,
      position: { x: 0, y: 0 },
    })
    const nextCells = cloneTopicGraphCells([startCell as unknown as Cell.Properties])
    topicGraph.value.set(normalizedTopicName, nextCells)
    if (topicGraphSelected.value === normalizedTopicName && graph.value) {
      replaceGraphCells(nextCells)
    }
    return true
  }

  const normalized = normalizeTopicStartFlags(currentCells)
  if (!normalized.changed) {
    return false
  }

  topicGraph.value.set(normalizedTopicName, normalized.cells)
  if (topicGraphSelected.value === normalizedTopicName && graph.value) {
    replaceGraphCells(normalized.cells)
  }
  return true
}

function highlightSubtopicStates() {
  const selectedTopicId = activeSelection.value.topicId
  const selectedTopic = selectedTopicId
    ? planTopics.value.find((entry) => entry.id === selectedTopicId)
    : null
  const activeSubtopicName = getActiveSubtopicName()
  const canHighlight =
    Boolean(selectedTopic) &&
    Boolean(topicGraphSelected.value) &&
    normalizeTopicLabel(selectedTopic?.name) === normalizeTopicLabel(topicGraphSelected.value) &&
    Boolean(activeSubtopicName)

  const targetSubtopic = normalizeTopicLabel(activeSubtopicName)
  const stageNodes = graph.value?.getNodes?.().filter((entry: any) => entry.shape === 'stage-node') ?? []

  stageNodes.forEach((node: any) => {
    const data = node.getData?.() ?? node.data ?? {}
    const nodeSubtopic = normalizeTopicLabel(data?.subtopic)
    const isActive = Boolean(canHighlight && targetSubtopic && nodeSubtopic === targetSubtopic)
    if (Boolean(data.subtopicActive) !== isActive) {
      node.setData({
        ...data,
        subtopicActive: isActive,
      })
    }
  })
}

const highlightPreviewState = (stateName: string | null) => {
  const normalized = toStateName(stateName)
  const stageNodes = graph.value?.getNodes?.().filter((entry: any) => entry.shape === 'stage-node') ?? []

  stageNodes.forEach((node: any) => {
    const data = node.getData?.() ?? node.data ?? {}
    const nodeStateName = toStateName(data?.name)
    const isActive = Boolean(normalized && nodeStateName === normalized)
    if (Boolean(data.previewActive) !== isActive) {
      node.setData({
        ...data,
        previewActive: isActive,
      })
    }
  })
}

const toPostMessagePayload = (payload: Record<string, unknown>) => {
  try {
    return JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>
  } catch (error) {
    console.warn('Failed to sanitize preview postMessage payload:', error)
    return {}
  }
}

const postAgentMessage = (payload: Record<string, unknown>) => {
  const frameWindow = agentPreviewFrame.value?.contentWindow
  if (!frameWindow) {
    throw new Error('Unity preview iframe is not ready yet.')
  }
  frameWindow.postMessage(toPostMessagePayload(payload), getAgentPreviewOrigin())
}

const sendPreviewAgentSelection = (agentName: PreviewAgentName) => {
  const mappedAgent = PREVIEW_AGENT_ALIASES[agentName]
  enqueueAgentMessage({
    type: AGENT_SWITCH_TYPE,
    payload: {
      agent: mappedAgent,
      label: agentName,
    },
  })
}

const enqueueAgentMessage = (payload: Record<string, unknown>) => {
  const safePayload = toPostMessagePayload(payload)

  if (!previewRuntimeReady.value) {
    const payloadType = typeof safePayload.type === 'string' ? safePayload.type : ''
    const loadTopicType = `${AGENT_HOST_EVENT_PREFIX}:load-topic`
    const stopType = `${AGENT_HOST_EVENT_PREFIX}:stop`

    if (payloadType === stopType) {
      pendingPreviewMessages.value = []
      return
    }

    if (payloadType === loadTopicType) {
      pendingPreviewMessages.value = [
        ...pendingPreviewMessages.value.filter(
          (entry) => (typeof entry.type === 'string' ? entry.type : '') !== loadTopicType,
        ),
        safePayload,
      ]
      return
    }

    if (payloadType === AGENT_SWITCH_TYPE) {
      const withoutSwitch = pendingPreviewMessages.value.filter(
        (entry) => (typeof entry.type === 'string' ? entry.type : '') !== AGENT_SWITCH_TYPE,
      )
      const loadIndex = withoutSwitch.findIndex(
        (entry) => (typeof entry.type === 'string' ? entry.type : '') === loadTopicType,
      )
      pendingPreviewMessages.value =
        loadIndex < 0
          ? [...withoutSwitch, safePayload]
          : [...withoutSwitch.slice(0, loadIndex), safePayload, ...withoutSwitch.slice(loadIndex)]
      return
    }

    pendingPreviewMessages.value = [...pendingPreviewMessages.value, safePayload]
    return
  }
  postAgentMessage(safePayload)
}

const flushPendingAgentMessages = () => {
  if (!previewRuntimeReady.value || !pendingPreviewMessages.value.length) {
    return
  }

  pendingPreviewMessages.value.forEach((entry) => {
    postAgentMessage(entry)
  })
  pendingPreviewMessages.value = []
}

const resolvePreviewStartState = (topicName: string, fallbackStartState: string | null, requestedState?: string | null) => {
  const explicit = toStateName(requestedState)
  if (explicit) return explicit

  const sessionState = toStateName(previewLastStateByTopic[topicName])
  if (sessionState) return sessionState

  return toStateName(fallbackStartState)
}

const toggleAgentPanelVisibility = () => {
  agentPanelVisible.value = !agentPanelVisible.value
  if (agentPanelVisible.value) {
    agentPanelCollapsed.value = false
    syncAgentPanelSizeToViewport()
  }
  persistWorkspace()
}

const onSelectPreviewAgent = (agentName: PreviewAgentName) => {
  selectedPreviewAgent.value = agentName

  if (!agentPanelVisible.value) {
    return
  }

  try {
    sendPreviewAgentSelection(agentName)
    message.success(`Switched preview agent to ${agentName}.`)
  } catch (error) {
    const payload = parseR2JError(error, 'Failed to switch preview agent.')
    setPreviewError(payload)
  }
}

const toggleAgentPanelCollapsed = () => {
  agentPanelCollapsed.value = !agentPanelCollapsed.value
  if (!agentPanelCollapsed.value) {
    syncAgentPanelSizeToViewport()
  }
  persistWorkspace()
}

const schedulePreviewReadyTimeout = () => {
  if (typeof window === 'undefined') {
    return
  }

  if (previewReadyTimer !== null) {
    window.clearTimeout(previewReadyTimer)
  }

  previewReadyTimer = window.setTimeout(() => {
    if (!previewRuntimeReady.value && agentPanelVisible.value) {
      setPreviewError({
        code: 'UNITY_NOT_READY',
        message: 'Agent Panel loaded, but Unity WebGL is not ready.',
        detail: `Unity runtime did not respond in time. Current configured URL: ${agentPreviewUrl.value}`,
      })
    }
  }, 6000)
}

const onAgentFrameLoad = () => {
  previewRuntimeReady.value = false
  schedulePreviewReadyTimeout()
}

const loadBeatJsonForPreview = async (payload: {
  topicName: string
  script: string
  startState: string | null
}) => {
  prunePreviewCaches()
  const scriptKey = buildPreviewScriptKey(payload.topicName, payload.script)

  const cached = previewBeatCache.get(scriptKey)
  if (cached && Date.now() - cached.createdAt <= PREVIEW_CACHE_TTL_MS) {
    return cached.beatJson
  }

  if (cached) {
    previewBeatCache.delete(scriptKey)
  }

  const response = await requestR2JPreview({
    topicName: payload.topicName,
    script: payload.script,
    startState: payload.startState,
  })

  const beatPayload = readBeatPayload(response)
  const beatJson = normalizeBeatJsonString(beatPayload)
  if (!beatJson) {
    throw new Error('Backend returned empty BEAT JSON payload.')
  }

  previewBeatCache.set(scriptKey, {
    beatJson,
    createdAt: Date.now(),
  })

  return beatJson
}

const runPreviewScript = async (
  payload: {
    topicName: string
    script: string
    startState: string | null
  },
  options: {
    errorMessage: string
    highlightState?: string | null
  },
) => {
  previewLoading.value = true
  clearPreviewError()

  try {
    const beatJson = await loadBeatJsonForPreview(payload)

    activePreviewTopic.value = payload.topicName
    activePreviewState.value = payload.startState
    if (payload.startState) {
      previewLastStateByTopic[payload.topicName] = payload.startState
    }

    highlightPreviewState(options.highlightState ?? payload.startState)
    agentPanelVisible.value = true

    sendPreviewAgentSelection(selectedPreviewAgent.value)

    enqueueAgentMessage({
      type: `${AGENT_HOST_EVENT_PREFIX}:load-topic`,
      payload: {
        topicName: payload.topicName,
        startState: payload.startState,
        beatJson,
      },
    })
    recordAnalyticsEvent('preview_run_success', 'manual', {
      topicName: payload.topicName,
      stateName: payload.startState || undefined,
      meta: {
        mode: options.highlightState === null ? 'conversation' : 'topic',
      },
    })
    message.success('Preview payload sent to Unity panel.')
  } catch (error) {
    const parsedPayload = parseR2JError(error, options.errorMessage)
    const enriched = await enrichR2JErrorWithHealthProbe(parsedPayload)
    console.error('Preview failed', { error, payload: enriched })
    setPreviewError(enriched)
  } finally {
    previewLoading.value = false
  }
}

const runPreview = async (requestedState: string | null = null) => {
  const topicScript = getCurrentTopicScript()
  const startState = resolvePreviewStartState(topicScript.topicName, topicScript.startState, requestedState)

  await runPreviewScript(
    {
      topicName: topicScript.topicName,
      script: topicScript.script,
      startState,
    },
    {
      errorMessage: 'Failed to preview topic.',
      highlightState: startState,
    },
  )
}

const drainPreviewQueue = async () => {
  if (previewQueueInFlight.value) {
    return
  }

  previewQueueInFlight.value = true
  try {
    while (queuedPreviewState.value !== undefined) {
      const nextPreviewState = queuedPreviewState.value
      queuedPreviewState.value = undefined
      await runPreview(nextPreviewState)
    }
  } finally {
    previewQueueInFlight.value = false
  }
}

const queuePreview = (requestedState: string | null = null) => {
  queuedPreviewState.value = toStateName(requestedState)
  void drainPreviewQueue()
}

const onPreviewTopic = () => {
  queuePreview(null)
}

const onPreviewConversation = async () => {
  const conversationScript = getConversationScript()
  await runPreviewScript(
    {
      topicName: conversationScript.topicName,
      script: conversationScript.script,
      startState: conversationScript.startState,
    },
    {
      errorMessage: 'Failed to preview conversation.',
      highlightState: null,
    },
  )
}

const onPreviewFromCurrentState = () => {
  queuePreview(selectedGraphState.value)
}

const onStopPreview = () => {
  queuedPreviewState.value = undefined
  if (activePreviewTopic.value && activePreviewState.value) {
    previewLastStateByTopic[activePreviewTopic.value] = activePreviewState.value
  }

  try {
    enqueueAgentMessage({
      type: `${AGENT_HOST_EVENT_PREFIX}:stop`,
    })
  } catch (error) {
    const payload = parseR2JError(error, 'Failed to stop preview.')
    setPreviewError(payload)
    return
  }

  message.success('Preview stopped.')
}

const exportBeatFromScript = async (payload: {
  topicName: string
  script: string
  startState?: string | null
  errorMessage: string
}) => {
  exportLoading.value = true

  try {
    const response = await requestR2JExportTopic({
      topicName: payload.topicName,
      script: payload.script,
    })

    const beatPayload = readBeatPayload(response)
    const beatJson = normalizeBeatJsonString(beatPayload)
    if (!beatJson) {
      throw new Error('Backend returned empty BEAT JSON payload.')
    }

    const summary = buildCurrentAnalyticsSummary(Date.now())
    const fileName = `${sanitizeTopicName(payload.startState || payload.topicName)}.json`
    downloadText(beatJson, fileName)
    recordAnalyticsEvent('export_final', 'manual', {
      topicName: payload.topicName,
      stateName: payload.startState || undefined,
      meta: summary
        ? {
            finalVsAiDistance: summary.finalVsAiDistance,
            stateCount: summary.currentGraph.stateCount,
            optionCount: summary.currentGraph.optionCount,
          }
        : undefined,
    })
    message.success(`Exported ${fileName}`)
  } catch (error) {
    const parsedPayload = parseR2JError(error, payload.errorMessage)
    const errorPayload = await enrichR2JErrorWithHealthProbe(parsedPayload)
    console.error(errorPayload.message, { error, payload: errorPayload })
    setPreviewError(errorPayload)
  } finally {
    exportLoading.value = false
  }
}

const onExport = async () => {
  const conversationScript = getConversationScript()
  await exportBeatFromScript({
    topicName: conversationScript.topicName,
    script: conversationScript.script,
    startState: conversationScript.startState,
    errorMessage: 'Failed to export conversation BEAT JSON.',
  })
  persistWorkspace({ forceCurrentGraphSnapshot: true })
  void syncWorkspaceToServer({
    reason: 'export',
    createSnapshot: true,
    silent: true,
    forceCurrentGraphSnapshot: true,
  })
}

const onStagePreviewRequest = (event: Event) => {
  const customEvent = event as CustomEvent<{ stateName?: string }>
  const stateName = toStateName(customEvent?.detail?.stateName)
  if (!stateName) {
    return
  }

  selectedGraphState.value = stateName
  queuePreview(stateName)
}

const onAgentRuntimeMessage = (event: MessageEvent) => {
  const iframeWindow = agentPreviewFrame.value?.contentWindow
  if (iframeWindow && event.source !== iframeWindow) {
    return
  }

  const expectedOrigin = getAgentPreviewOrigin()
  if (expectedOrigin !== '*' && event.origin && event.origin !== expectedOrigin) {
    return
  }

  const data = event.data
  if (!data || typeof data !== 'object') {
    return
  }

  const type = (data as { type?: unknown }).type
  if (typeof type !== 'string' || !type.startsWith(AGENT_HOST_EVENT_PREFIX)) {
    return
  }

  if (type === `${AGENT_HOST_EVENT_PREFIX}:ready`) {
    previewRuntimeReady.value = true
    if (typeof window !== 'undefined' && previewReadyTimer !== null) {
      window.clearTimeout(previewReadyTimer)
      previewReadyTimer = null
    }
    flushPendingAgentMessages()
    return
  }

  if (type === `${AGENT_HOST_EVENT_PREFIX}:state`) {
    const payload = (data as { payload?: Record<string, unknown> }).payload ?? {}
    const topicName = toStateName(payload.topicName) ?? activePreviewTopic.value
    const stateName = toStateName(payload.stateName)

    if (topicName && stateName) {
      previewLastStateByTopic[topicName] = stateName
    }

    activePreviewState.value = stateName
    selectedGraphState.value = stateName
    highlightPreviewState(stateName)
    return
  }

  if (type === `${AGENT_HOST_EVENT_PREFIX}:error`) {
    const payload = (data as { payload?: Record<string, unknown> }).payload ?? {}
    setPreviewError({
      code: typeof payload.code === 'string' ? payload.code : 'BRIDGE_ERROR',
      message:
        (typeof payload.message === 'string' && payload.message) || 'Unity preview reported an error.',
      detail: typeof payload.detail === 'string' ? payload.detail : safeJson(payload),
      topic: typeof payload.topic === 'string' ? payload.topic : undefined,
      state: typeof payload.state === 'string' ? payload.state : undefined,
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
    })
  }
}



onMounted(() => {
  window.addEventListener('healthdial:open-user-name-modal', handleGlobalUserNameModalRequest)
  window.addEventListener('resize', updateTourTarget)
  window.addEventListener('scroll', updateTourTarget, true)

  if (!userSessionReady.value) {
    const restored = restoreLastUserSession()
    if (!restored) {
      nextTick(() => openUserNameModal(true))
    }
  }

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

      connectionPoint: 'anchor',

      anchor: 'center',

      createEdge() {

        return new Shape.Edge({

          attrs: {

            line: {
              ...EDGE_LINE_BASE_ATTRS,

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

  graphStructureEventNames.forEach((event) => {

    graph.on(event, () => captureGraphSnapshot({ structureChanged: true }))

  })

  graphLayoutEventNames.forEach((event) => {

    graph.on(event, () => captureGraphSnapshot())

  })

  graph.on('node:change:data', () => captureGraphSnapshot())

  graph.on('edge:connected', ({ edge }) => {
    normalizeEdgeTerminals(edge)
    applyEdgeRoutingAndStyle(edge)
    updateOptionPortByCellId(edge?.getSourceCellId?.())
    updateOptionPortByCellId(edge?.getTargetCellId?.())
    syncOptionNodeCrossTopicState(graph.getCellById?.(edge?.getSourceCellId?.()))
    if (!isGraphHydrating()) {
      recordAnalyticsEvent('edge_changed', 'manual', {
        topicName: (topicGraphSelected.value || '').trim(),
        field: 'edge',
        meta: {
          sourceCellId: edge?.getSourceCellId?.() || '',
          targetCellId: edge?.getTargetCellId?.() || '',
          reason: 'connected',
        },
      })
    }
    scheduleEdgePresentationRefresh()
    captureGraphSnapshot({ structureChanged: true })
  })

  graph.on('edge:added', ({ edge }) => {
    normalizeEdgeTerminals(edge)
    applyEdgeRoutingAndStyle(edge)
    syncOptionNodeCrossTopicState(graph.getCellById?.(edge?.getSourceCellId?.()))
    scheduleEdgePresentationRefresh()
  })

  graph.on('edge:removed', ({ edge }) => {
    updateOptionPortByCellId(edge?.getSourceCellId?.())
    updateOptionPortByCellId(edge?.getTargetCellId?.())
    syncOptionNodeCrossTopicState(graph.getCellById?.(edge?.getSourceCellId?.()))
    scheduleEdgePresentationRefresh()
  })

  graph.on('node:added', ({ node }) => {
    if (node.shape === STAGE_NODE_SHAPE) {
      realignStageOptionLayout(node)
    }
    updateOptionNodePortState(node)
    syncOptionNodeCrossTopicState(node)
  })

  graph.on('node:removed', ({ node }) => {
    if (relationFocusStateNodeId.value === String(node?.id)) {
      relationFocusStateNodeId.value = null
    }
    if (
      !isGraphHydrating() &&
      (node?.shape === STAGE_NODE_SHAPE || node?.shape === JUMP_NODE_SHAPE) &&
      !node?.data?.routeManaged
    ) {
      recordAnalyticsEvent('state_deleted', 'manual', {
        topicName: (topicGraphSelected.value || '').trim(),
        stateName: (node?.data?.name ?? node?.id ?? '').toString(),
        meta: {
          shape: node?.shape,
        },
      })
    }
    updateOptionNodePortState(node)
    if (isManualAuthoringMode.value && node?.shape === STAGE_NODE_SHAPE && topicGraphSelected.value) {
      updateSelectedGraphTopic()
      ensureManualTopicStartState(topicGraphSelected.value)
    }
    scheduleEdgePresentationRefresh()
  })

  graph.on('node:change:data', ({ node }) => {
    if (node.shape === STAGE_NODE_SHAPE) {
      realignStageOptionLayout(node)
    }
    syncOptionNodeCrossTopicState(node)
  })

  graph.on('node:click', ({ node }) => {
    if (node.shape !== STAGE_NODE_SHAPE) {
      return
    }
    const data = node.getData?.() ?? node.data ?? {}
    selectedGraphState.value = toStateName(data?.name)
    if (relationFocusStateNodeId.value === String(node.id)) {
      clearRelationFocusHighlight()
      return
    }
    highlightRelationByStateNode(node)
  })

  graph.on('blank:click', () => {
    clearRelationFocusHighlight()
  })

  graph.on('batch:stop', () => {
    cancelScheduledEdgePresentationRefresh()
    realignAllStageOptionLayouts()
    refreshEdgePresentation()
    refreshAllOptionNodePorts()
  })
  realignAllStageOptionLayouts()
  refreshEdgePresentation()
  refreshAllOptionNodePorts()

  if (userSessionReady.value) {
    void restoreActiveUserWorkspace()
  }

  syncAgentPanelSizeToViewport()



  if (typeof window !== 'undefined') {

    startPeriodicAutoSave()

    presenceHeartbeatTimer = window.setInterval(() => {
      void sendConvertPresenceHeartbeat()
    }, 20000)

    window.addEventListener(PREVIEW_EVENT_NAME, onStagePreviewRequest as EventListener)
    window.addEventListener('message', onAgentRuntimeMessage)
    window.addEventListener('resize', syncAgentPanelSizeToViewport)

  }

  void sendConvertPresenceHeartbeat()



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

    if (cell.hasTool('vertices')) {

      cell.removeTool('vertices')

    }

    if (cell.hasTool('button-remove')) {

      cell.removeTool('button-remove')

    }

  })

})

onBeforeUnmount(() => {
  window.removeEventListener('healthdial:open-user-name-modal', handleGlobalUserNameModalRequest)
  window.removeEventListener('resize', updateTourTarget)
  window.removeEventListener('scroll', updateTourTarget, true)

  clearPeriodicAutoSave()

  if (presenceHeartbeatTimer !== null) {

    window.clearInterval(presenceHeartbeatTimer)

    presenceHeartbeatTimer = null

  }

  if (typeof window !== 'undefined') {
    window.removeEventListener(PREVIEW_EVENT_NAME, onStagePreviewRequest as EventListener)
    window.removeEventListener('message', onAgentRuntimeMessage)
    window.removeEventListener('resize', syncAgentPanelSizeToViewport)
    window.removeEventListener('mousemove', onAgentPanelResizeMove)
    window.removeEventListener('mouseup', stopAgentPanelResize)

    if (previewReadyTimer !== null) {
      window.clearTimeout(previewReadyTimer)
      previewReadyTimer = null
    }

    if (routeManagedSyncTimer !== null) {
      window.clearTimeout(routeManagedSyncTimer)
      routeManagedSyncTimer = null
    }

    flushPendingGraphSnapshot()
    clearGraphSnapshotTimer()
    cancelScheduledEdgePresentationRefresh()
    flushPendingAutoSaves()
  }

  agentPanelResizeSession = null
  agentPanelResizeActive.value = false

  if (graph.value) {

    graphStructureEventNames.forEach((event) => {

      graph.value?.off?.(event)

    })
    graphLayoutEventNames.forEach((event) => {

      graph.value?.off?.(event)

    })
    graph.value?.off?.('node:change:data')

  }

})



</script>



<style lang="scss" scoped>

.convert-wrapper {
  height: calc(100vh - $layout-header-height);
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, rgba(15, 118, 110, 0.1), transparent 30%),
    radial-gradient(circle at top right, rgba(14, 165, 165, 0.08), transparent 26%),
    linear-gradient(180deg, #f8fbfb 0%, #edf5f4 100%);

  & > .header {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px 8px;
    background: rgba(255, 255, 255, 0.96);
    border-bottom: 1px solid #d8e3e6;
    box-shadow: 0 6px 18px rgba(35, 85, 94, 0.05);
    backdrop-filter: blur(10px);

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-row-main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .header-actions-left {
      justify-self: start;
      min-width: 0;
    }

    .header-actions-center {
      justify-self: center;
      min-width: max-content;
    }

    .header-actions-right {
      justify-self: end;
      justify-content: flex-end;
      min-width: 0;
    }

    :deep(.toolbar-btn.ant-btn) {
      height: 32px;
      border-radius: 8px;
      padding: 0 12px;
      border-color: #d7e3f2;
      box-shadow: 0 4px 12px rgba(35, 85, 94, 0.05);
      font-weight: 600;
    }

    :deep(.attention-pulse.ant-btn) {
      position: relative;
      z-index: 1;
      animation: convert-attention-pulse 1s ease-in-out infinite;
      border-color: #0f766e;
      box-shadow: 0 0 0 0 rgba(15, 118, 110, 0.42);
    }

    :deep(.attention-strong.ant-btn) {
      border-width: 2px;
      color: #073b3a;
      background: #f2fffb;
    }

    .toolbar-tooltip-wrap {
      display: inline-flex;
    }

    :deep(.toolbar-btn.ant-btn:not(.ant-btn-primary)) {
      background: rgba(255, 255, 255, 0.92);
      color: #173d42;
    }

    :deep(.toolbar-btn-preview.ant-btn.ant-btn-primary) {
      background: linear-gradient(135deg, #0f766e 0%, #0ea5a5 100%);
      border-color: #0f766e;
    }

    :deep(.toolbar-btn-export.ant-btn.ant-btn-primary) {
      background: linear-gradient(135deg, #12343b 0%, #1f5d63 100%);
      border-color: #12343b;
      min-width: 132px;
    }

    :deep(.toolbar-btn-export.ant-btn.ant-btn-primary:disabled),
    :deep(.toolbar-btn-export.ant-btn.ant-btn-primary.ant-btn-disabled) {
      border-color: #d9e2e6;
      background: #f2f5f6;
      color: #8a9aa0;
      box-shadow: none;
    }

    .header-stats {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #49666d;

      .stat-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.84);
        border: 1px solid #d6e8e5;
      }

      .stat-value {
        font-weight: 800;
        font-size: 15px;
        color: #12343b;
      }

      .stat-label {
        font-weight: 600;
        color: #49666d;
      }

      .stat-sub {
        font-size: 12px;
        color: #7f96ad;
      }
    }

    .header-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 14px;
      flex-wrap: wrap;
      margin-left: auto;
    }

    .header-user {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid #d6e8e5;
      color: #49666d;

      .user-name-label {
        font-weight: 700;
        color: #173d42;
      }
    }

    .auto-save-indicator {
      font-size: 12px;
      color: #70859b;
      font-weight: 600;
    }

    .header-status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 28px;
      padding: 0 9px;
      border: 1px solid #d6e8e5;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.84);
      color: #49666d;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .header-status strong {
      color: #12343b;
      font-size: 13px;
      font-weight: 850;
    }

  }

  .convert-guide {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(420px, 0.9fr);
    gap: 18px;
    align-items: center;
    margin: 12px 16px;
    padding: 16px 18px;
    border: 1px solid #c8e7e0;
    border-radius: 18px;
    background:
      radial-gradient(circle at top left, rgba(236, 254, 255, 0.9), transparent 32%),
      linear-gradient(135deg, #ffffff 0%, #f8fcfb 100%);
    box-shadow: 0 12px 26px rgba(15, 118, 110, 0.07);
  }

  .convert-guide-kicker {
    margin-bottom: 6px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .convert-guide h1 {
    margin: 0;
    color: #12343b;
    font-size: 24px;
    line-height: 1.2;
    font-weight: 850;
  }

  .convert-guide p {
    margin: 8px 0 0;
    max-width: 900px;
    color: #526d73;
    font-size: 14px;
    line-height: 1.55;
  }

  .convert-guide-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .convert-guide-step {
    display: grid;
    gap: 4px;
    align-content: start;
    min-height: 104px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
  }

  .convert-guide-step span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #0f766e;
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
  }

  .convert-guide-step strong {
    color: #0f172a;
    font-size: 14px;
  }

  .convert-guide-step small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
  }

  .generation-banner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    margin: 0;
    padding: 7px 14px;
    border: 0;
    border-bottom: 1px solid #d8e3e6;
    border-radius: 0;
    background: #fbfdfd;
    box-shadow: none;
  }

  .generation-banner.active {
    border-color: #5eead4;
  }

  .generation-banner.failed {
    border-color: #fecaca;
    background:
      radial-gradient(circle at top left, rgba(254, 242, 242, 0.9), transparent 34%),
      linear-gradient(135deg, #ffffff 0%, #fff7f7 100%);
  }

  .generation-banner-copy {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .generation-banner-kicker {
    color: #62777d;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .generation-banner h2 {
    margin: 0;
    color: #12343b;
    font-size: 14px;
    line-height: 1.25;
    font-weight: 800;
    white-space: nowrap;
  }

  .generation-banner h2 span {
    color: #0f766e;
  }

  .generation-banner p {
    display: none;
    margin: 0;
    max-width: 920px;
    color: #526d73;
    font-size: 14px;
    line-height: 1.5;
  }

  .generation-progress {
    width: 180px;
    max-width: 20vw;
  }

  .generation-count {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .generation-banner-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .attention-anchor {
    position: relative;
    display: inline-flex;
    align-items: center;
    isolation: isolate;
  }

  .attention-callout {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    z-index: 4;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: max-content;
    padding: 5px 9px;
    border-radius: 999px;
    background: #12343b;
    color: #ffffff;
    font-size: 12px;
    line-height: 1;
    font-weight: 900;
    box-shadow: 0 10px 22px rgba(18, 52, 59, 0.22);
    pointer-events: none;
    animation: convert-callout-bob 0.9s ease-in-out infinite;
  }

  .attention-callout::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 0;
    height: 0;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #12343b;
  }

  .tour-overlay {
    position: fixed;
    inset: 0;
    z-index: 3000;
    pointer-events: none;
  }

  .tour-highlight {
    position: fixed;
    z-index: 3001;
    border: 3px solid #0f766e;
    border-radius: 12px;
    box-shadow:
      0 0 0 9999px rgba(8, 24, 28, 0.58),
      0 12px 32px rgba(15, 118, 110, 0.28);
    background: rgba(255, 255, 255, 0.04);
    pointer-events: none;
    transition:
      left 0.18s ease,
      top 0.18s ease,
      width 0.18s ease,
      height 0.18s ease;
  }

  .tour-card {
    position: fixed;
    z-index: 3002;
    pointer-events: auto;
    width: min(360px, calc(100vw - 36px));
    max-height: calc(100vh - 36px);
    overflow: auto;
    padding: 16px;
    border: 1px solid #b8d7d4;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 18px 42px rgba(8, 24, 28, 0.22);
    color: #12343b;
  }

  .tour-step-count {
    margin-bottom: 8px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tour-card h2 {
    margin: 0;
    color: #12343b;
    font-size: 20px;
    line-height: 1.25;
    font-weight: 850;
  }

  .tour-card p {
    margin: 8px 0 0;
    color: #526d73;
    font-size: 14px;
    line-height: 1.55;
  }

  .tour-note {
    margin-top: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    background: #eaf4f3;
    color: #17494f;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 700;
  }

  .tour-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }

  :deep(.generation-primary-action.ant-btn) {
    min-width: 160px;
    height: 34px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 800;
    box-shadow: none;
  }

  :deep(.generation-primary-action.attention-pulse.ant-btn) {
    animation: convert-attention-pulse 1s ease-in-out infinite;
    border-width: 2px;
    background: linear-gradient(135deg, #0f766e 0%, #0ea5a5 100%);
  }

  @keyframes convert-attention-pulse {
    0% {
      box-shadow:
        0 0 0 0 rgba(15, 118, 110, 0.5),
        0 8px 20px rgba(15, 118, 110, 0.26);
    }

    70% {
      box-shadow:
        0 0 0 14px rgba(15, 118, 110, 0),
        0 8px 20px rgba(15, 118, 110, 0.26);
    }

    100% {
      box-shadow:
        0 0 0 0 rgba(15, 118, 110, 0),
        0 8px 20px rgba(15, 118, 110, 0.26);
    }
  }

  @keyframes convert-callout-bob {
    0%,
    100% {
      margin-bottom: 0;
    }

    50% {
      margin-bottom: 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :deep(.attention-pulse.ant-btn),
    :deep(.generation-primary-action.attention-pulse.ant-btn) {
      animation: none;
      box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.2);
    }

    .attention-callout {
      animation: none;
    }
  }

  @media (max-width: 1100px) {
    .convert-guide {
      grid-template-columns: minmax(0, 1fr);
    }

    .convert-guide-steps {
      grid-template-columns: minmax(0, 1fr);
    }

    .generation-banner {
      grid-template-columns: minmax(0, 1fr);
    }

    .generation-banner-actions {
      justify-content: stretch;
    }

    .generation-banner-actions .ant-btn,
    .generation-banner-actions .attention-anchor,
    :deep(.generation-primary-action.ant-btn) {
      width: 100%;
    }

    .generation-action-anchor {
      width: 100%;
    }
  }

  @media (max-width: 1280px) {
    & > .header {
      .header-row-main {
        display: flex;
        justify-content: center;
      }

      .header-actions-left {
        flex: 1 1 100%;
        order: 1;
        justify-content: center;
      }

      .header-actions-center {
        flex: 0 1 auto;
        order: 2;
      }

      .header-actions-right {
        flex: 1 1 100%;
        order: 3;
        justify-content: center;
      }
    }
  }



  .ant-spin-nested-loading {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;



    ::v-deep(.ant-spin-container) {
      height: 100%;

    }

  }



  .content {
    @include flex(flex-start, flex-start);
    height: 100%;
    position: relative;



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

    .manual-mode-banner {
      display: grid;
      gap: 6px;
      margin: 0 0 12px;
      padding: 12px 16px;
      border: 1px solid #d8e6fb;
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #f2f7ff 100%);
      box-shadow: 0 10px 22px rgba(31, 79, 191, 0.06);
    }

    .manual-mode-banner-title {
      font-size: 16px;
      font-weight: 800;
      color: #153b7a;
    }

    .manual-mode-banner-copy {
      font-size: 13px;
      line-height: 1.55;
      color: #526178;
    }

    .manual-sidebar-tip {
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px dashed #cbdaf2;
      border-radius: 10px;
      background: #f8fbff;
      font-size: 13px;
      line-height: 1.55;
      color: #5f6c7f;
    }

    .empty-topic-panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px dashed #cbdaf2;
      border-radius: 10px;
      background: #f8fbff;
      color: #526178;
      font-size: 13px;
      line-height: 1.45;
    }

    .empty-topic-panel p {
      margin: 0;
      text-align: center;
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

      flex-direction: column;

      align-items: stretch;

      gap: 10px;
      min-width: 0;

    }

    .topic-header-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .topic-action-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }



    .topic-edit-btn {

      padding: 0 10px;
      border-radius: 999px;
      background: #f7fbff;
      border: 1px solid #d6e4ff;

    }



    .topic-button {

      display: flex;

      align-items: stretch;

      justify-content: flex-start;

      width: 100%;

      padding: 0;

      border: 1px solid #d6e4ff;

      background: linear-gradient(180deg, #f9fbff 0%, #eef5ff 100%);

      border-radius: 10px;

      font: inherit;

      font-weight: 600;

      color: inherit;

      cursor: pointer;

      text-align: left;
      min-width: 0;

      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;

    }

    .topic-button-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      min-width: 0;
      padding: 12px 14px;
    }

    .topic-label-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1;
    }

    .topic-label {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.35;
    }

    .topic-retry-btn {
      padding: 0 10px;
      margin-left: 0;
      border-radius: 999px;
      background: #f0f5ff;
      border: 1px solid #d6e4ff;
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

      background: linear-gradient(180deg, #f3f8ff 0%, #e7f1ff 100%);
      border-color: #91caff;
      box-shadow: 0 4px 12px rgba(9, 109, 217, 0.08);

    }



    .topic-button.active {

      background: linear-gradient(180deg, #e6f4ff 0%, #d7ebff 100%);

      border-color: #69b1ff;

      color: #2f54eb;

      box-shadow: 0 0 0 1px rgba(47, 84, 235, 0.08), 0 6px 16px rgba(47, 84, 235, 0.12);

    }



    .topic-toggle-icon {

      display: flex;

      align-items: center;
      flex-shrink: 0;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);

    }

    .topic-error-message {
      margin: 0;
      overflow-wrap: anywhere;
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

      border: 1px solid transparent;
      border-left: 4px solid transparent;

      background: var(--subtopic-bg, transparent);

      border-radius: 6px;

      font: inherit;

      text-align: left;

      color: inherit;

      cursor: pointer;

      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;

      display: flex;

      flex-direction: column;

      gap: 4px;

    }



    .subtopic-button:hover {

      border-color: var(--subtopic-border, #d7e3f2);
      border-left-color: var(--subtopic-accent, #2f6ea6);
      box-shadow: 0 0 0 2px var(--subtopic-glow, rgba(47, 110, 166, 0.12));

    }



    .subtopic-button.active {

      background: var(--subtopic-bg, #eef6ff);
      border-color: var(--subtopic-border, #bdd6f2);
      border-left-color: var(--subtopic-accent, #2f6ea6);
      box-shadow: 0 0 0 2px var(--subtopic-glow, rgba(47, 110, 166, 0.2));

      color: #12343b;

    }



    .subtopic-name {

      font-weight: 600;
      overflow-wrap: anywhere;
      word-break: break-word;

    }



    .subtopic-preview {

      font-size: 12px;

      color: #8c8c8c;
      overflow-wrap: anywhere;
      word-break: break-word;

    }



    .designer {

      flex: 1;

      height: 100%;
      min-width: 0;
      transition: margin-right 0.2s ease;



      & > .container {

        height: 100%;
        min-width: 0;

      }

    }

    .sidebar {
      flex: 0 0 auto;
      width: 292px;
      min-width: 260px;
      max-width: 520px;
      padding: 10px;
      gap: 10px;
      border-right-color: #d9e2e6;
      background: #ffffff;
      resize: horizontal;
      overflow: auto;
    }

    .sidebar-header {
      margin-bottom: 0;
    }

    .topic-navigation {
      gap: 4px;
    }

    .topic-node {
      gap: 4px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    .topic-node-header {
      gap: 4px;
    }

    .topic-button {
      border: 1px solid transparent;
      border-left: 3px solid transparent;
      border-radius: 8px;
      background: transparent;
      box-shadow: none;
    }

    .topic-button:hover {
      border-color: #d9e2e6;
      border-left-color: #9fbfc4;
      background: #f5f8f9;
      box-shadow: none;
    }

    .topic-button.active {
      border-color: #b8d7d4;
      border-left-color: #0f766e;
      background: #eaf4f3;
      color: #12343b;
      box-shadow: none;
    }

    .topic-button-main {
      gap: 8px;
      padding: 8px 9px;
    }

    .topic-label {
      font-size: 14px;
      font-weight: 800;
      line-height: 1.3;
    }

    .topic-status-badge {
      margin-left: 2px;
      padding: 0 5px;
      font-size: 10px;
      line-height: 17px;
    }

    .topic-toggle-icon {
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.82);
    }

    .topic-header-footer {
      gap: 4px;
    }

    .topic-action-row {
      gap: 6px;
      padding-left: 12px;
      opacity: 0;
      transition: opacity 0.16s ease;
    }

    .topic-node:hover .topic-action-row,
    .topic-button.active + .topic-header-footer .topic-action-row {
      opacity: 1;
    }

    .topic-edit-btn,
    .topic-retry-btn {
      padding: 0 8px;
      border: 1px solid #d9e2e6;
      background: transparent;
    }

    .subtopic-list {
      gap: 2px;
      margin-left: 12px;
      padding-left: 10px;
      border-left: 1px solid #dce7ea;
    }

    .subtopic-item {
      gap: 2px;
    }

    .subtopic-button {
      padding: 6px 8px;
      border-radius: 7px;
      gap: 2px;
    }

    .subtopic-button:hover {
      background: var(--subtopic-bg, #f5f8f9);
      border-color: var(--subtopic-border, #d7e3f2);
      border-left-color: var(--subtopic-accent, #2f6ea6);
    }

    .subtopic-button.active {
      background: var(--subtopic-bg, #eef6ff);
      color: #12343b;
    }

    .subtopic-name {
      font-size: 13px;
      font-weight: 700;
    }

    .subtopic-preview {
      font-size: 12px;
      line-height: 1.35;
    }

    .agent-preview-panel {
      position: absolute;
      right: 16px;
      bottom: 16px;
      width: clamp(364px, 35vw, 686px);
      height: clamp(224px, 35vh, 434px);
      border: 1px solid #d9d9d9;
      border-radius: 10px;
      background: #fff;
      display: flex;
      flex-direction: column;
      z-index: 20;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
      overflow: hidden;

      &.collapsed {
        width: 224px;
        height: auto;
      }

      &.resizing {
        transition: none;
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
        user-select: none;
      }

      .agent-preview-resize-edge,
      .agent-preview-resize-corner {
        position: absolute;
        padding: 0;
        border: none;
        background: transparent;
        z-index: 3;
      }

      .agent-preview-resize-edge.resize-left {
        top: 0;
        left: 0;
        bottom: 0;
        width: 10px;
        cursor: ew-resize;
      }

      .agent-preview-resize-edge.resize-top {
        top: 0;
        left: 0;
        right: 0;
        height: 10px;
        cursor: ns-resize;
      }

      .agent-preview-resize-corner {
        top: 0;
        left: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;

        &::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-top: 2px solid rgba(23, 87, 143, 0.35);
          border-left: 2px solid rgba(23, 87, 143, 0.35);
          border-top-left-radius: 8px;
        }
      }

      .agent-preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px 8px;
        padding: 8px 10px;
        border-bottom: 1px solid #f0f0f0;
        background: #fff;

        .title {
          font-weight: 600;
          color: #1f1f1f;
          margin-right: auto;
        }

        .agent-switcher {
          display: inline-flex;
          align-items: center;
          gap: 6px;

          :deep(.ant-btn) {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding-inline: 8px;
          }

          .agent-chip-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.08);
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
          }
        }

        :deep(.ant-space) {
          display: inline-flex;
          flex-wrap: wrap;
          row-gap: 6px;
        }
      }

      .agent-preview-body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .agent-preview-url {
        padding: 4px 10px;
        border-bottom: 1px solid #f5f5f5;
        color: #8c8c8c;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .agent-preview-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-bottom: 1px solid #f0f0f0;
        color: #8c8c8c;
        font-size: 12px;
        background: #fafafa;

        &.loading {
          color: #1677ff;
          background: #f0f7ff;
        }
      }

      .agent-preview-frame {
        flex: 1;
        min-height: 0;
        width: 100%;
        border: none;
        background: #fafafa;
      }

      .agent-preview-error {
        border-top: 1px solid #f0f0f0;
        padding: 8px 10px;
        background: #fff7e6;

        .error-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #ad6800;
          font-size: 13px;
        }

        .error-details {
          margin: 8px 0 0;
          max-height: 160px;
          overflow: auto;
          padding: 8px;
          background: #fff;
          border: 1px solid #ffe7ba;
          border-radius: 4px;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 12px;
        }
      }
    }

    @media (max-width: 1400px) {
      .agent-preview-panel {
        width: clamp(322px, 38vw, 630px);
        height: clamp(210px, 34vh, 392px);
      }
    }

    @media (max-width: 1100px) {
      .agent-preview-panel {
        right: 12px;
        bottom: 12px;
        width: calc(100% - 24px);
        height: min(46vh, 440px);

        &.collapsed {
          width: min(224px, calc(100% - 24px));
        }
      }
    }

  }

}

.user-modal-desc {

  margin-bottom: 12px;

  color: #595959;

}

.user-modal-footer {

  display: flex;

  justify-content: flex-end;

  gap: 8px;

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



