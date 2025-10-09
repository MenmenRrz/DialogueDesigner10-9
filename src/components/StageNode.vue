<template>
  <div class="stage-node">
    <h3 class="name" v-if="status === 'view'" @dblclick="onEdit()">{{ name }}</h3>
    <a-input
      style="height: 20px; margin: 16.38px 0"
      v-model:value="name"
      v-if="status === 'edit'"
      @pressEnter="onEditOk()"
      @blur="onEditOk()"
    />
    <a-textarea class="agent" v-model:value="agent" />
    <a-button type="primary" class="btn-suggest" @click="onSuggest()">suggest options</a-button>
    <ul class="menus">
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
        :icon="h(PlusOutlined)"
        @click="onAddOption('new-option', 'edit')"
      />
    </a-tooltip>
  </div>
  <a-modal
    v-if="isModalHost"
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
      @click="querySuggestOptions"
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
import { computed, inject, onMounted, ref, h, watch } from 'vue'
import { PlusOutlined, MinusCircleTwoTone } from '@ant-design/icons-vue'
import { useDesignerStore } from '@/stores/designer'
import { storeToRefs } from 'pinia'
import { v4 as uuidV4 } from 'uuid'
import type { Cell } from '@antv/x6'

type MenuItem = {
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

const NEW_STATE_PREFIX = '__new__:'

const props = defineProps<{
  node?: any
  graph?: any
}>()

const designerStore = useDesignerStore()
const {
  graph,
  newOptionModalShow,
  mentorDirections,
  newSuggestOptions,
  newSuggestOptionAgents,
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
  setQuerySuggestOptionStageId,
  updateSelectedGraphTopic,
} = designerStore

const name = ref('')
const agent = ref('')
const list = ref<MenuItem[]>([])
const status = ref<'view' | 'edit'>('view')
const suggestionForms = ref<SuggestionFormEntry[]>([])

const nodeRef = ref<any>(props.node ?? null)

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


const getNode = inject<any>('getNode')

watch(
  () => props.node,
  (val) => {
    if (val) {
      nodeRef.value = val
    }
  },
)

const normalizeMenus = (menus: unknown): MenuItem[] => {
  if (!Array.isArray(menus)) {
    return []
  }

  return (menus as any[]).map((entry) => ({
    title: (entry?.title ?? '').toString(),
    status: (entry?.status ?? 'view').toString(),
    nextStage: entry?.nextStage
      ? entry.nextStage.toString()
      : entry?.next_state?.toString?.() ?? '',
  }))
}

const syncNodeMenus = (node: any, menus: MenuItem[]) => {
  node.setData({
    ...node.getData(),
    menus: menus.map((entry) => ({ ...entry })),
  })
}

const stripWrappingQuotes = (value: string) => value.replace(/^['"]+/, '').replace(/['"]+$/, '')

const parseSuggestion = (raw: string): ParsedSuggestion => {
  const [optionPart, nextPart = ''] = raw
    .split(/=>|->/, 2)
    .map((segment) => segment.trim())
  return {
    raw,
    option: optionPart,
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

const onEditOk = () => {
  status.value = 'view'
  const node = resolveNode()
  node.setData({
    ...node.getData(),
    name: name.value,
  })
  node.data.name = name.value
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
    size: { width: 300, height: 329 },
    data: {
      name,
      agent: agentText,
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
    connector: 'smooth',
    attrs: {
      line: {
        stroke: '#000',
        strokeWidth: 0.8,
      },
    },
  })
}

const onDel = (index: number) => {
  const node = resolveNode()
  list.value.splice(index, 1)

  node.children.slice(index + 1).forEach((item: any) => {
    const { x, y } = item.getPosition()
    item.position(x, y - 38.5)
  })

  node.removeChild(node.children[index])
  syncNodeMenus(node, list.value)
}

const genOptionNode = (node: any, title: string, status: string, nextStage?: string) => {
  const { x, y } = node.getPosition()
  return {
    shape: 'option-node',
    x: x + 35,
    y: y + 305 + (node.children ? node.children.length * 38.5 : 0),
    width: 258,
    height: 36,
    label: title,
    zIndex: 10,
    data: {
      title,
      status,
      nextStage,
    },
    ports: [{ id: uuidV4(), group: 'right' }],
  }
}

const onAddOption = (title: string, optionStatus: string) => {
  const node: Cell<Cell.Properties> =
    (querySuggestOptionStageId.value
      ? graph.value?.getCellById(querySuggestOptionStageId.value!)
      : resolveNode())!
  const menu: MenuItem = { title, status: optionStatus }
  list.value = [...list.value, menu]
  syncNodeMenus(node, list.value)

  const optionNode = graph.value!.addNode(genOptionNode(node, title, optionStatus))
  node.addChild(optionNode)
}

const onSuggest = () => {
  updateSelectedGraphTopic()
  const node = resolveNode()
  setQuerySuggestOptionStageId(node.id)
  updateMentorDirections('')
  setNewSuggestOptions([])
  setNewSuggestOptionAgents({})
  suggestionForms.value = []
  setQuerySuggestOptionStageName(name.value)
  setNewOptionModalShow(true)
}

const closeSuggestionModal = () => {
  setNewOptionModalShow(false)
  setQuerySuggestOptionStageId(null)
  setNewSuggestOptionAgents({})
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
  const nextMenus = [...normalizeMenus(node.data?.menus ?? [])]
  const suggestedAgents = newSuggestOptionAgents.value || {}

  selections.forEach((entry) => {
    const menu: MenuItem = {
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
          const agentText = (suggestedAgents[normalized] || '').toString()
          targetNode = createStageNode(normalized, node, newStageCache.size, agentText)
          if (targetNode) {
            newStageCache.set(normalized, targetNode)
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
      genOptionNode(node, menu.title, 'view', menu.nextStage),
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
  updateSelectedGraphTopic()
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
    const agentText = newSuggestOptionAgents.value?.[normalized]
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

onMounted(() => {
  const node = resolveNode()
  name.value = node.data.name
  agent.value = node.data.agent
  list.value = normalizeMenus(node.data.menus)

  node.on('change:data', ({ current }: any) => {
    list.value = normalizeMenus(current.menus)
  })
})
</script>

<style lang="scss" scoped>
.stage-node {
  width: 300px;
  min-height: 90px;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 5px;
  background: #fff;

  & > .name {
    height: 20px;
    text-align: center;
  }

  & > .agent {
    height: 200px;
  }

  & > .btn-suggest {
    margin: 5px 0;
  }

  & > .menus {
    list-style: none;
    margin: 0;
    padding: 0;

    & > .menu-item {
      display: flex;
      align-items: center;
      height: 36px;
      padding: 5px;
      margin: 3px 0;
      border-radius: 3px;

      & > .icon-del {
        cursor: pointer;
        margin-right: 5px;
      }
    }
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
</style>















