import type { Cell } from '@antv/x6'
import { sanitizeMenuTitle } from './menuText'
import { compareFlowOrder, hasFlowOrder } from './flowOrder'

type StageMenuEntry = {
  title?: string
  nextStage?: string
  next_state?: string
}

type StageCell = Cell.Properties & {
  id?: string
  children?: Array<string | { id?: string }>
  data?: {
    name?: string
    agent?: string
    flowOrder?: string
    isTopicStart?: boolean
    menus?: StageMenuEntry[]
  }
}

type EdgeCell = Cell.Properties & {
  source?: {
    cell?: string | { id?: string }
  }
  target?: {
    cell?: string | { id?: string }
  }
}

export interface TopicScriptBuildResult {
  topicName: string
  script: string
  startState: string | null
  orderedStates: string[]
}

const toCellId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') {
      return id
    }
  }
  return ''
}

const normalizeStateName = (value: unknown, fallback: string) => {
  const next = typeof value === 'string' ? value.trim() : ''
  return next.length ? next : fallback
}

const normalizeMenuTitle = (value: unknown, fallbackIndex: number) => {
  const next = sanitizeMenuTitle(value, '')
  return next.length ? next : `option_${fallbackIndex + 1}`
}

const flattenScriptText = (value: unknown, fallback = '') => {
  const next = typeof value === 'string' ? value.replace(/\r?\n+/g, ' ').trim() : ''
  return next.length ? next : fallback
}

const resolveNextState = (
  stageIdByName: Map<string, string>,
  edges: EdgeCell[],
  stage: StageCell,
  menu: StageMenuEntry,
  menuIndex: number,
) => {
  const child = stage.children?.[menuIndex]
  const optionCellId = toCellId(child)

  if (optionCellId) {
    const edge = edges.find((entry) => toCellId(entry.source?.cell) === optionCellId)
    const targetCellId = toCellId(edge?.target?.cell)
    if (targetCellId) {
      return stageIdByName.get(targetCellId) ?? targetCellId
    }
  }

  if (typeof menu.nextStage === 'string' && menu.nextStage.length > 0) {
    return stageIdByName.get(menu.nextStage) ?? menu.nextStage
  }

  if (typeof menu.next_state === 'string' && menu.next_state.length > 0) {
    return stageIdByName.get(menu.next_state) ?? menu.next_state
  }

  return ''
}

const sortStagesForExport = (stages: StageCell[]) =>
  [...stages].sort((a, b) => {
    const flowOrderComparison = compareFlowOrder(a.data?.flowOrder, b.data?.flowOrder)
    if (flowOrderComparison !== 0) return flowOrderComparison
    const ay = typeof a.position?.y === 'number' ? a.position.y : 0
    const by = typeof b.position?.y === 'number' ? b.position.y : 0
    if (ay !== by) return ay - by
    const ax = typeof a.position?.x === 'number' ? a.position.x : 0
    const bx = typeof b.position?.x === 'number' ? b.position.x : 0
    return ax - bx
  })

const isExplicitStartStateName = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase()
  return (
    normalized === 'start' ||
    normalized === 'conversation_start' ||
    normalized.startsWith('start_') ||
    normalized.startsWith('conversation_start_')
  )
}

const resolveStartStateName = (
  orderedStages: StageCell[],
  edges: EdgeCell[],
  stageIdToName: Map<string, string>,
) => {
  const explicitFlagStart = orderedStages.find((stage) => Boolean(stage.data?.isTopicStart))
  if (explicitFlagStart) {
    return stageIdToName.get(toCellId(explicitFlagStart.id)) ?? null
  }

  const explicitStart = orderedStages.find((stage) => {
    const stageId = toCellId(stage.id)
    const stageName = stageIdToName.get(stageId) ?? ''
    return isExplicitStartStateName(stageName)
  })
  if (explicitStart) {
    return stageIdToName.get(toCellId(explicitStart.id)) ?? null
  }

  const stageIds = new Set(orderedStages.map((stage) => toCellId(stage.id)).filter((id) => id.length > 0))
  const incomingCounts = new Map<string, number>()
  stageIds.forEach((id) => incomingCounts.set(id, 0))

  edges.forEach((edge) => {
    const targetCellId = toCellId(edge.target?.cell)
    if (!stageIds.has(targetCellId)) {
      return
    }
    incomingCounts.set(targetCellId, (incomingCounts.get(targetCellId) || 0) + 1)
  })

  const rootStage = orderedStages.find((stage) => {
    const stageId = toCellId(stage.id)
    return stageId.length > 0 && (incomingCounts.get(stageId) || 0) === 0
  })
  if (rootStage) {
    return stageIdToName.get(toCellId(rootStage.id)) ?? null
  }

  const firstStage = orderedStages[0]
  return firstStage ? stageIdToName.get(toCellId(firstStage.id)) ?? null : null
}

