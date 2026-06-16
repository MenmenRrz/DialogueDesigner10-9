<template>
  <div class="option-node" :class="{ 'is-related': relationActive, 'is-dim': relationDim }">
    <span class="name" v-if="status === 'view'" :title="title" @dblclick="onEditOptionName()">{{
      title
    }}</span>
    <a-input
      v-model:value="title"
      v-if="status === 'edit'"
      :placeholder="optionPlaceholder"
      @pressEnter="onEditOk()"
      @blur="onEditOk()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { sanitizeMenuTitle } from '@/utils/menuText'
import { useDesignerStore } from '@/stores/designer'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  node?: any
  graph?: any
}>()

const title = ref('')
const status = ref('')
const relationActive = ref(false)
const relationDim = ref(false)
const editBaseline = ref<string | null>(null)
const editStartedAt = ref<number | null>(null)
const editTimer = ref<number | null>(null)

const designerStore = useDesignerStore()
const { topicGraphSelected, authoringMode } = storeToRefs(designerStore)
const { recordAnalyticsEvent, updateSelectedGraphTopic } = designerStore
const isManualAuthoringMode = computed(() => authoringMode.value === 'manual')
const optionPlaceholder = computed(() =>
  isManualAuthoringMode.value
    ? 'e.g. I want to know more about the test.'
    : 'Option text',
)

const getNode: any = inject('getNode')
const nodeRef = ref<any>(props.node ?? null)

const resolveNode = () => {
  if (nodeRef.value) {
    return nodeRef.value
  }
  nodeRef.value = props.node ?? (typeof getNode === 'function' ? getNode() : getNode)
  return nodeRef.value
}

watch(
  () => props.node,
  (val) => {
    if (val) {
      nodeRef.value = val
    }
  },
)

const onEditOptionName = () => {
  status.value = 'edit'
  if (editBaseline.value === null) {
    editBaseline.value = title.value
    editStartedAt.value = Date.now()
  }
}

const clearEditTimer = () => {
  if (typeof window === 'undefined' || editTimer.value === null) {
    return
  }
  window.clearTimeout(editTimer.value)
  editTimer.value = null
}

const flushOptionEditCommit = () => {
  clearEditTimer()
  const baseline = editBaseline.value
  const startedAt = editStartedAt.value
  const currentValue = title.value
  if (baseline === null || startedAt === null || baseline === currentValue) {
    editBaseline.value = null
    editStartedAt.value = null
    return
  }
  const node = resolveNode()
  const parent = node?.getParent?.()
  const parentStateName = (parent?.getData?.()?.name ?? parent?.data?.name ?? '').toString().trim()
  recordAnalyticsEvent('manual_text_edit_commit', 'manual', {
    topicName: (topicGraphSelected.value || '').trim(),
    stateName: parentStateName,
    field: 'option',
    durationMs: Math.max(0, Date.now() - startedAt),
    beforeLength: baseline.length,
    afterLength: currentValue.length,
    charDelta: currentValue.length - baseline.length,
    meta: {
      optionId: (node?.id || '').toString(),
    },
  })
  editBaseline.value = null
  editStartedAt.value = null
}

const onEditOk = () => {
  flushOptionEditCommit()
  status.value = 'view'
  const node = resolveNode()
  const nextTitle = sanitizeMenuTitle(title.value, 'new-option')
  title.value = nextTitle
  const currentData = node.getData?.() ?? node.data ?? {}
  const nextData = {
    ...currentData,
    title: nextTitle,
    status: 'view',
  }
  node.setData(nextData)
  if (node.data) {
    node.data = nextData
  }
  if (typeof node.setProp === 'function') {
    node.setProp('label', nextTitle)
  } else if (typeof node.prop === 'function') {
    node.prop('label', nextTitle)
  }

  const parent = node.getParent?.()
  if (parent) {
    const parentData = parent.getData?.() ?? parent.data ?? {}
    const parentMenus = Array.isArray(parentData?.menus) ? parentData.menus : []
    const nextMenus = parentMenus.map((entry: any) =>
      String(entry?.id ?? '') === String(node?.id ?? '')
        ? {
            ...entry,
            title: nextTitle,
            status: 'view',
          }
        : entry,
    )
    const nextParentData = {
      ...parentData,
      menus: nextMenus,
    }
    parent.setData?.(nextParentData)
    if (parent.data) {
      parent.data = nextParentData
    }
  }

  void nextTick(() => {
    updateSelectedGraphTopic()
  })
}

onMounted(() => {
  const node = resolveNode()
  status.value = node.data.status
  const rawTitle = (node.data?.title ?? '').toString()
  const normalizedTitle =
    status.value === 'edit' && (!rawTitle.trim() || rawTitle.trim() === 'new-option')
      ? ''
      : sanitizeMenuTitle(rawTitle, 'new-option')
  title.value = normalizedTitle
  relationActive.value = Boolean(node.data?.relationActive)
  relationDim.value = Boolean(node.data?.relationDim)
  if (status.value !== 'edit' && normalizedTitle !== node.data.title) {
    node.setData({
      ...node.getData?.(),
      title: normalizedTitle,
    })
  }

  node.on('change:data', ({ current }: any) => {
    status.value = (current?.status || 'view').toString()
    const rawCurrentTitle = (current?.title ?? '').toString()
    title.value =
      status.value === 'edit' && (!rawCurrentTitle.trim() || rawCurrentTitle.trim() === 'new-option')
        ? ''
        : sanitizeMenuTitle(rawCurrentTitle, 'new-option')
    relationActive.value = Boolean(current?.relationActive)
    relationDim.value = Boolean(current?.relationDim)
  })
})

watch(title, () => {
  if (status.value !== 'edit') {
    return
  }
  if (editBaseline.value === null) {
    editBaseline.value = title.value
    editStartedAt.value = Date.now()
  }
  if (typeof window !== 'undefined') {
    clearEditTimer()
    editTimer.value = window.setTimeout(() => {
      editTimer.value = null
      flushOptionEditCommit()
    }, 2200)
  }
})

onBeforeUnmount(() => {
  flushOptionEditCommit()
  clearEditTimer()
})
</script>

<style lang="scss" scoped>
.option-node {
  display: flex;
  align-items: center;
  width: 244px;
  max-width: 244px;
  min-width: 0;
  height: calc(100% - 4px);
  margin: 2px 0;
  padding: 5px 30px 5px 10px;
  background: #4096ff;
  border-radius: 4px;
  box-sizing: border-box;
  transition: opacity 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;

  &.is-related {
    box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.3);
  }

  &.is-dim {
    opacity: 0.35;
  }

  & > .name {
    color: #fff;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    width: 100%;
    max-height: 34px;
    font-size: 13px;
    font-weight: 650;
    line-height: 17px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  :deep(.ant-input) {
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 3px 7px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 20px;
  }
}
</style>
