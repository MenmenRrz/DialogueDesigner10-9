<template>
  <a-popover v-model:open="editorOpen" trigger="click" placement="rightTop" overlay-class-name="jump-node-popover">
    <template #content>
      <div class="jump-editor">
        <div class="jump-editor-title">Cross-topic jump</div>
        <div class="jump-editor-desc">
          User options can connect to this jump node. It will send the conversation to the
          selected topic and state.
        </div>
        <div class="jump-field">
          <div class="jump-label">Target Topic</div>
          <a-select
            :value="targetTopic"
            :options="topicOptions"
            placeholder="Select a topic"
            @update:value="onUpdateTargetTopic"
          />
        </div>
        <div v-if="!isEndConversationTarget(targetTopic)" class="jump-field">
          <div class="jump-label">Target State</div>
          <a-select
            :value="targetState"
            :options="stateOptions"
            placeholder="Use topic start state"
            @update:value="onUpdateTargetState"
          />
        </div>
      </div>
    </template>
    <button type="button" class="jump-node" :class="{ 'is-managed': routeManaged, 'is-related': relationActive, 'is-dim': relationDim }">
      <span class="jump-kicker">{{ routeManaged ? 'Route Jump' : 'Jump State' }}</span>
      <span class="jump-topic">{{ targetTopicDisplay }}</span>
      <span class="jump-state">{{ targetStateDisplay }}</span>
    </button>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignerStore } from '@/stores/designer'
import { buildTopicScriptFromCells } from '@/utils/topicScript'
import {
  END_CONVERSATION_TARGET,
  isEndConversationTarget,
  stripCrossTopicArtifacts,
} from '@/utils/crossTopicJumps'
import { normalizeTopicRouting } from '@/utils/topicRouting'

const props = defineProps<{
  node?: any
  graph?: any
}>()

const designerStore = useDesignerStore()
const {
  updateTopicRoutingNextTopics,
} = designerStore
const { sessionTopics, topicGraph, api1Result } = storeToRefs(designerStore)

const getNode: any = inject('getNode')
const nodeRef = ref<any>(props.node ?? null)
const editorOpen = ref(false)
const targetTopic = ref('')
const targetState = ref('')
const relationActive = ref(false)
const relationDim = ref(false)
const routeManaged = ref(false)
const sourceTopic = ref('')
const routeTargetIndex = ref(-1)

const resolveNode = () => {
  if (nodeRef.value) {
    return nodeRef.value
  }
  nodeRef.value = props.node ?? (typeof getNode === 'function' ? getNode() : getNode)
  return nodeRef.value
}