const buildTraversalOrder = (
  orderedStages: StageCell[],
  edges: EdgeCell[],
  stageIdToName: Map<string, string>,
  startStateName: string | null,
) => {
  const orderedStateNames = orderedStages.map((stage, index) => {
    const stageId = toCellId(stage.id)
    return (
      stageIdToName.get(stageId) ??
      normalizeStateName(stage.data?.name, `state_${index + 1}`)
    )
  })
  const allStatesHaveFlowOrder =
    orderedStages.length > 0 &&
    orderedStages.every((stage) => hasFlowOrder(stage.data?.flowOrder))
  if (allStatesHaveFlowOrder) {
    return orderedStateNames
  }

  const stateSet = new Set(orderedStateNames)
  const adjacency = new Map<string, string[]>()

  orderedStages.forEach((stage, stageIndex) => {
    const stageId = toCellId(stage.id)
    const stateName =
      stageIdToName.get(stageId) ??
      normalizeStateName(stage.data?.name, `state_${stageIndex + 1}`)
    const menus = Array.isArray(stage.data?.menus) ? stage.data.menus : []
    const nextStates = menus.reduce((acc: string[], menu: StageMenuEntry, menuIndex: number) => {
      const nextState = resolveNextState(stageIdToName, edges, stage, menu, menuIndex)
      if (nextState && stateSet.has(nextState) && !acc.includes(nextState)) {
        acc.push(nextState)
      }
      return acc
    }, [] as string[])
    adjacency.set(stateName, nextStates)
  })

  const visited = new Set<string>()
  const result: string[] = []

  const visit = (stateName: string) => {
    if (!stateName || visited.has(stateName) || !stateSet.has(stateName)) {
      return
    }
    visited.add(stateName)
    result.push(stateName)
    ;(adjacency.get(stateName) ?? []).forEach((nextState) => visit(nextState))
  }

  if (startStateName) {
    visit(startStateName)
  }
  orderedStateNames.forEach((stateName) => visit(stateName))

  return result
}

export const sanitizeTopicName = (topicName: string) => {
  const raw = (topicName || '').trim()
  const replaced = raw.replace(/[<>:"/\\|?*]/g, '_').replace(/\p{Cc}/gu, '_').replace(/\s+/g, '_')
  const collapsed = replaced.replace(/_+/g, '_').replace(/[. ]+$/g, '')
  return collapsed || 'untitled-topic'
}

export const buildTopicScriptFromCells = (
  topicName: string,
  cells: Cell.Properties[],
): TopicScriptBuildResult => {
  const stageCells = cells.filter((entry) => entry.shape === 'stage-node') as StageCell[]
  const edgeCells = cells.filter((entry) => entry.shape === 'edge') as EdgeCell[]

  const orderedStages = sortStagesForExport(stageCells)
  const stageIdToName = new Map<string, string>()
  orderedStages.forEach((stage, index) => {
    const stageId = toCellId(stage.id)
    if (!stageId) return
    const fallbackName = `state_${index + 1}`
    stageIdToName.set(stageId, normalizeStateName(stage.data?.name, fallbackName))
  })

  const startStateName = resolveStartStateName(orderedStages, edgeCells, stageIdToName)
  const orderedStateNames = buildTraversalOrder(
    orderedStages,
    edgeCells,
    stageIdToName,
    startStateName,
  )
  const stateNameSet = new Set(orderedStateNames)
  const stageByStateName = new Map(
    orderedStages.map((stage, index) => {
      const stageId = toCellId(stage.id)
      const stageName =
        stageIdToName.get(stageId) ??
        normalizeStateName(stage.data?.name, `state_${index + 1}`)
      return [stageName, stage] as const
    }),
  )
  const explicitEndState = orderedStateNames.find(
    (stateName) => stateName.toLowerCase() === 'end_conversation',
  )
  const fallbackTargetState =
    explicitEndState || orderedStateNames[orderedStateNames.length - 1] || 'end_conversation'

  const sections: string[] = []
  sections.push('')
  sections.push(`//${topicName}`)

  orderedStateNames.forEach((stateName, stageIndex) => {
    const stage = stageByStateName.get(stateName)
    if (!stage) {
      return
    }
    const agentLine = flattenScriptText(stage.data?.agent, '...')
    const isTerminalStage =
      stateName.toLowerCase() === 'end_conversation' || stageIndex === orderedStages.length - 1

    sections.push(`STATE: ${stateName}`)
    sections.push(`AGENT: ${agentLine}`)

    const menus = Array.isArray(stage.data?.menus) ? stage.data?.menus : []
    const menuLines: string[] = []
    let validMenuCount = 0
    menus.forEach((menu: StageMenuEntry, menuIndex: number) => {
      const title = flattenScriptText(normalizeMenuTitle(menu?.title, menuIndex), `option_${menuIndex + 1}`)
      if (!title) {
        return
      }

      let nextState = flattenScriptText(
        resolveNextState(stageIdToName, edgeCells, stage, menu, menuIndex),
      )

      if (!nextState || !stateNameSet.has(nextState)) {
        nextState = fallbackTargetState
      }

      menuLines.push(`${title} => ${nextState}`)
      validMenuCount += 1
    })

    if (validMenuCount > 0) {
      sections.push('USERMENU:')
      menuLines.forEach((line) => sections.push(line))
    } else if (isTerminalStage) {
      sections.push('ACTION: $POP();$')
    } else {
      sections.push('USERMENU:')
      const defaultTarget = stateNameSet.has(fallbackTargetState) ? fallbackTargetState : stateName
      sections.push(`Continue => ${defaultTarget}`)
    }
    sections.push('')
  })

  return {
    topicName,
    script: sections.join('\r\n'),
    startState: startStateName,
    orderedStates: orderedStateNames,
  }
}