const formatDisplayLabel = (value: string, fallback = 'Select Topic') => {
  const normalized = String(value || '')
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

const topicOptions = computed(() =>
  [
    {
      label: 'End Conversation',
      value: END_CONVERSATION_TARGET,
    },
    ...sessionTopics.value
      .flatMap((session) => session.topics.map((topic) => topic.topicName))
      .reduce((acc, topicName) => {
        if (
          sourceTopic.value &&
          topicName.trim().toLocaleLowerCase() === sourceTopic.value.trim().toLocaleLowerCase()
        ) {
          return acc
        }
        if (acc.some((entry) => entry.value === topicName)) {
          return acc
        }
        acc.push({
          label: formatDisplayLabel(topicName),
          value: topicName,
        })
        return acc
      }, [] as Array<{ label: string; value: string }>),
  ],
)

const getTopicScriptBuild = (topicName: string) => {
  if (isEndConversationTarget(topicName)) {
    return null
  }
  const cells = topicGraph.value.get(topicName)
  if (!Array.isArray(cells) || !cells.length) {
    return null
  }

  try {
    return buildTopicScriptFromCells(topicName, stripCrossTopicArtifacts(cells))
  } catch {
    return null
  }
}

const stateOptions = computed(() => {
  if (!targetTopic.value || isEndConversationTarget(targetTopic.value)) {
    return []
  }

  const script = getTopicScriptBuild(targetTopic.value)
  const orderedStates = script?.orderedStates ?? []
  const startState = script?.startState ?? ''

  return [
    {
      label: startState ? `Topic start (${startState})` : 'Topic start',
      value: '',
    },
    ...orderedStates.map((stateName) => ({
      label: stateName,
      value: stateName,
    })),
  ]
})

const targetTopicDisplay = computed(() =>
  isEndConversationTarget(targetTopic.value)
    ? 'End Conversation'
    : formatDisplayLabel(targetTopic.value, 'Select Topic'),
)

const targetStateDisplay = computed(() => {
  if (isEndConversationTarget(targetTopic.value)) {
    return 'Action: POP()'
  }
  if (targetState.value) {
    return targetState.value
  }
  const script = targetTopic.value ? getTopicScriptBuild(targetTopic.value) : null
  return script?.startState ? `Start: ${script.startState}` : 'Default to topic start'
})

const syncNodeData = () => {
  const node = resolveNode()
  if (!node) {
    return
  }

  const current = node.getData?.() ?? node.data ?? {}
  node.setData({
      ...current,
      targetTopic: targetTopic.value,
      targetState: targetState.value,
      sourceTopic: sourceTopic.value,
      routeTargetIndex: routeTargetIndex.value,
    })
  if (node.data) {
    node.data.targetTopic = targetTopic.value
    node.data.targetState = targetState.value
    node.data.sourceTopic = sourceTopic.value
    node.data.routeTargetIndex = routeTargetIndex.value
  }
}

const syncManagedRouteTarget = (nextTopic: string) => {
  if (!routeManaged.value || !sourceTopic.value) {
    return
  }

  if (isEndConversationTarget(nextTopic)) {
    updateTopicRoutingNextTopics(sourceTopic.value, [])
    return
  }

  const orderedTopicNames = sessionTopics.value.flatMap((session) =>
    session.topics.map((topic) => topic.topicName),
  )
  const routing = normalizeTopicRouting(api1Result.value?.topic_routing ?? null, orderedTopicNames)
  const route = routing.routes.find(
    (entry) =>
      entry.topicName.trim().toLocaleLowerCase() === sourceTopic.value.trim().toLocaleLowerCase(),
  )
  if (!route) {
    return
  }

  const nextTargets = [...route.nextTopics]
  const targetIndex = Number.isFinite(routeTargetIndex.value) ? routeTargetIndex.value : -1
  if (targetIndex < 0) {
    return
  }

  nextTargets[targetIndex] = nextTopic
  updateTopicRoutingNextTopics(sourceTopic.value, nextTargets.filter((entry) => entry.trim().length > 0))
}

const onUpdateTargetTopic = (value: string) => {
  const nextTopic = String(value || '')
  targetTopic.value = nextTopic
  targetState.value = ''
  syncManagedRouteTarget(nextTopic)
  syncNodeData()
}

const onUpdateTargetState = (value: string) => {
  targetState.value = String(value || '')
  syncNodeData()
}

watch(
  () => props.node,
  (val) => {
    if (val) {
      nodeRef.value = val
    }
  },
)

const applyNodeState = (current: any) => {
  targetTopic.value = String(current?.targetTopic || '')
  targetState.value = String(current?.targetState || '')
  relationActive.value = Boolean(current?.relationActive)
  relationDim.value = Boolean(current?.relationDim)
  routeManaged.value = Boolean(current?.routeManaged)
  sourceTopic.value = String(current?.sourceTopic || '')
  routeTargetIndex.value = Number(current?.routeTargetIndex ?? -1)
}

const node = resolveNode()
applyNodeState(node?.data ?? {})

node?.on?.('change:data', ({ current }: any) => {
  applyNodeState(current)
})
</script>

<style lang="scss" scoped>
.jump-node {
  width: 100%;
  height: 100%;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #e8b26c;
  border-left: 5px solid #c77816;
  border-radius: 10px;
  background: linear-gradient(180deg, #fff8ef 0%, #fff2de 100%);
  text-align: left;
  cursor: pointer;
  transition: opacity 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &.is-managed {
    border-color: #e39b3d;
    box-shadow: 0 6px 14px rgba(199, 120, 22, 0.14);
  }

  &.is-related {
    box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.28);
  }

  &.is-dim {
    opacity: 0.35;
  }
}

.jump-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a5518;
}

.jump-topic {
  font-size: 14px;
  font-weight: 700;
  color: #6d3f0f;
}

.jump-state {
  font-size: 12px;
  line-height: 1.4;
  color: #8a6a43;
}

.jump-editor {
  width: 320px;
}

.jump-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f1f1f;
}

.jump-editor-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #5e6a78;
}

.jump-field {
  margin-top: 12px;
  display: grid;
  gap: 6px;
}

.jump-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #68768b;
}
</style>
