import type { Cell } from '@antv/x6'
import { formatGeneticCounseling, type StageNode } from './formatGeneticCounseling'
import { buildTopicScriptFromCells, sanitizeTopicName } from './topicScript'
import {
  getJumpNodeTargetState,
  getJumpNodeTargetTopic,
  isEndConversationTarget,
  isCrossTopicOptionCell,
  isJumpNodeCell,
  stripCrossTopicArtifacts,
} from './crossTopicJumps'
import {
  buildDefaultTopicChoiceLabel,
  createDefaultTopicRouting,
  getTopicRouteLookup,
  type TopicRoutingPlan,
} from './topicRouting'

type StageCell = Cell.Properties & {
  data?: {
    name?: string
    subtopic?: string
    miTechnique?: string
  }
}

type ConversationTopicSource = {
  topicName: string
  cells: Cell.Properties[]
}

type ConversationStage = StageNode & {
  stateName: string
}

type OptionCell = Cell.Properties & {
  data?: {
    title?: string
    crossTopic?: boolean
  }
}

type JumpCell = Cell.Properties & {
  data?: {
    targetTopic?: string
    targetState?: string
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

type FullTopicCellLookups = {
  stageByStateName: Map<string, StageCell>
  optionById: Map<string, OptionCell>
  jumpById: Map<string, JumpCell>
  outgoingEdges: Map<string, EdgeCell[]>
}

export interface ConversationTopicStateRef {
  topicName: string
  startState: string | null
  endState: string | null
}

export interface ConversationScriptBuildResult {
  topicName: string
  script: string
  startState: string | null
  topicRefs: Map<string, ConversationTopicStateRef>
  routing: TopicRoutingPlan
}

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

const resolveParsedStages = (topicName: string, script: string) => {
  const parsed = formatGeneticCounseling(script)
  const exact = parsed.topics.get(topicName)
  if (exact?.length) {
    return exact
  }

  if (parsed.topics.size === 1) {
    const onlyTopic = parsed.topics.values().next().value as StageNode[] | undefined
    if (onlyTopic?.length) {
      return onlyTopic
    }
  }

  return []
}

const buildStageMetadataMap = (cells: Cell.Properties[]) => {
  const entries = (cells.filter((entry) => entry.shape === 'stage-node') as StageCell[]).map((entry) => {
    const stateName =
      typeof entry.data?.name === 'string' && entry.data.name.trim().length
        ? entry.data.name.trim()
        : typeof entry.id === 'string'
          ? entry.id.trim()
          : ''

    return [
      normalizeTopicKey(stateName),
      {
        subtopic: typeof entry.data?.subtopic === 'string' ? entry.data.subtopic.trim() : '',
        miTechnique: typeof entry.data?.miTechnique === 'string' ? entry.data.miTechnique.trim() : '',
      },
    ] as const
  })

  return new Map(entries.filter(([stateName]) => stateName.length > 0))
}

const buildTopicPrefix = (topicName: string, topicIndex: number) =>
  `topic_${topicIndex + 1}_${sanitizeTopicName(topicName)}`

const buildPrefixedStateName = (topicName: string, topicIndex: number, stateName: string) =>
  `${buildTopicPrefix(topicName, topicIndex)}__${sanitizeTopicName(stateName)}`

const buildOrderedStagesForTopic = (source: ConversationTopicSource) => {
  const localCells = stripCrossTopicArtifacts(source.cells)
  const scriptResult = buildTopicScriptFromCells(source.topicName, localCells)
  const parsedStages = resolveParsedStages(source.topicName, scriptResult.script)
  if (!parsedStages.length) {
    throw new Error(`Unable to parse states for topic "${source.topicName}".`)
  }

  const stageMetadata = buildStageMetadataMap(localCells)
  const parsedByState = new Map(
    parsedStages.map((stage) => [normalizeTopicKey(stage.stageName), stage] as const),
  )

  const orderedStages = scriptResult.orderedStates.reduce((acc, stateName) => {
    const stage = parsedByState.get(normalizeTopicKey(stateName))
    if (!stage) {
      return acc
    }

    const metadata = stageMetadata.get(normalizeTopicKey(stateName))
    acc.push({
      ...stage,
      subtopic: metadata?.subtopic || stage.subtopic || '',
      miTechnique: metadata?.miTechnique || stage.miTechnique || '',
      stateName: stage.stageName,
    })
    return acc
  }, [] as ConversationStage[])

  if (!orderedStages.length) {
    throw new Error(`Topic "${source.topicName}" does not contain exportable states.`)
  }

  const explicitEndState = orderedStages.find(
    (stage) => normalizeTopicKey(stage.stageName) === 'end_conversation',
  )

  return {
    orderedStages,
    startState: scriptResult.startState,
    endState: explicitEndState?.stageName ?? scriptResult.orderedStates.at(-1) ?? null,
  }
}

const buildFullTopicCellLookups = (cells: Cell.Properties[]) => {
  const stageByStateName = new Map<string, StageCell>()
  const optionById = new Map<string, OptionCell>()
  const jumpById = new Map<string, JumpCell>()
  const outgoingEdges = new Map<string, EdgeCell[]>()

  ;(cells ?? []).forEach((cell) => {
    if (cell.shape === 'stage-node') {
      const stateName =
        typeof (cell as StageCell).data?.name === 'string'
          ? (cell as StageCell).data!.name!.trim()
          : ''
      if (stateName.length) {
        stageByStateName.set(normalizeTopicKey(stateName), cell as StageCell)
      }
      return
    }

    if (cell.shape === 'option-node') {
      optionById.set(String(cell.id || ''), cell as OptionCell)
      return
    }

    if (isJumpNodeCell(cell)) {
      jumpById.set(String(cell.id || ''), cell as JumpCell)
      return
    }

    if (cell.shape === 'edge') {
      const sourceId = toCellId((cell as EdgeCell).source?.cell)
      if (!sourceId.length) {
        return
      }
      const next = outgoingEdges.get(sourceId) ?? []
      next.push(cell as EdgeCell)
      outgoingEdges.set(sourceId, next)
    }
  })

  return {
    stageByStateName,
    optionById,
    jumpById,
    outgoingEdges,
  } as FullTopicCellLookups
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

const resolveJumpTargetState = (
  jumpNode: JumpCell,
  topicNameToRef: Map<string, ConversationTopicStateRef>,
  topicStateMaps: Map<string, Map<string, string>>,
) => {
  const targetTopic = getJumpNodeTargetTopic(jumpNode)
  if (!targetTopic.length) {
    throw new Error('A jump node is missing its target topic.')
  }

  if (isEndConversationTarget(targetTopic)) {
    return CONVERSATION_END_STATE
  }

  const topicKey = normalizeTopicKey(targetTopic)
  const topicRef = topicNameToRef.get(topicKey)
  if (!topicRef?.startState) {
    throw new Error(
      `Jump node points to "${targetTopic}", but that topic is not generated or has no exportable start state.`,
    )
  }

  const explicitState = getJumpNodeTargetState(jumpNode)
  if (!explicitState.length) {
    return topicRef.startState
  }

  const stateMap = topicStateMaps.get(topicKey)
  return stateMap?.get(normalizeTopicKey(explicitState)) ?? topicRef.startState
}

const buildCrossTopicMenuLinesForStage = (
  stageName: string,
  lookups: FullTopicCellLookups,
  topicNameToRef: Map<string, ConversationTopicStateRef>,
  topicStateMaps: Map<string, Map<string, string>>,
) => {
  const stageCell = lookups.stageByStateName.get(normalizeTopicKey(stageName))
  if (!stageCell) {
    return []
  }

  const menus = Array.isArray(stageCell.data?.menus) ? stageCell.data.menus : []
  const children = Array.isArray(stageCell.children) ? stageCell.children : []

  return menus.reduce((acc: string[], menu: Record<string, unknown>, index: number) => {
    const optionId = getStageChildId(children[index])
    if (!optionId.length) {
      return acc
    }

    const optionNode = lookups.optionById.get(optionId)
    if (!isCrossTopicOptionCell(optionNode)) {
      return acc
    }

    const jumpEdge = (lookups.outgoingEdges.get(optionId) ?? []).find((edge) =>
      lookups.jumpById.has(toCellId(edge.target?.cell)),
    )
    if (!jumpEdge) {
      return acc
    }

    const jumpNode = lookups.jumpById.get(toCellId(jumpEdge.target?.cell))
    if (!jumpNode) {
      return acc
    }

    const targetTopic = getJumpNodeTargetTopic(jumpNode)
    const targetState = resolveJumpTargetState(jumpNode, topicNameToRef, topicStateMaps)
    const title =
      (typeof optionNode?.data?.title === 'string' && optionNode.data.title.trim()) ||
      (typeof (menu as Record<string, unknown>)?.title === 'string' &&
      String((menu as Record<string, unknown>).title).trim()) ||
      (isEndConversationTarget(targetTopic)
        ? "Thank you, that's all for now."
        : buildDefaultTopicChoiceLabel(targetTopic))

    acc.push(buildTransitionMenuLine(title, targetState))
    return acc
  }, [] as string[])
}

const buildTransitionMenuLine = (label: string, targetState: string) =>
  `${label.trim()} => ${targetState}`

const buildActionGoLine = (targetState: string) => `ACTION: $GO("${targetState}")$`
const CONVERSATION_START_STATE = 'conversation_start'
const CONVERSATION_END_STATE = 'conversation_end'

const buildFallbackBranchLabel = (topicName: string) => buildDefaultTopicChoiceLabel(topicName)

const resolveTopicOrder = (
  routing: TopicRoutingPlan,
  sources: ConversationTopicSource[],
) => {
  const routed = routing.routes
    .map((route) => route.topicName)
    .filter((topicName) =>
      sources.some((source) => normalizeTopicKey(source.topicName) === normalizeTopicKey(topicName)),
    )

  const routedKeys = new Set(routed.map((topicName) => normalizeTopicKey(topicName)))
  const extras = sources
    .map((source) => source.topicName)
    .filter((topicName) => !routedKeys.has(normalizeTopicKey(topicName)))

  return [...routed, ...extras]
}

export const buildConversationScript = (options: {
  topicSources: ConversationTopicSource[]
  topicRouting?: TopicRoutingPlan | null
  conversationName?: string
}) => {
  const topicSources = options.topicSources.filter(
    (source) => source.topicName.trim().length > 0 && Array.isArray(source.cells) && source.cells.length > 0,
  )
  if (!topicSources.length) {
    throw new Error('No generated topics are available for conversation export.')
  }

  const fallbackRouting = createDefaultTopicRouting(topicSources.map((source) => source.topicName))
  const routing = options.topicRouting ?? fallbackRouting
  const orderedTopicNames = resolveTopicOrder(routing, topicSources)
  const sourceByTopic = new Map(
    topicSources.map((source) => [normalizeTopicKey(source.topicName), source] as const),
  )
  const routeLookup = getTopicRouteLookup(routing)
  const topicNameToRef = new Map<string, ConversationTopicStateRef>()
  const topicStateMaps = new Map<string, Map<string, string>>()
  const topicStageMaps = new Map<string, ConversationStage[]>()
  const topicTerminalStateKeys = new Map<string, string>()
  const topicCellLookups = new Map<string, FullTopicCellLookups>()

  orderedTopicNames.forEach((topicName, topicIndex) => {
    const source = sourceByTopic.get(normalizeTopicKey(topicName))
    if (!source) {
      return
    }

    const built = buildOrderedStagesForTopic(source)
    const stateMap = new Map<string, string>()
    built.orderedStages.forEach((stage) => {
      stateMap.set(
        normalizeTopicKey(stage.stateName),
        buildPrefixedStateName(topicName, topicIndex, stage.stateName),
      )
    })

    topicStateMaps.set(normalizeTopicKey(topicName), stateMap)
    topicStageMaps.set(normalizeTopicKey(topicName), built.orderedStages)
    topicCellLookups.set(normalizeTopicKey(topicName), buildFullTopicCellLookups(source.cells))
    topicTerminalStateKeys.set(
      normalizeTopicKey(topicName),
      normalizeTopicKey(built.endState ?? ''),
    )
    topicNameToRef.set(normalizeTopicKey(topicName), {
      topicName,
      startState: built.startState
        ? stateMap.get(normalizeTopicKey(built.startState)) ?? null
        : null,
      endState: built.endState
        ? stateMap.get(normalizeTopicKey(built.endState)) ?? null
        : null,
    })
  })

  const conversationName = (options.conversationName || 'full_conversation').trim() || 'full_conversation'
  const sections: string[] = ['', `//${conversationName}`]

  orderedTopicNames.forEach((topicName) => {
    const topicKey = normalizeTopicKey(topicName)
    const stages = topicStageMaps.get(topicKey) ?? []
    const stateMap = topicStateMaps.get(topicKey) ?? new Map<string, string>()
    const route = routeLookup.get(topicKey)
    const cellLookups = topicCellLookups.get(topicKey)
    const terminalStateKey = topicTerminalStateKeys.get(topicKey) ?? ''

    stages.forEach((stage) => {
      const stateKey = normalizeTopicKey(stage.stateName)
      const prefixedStateName = stateMap.get(stateKey)
      if (!prefixedStateName) {
        return
      }

      const subtopic = stage.subtopic?.trim() ?? ''
      const miTechnique = stage.miTechnique?.trim() ?? ''
      sections.push(`STATE: ${prefixedStateName}`)
      if (subtopic.length) {
        sections.push(`SUBTOPIC: ${subtopic}`)
      }
      if (miTechnique.length) {
        sections.push(`MI_TECHNIQUE: ${miTechnique}`)
      }
      sections.push(`AGENT: ${stage.agent.trim() || '...'}`)

      const isTerminalState = terminalStateKey.length > 0 && stateKey === terminalStateKey
      const crossTopicMenuLines = cellLookups
        ? buildCrossTopicMenuLinesForStage(
            stage.stateName,
            cellLookups,
            topicNameToRef,
            topicStateMaps,
          )
        : []

      if (isTerminalState && route) {
        if (crossTopicMenuLines.length) {
          sections.push('USERMENU:')
          crossTopicMenuLines.forEach((line: string) => sections.push(line))
          sections.push('')
          return
        }

        if (route.transition === 'direct' && route.nextTopics.length) {
          const nextTopicRef = topicNameToRef.get(normalizeTopicKey(route.nextTopics[0]))
          if (!nextTopicRef?.startState) {
            throw new Error(
              `Route from "${topicName}" points to "${route.nextTopics[0]}", but that topic is not generated or has no exportable start state.`,
            )
          }

          sections.push(buildActionGoLine(nextTopicRef.startState))
          sections.push('')
          return
        }

        if (route.transition === 'branch' && route.nextTopics.length > 1) {
          const branchLines = route.nextTopics.map((nextTopic) => {
            const nextTopicRef = topicNameToRef.get(normalizeTopicKey(nextTopic))
            if (!nextTopicRef?.startState) {
              throw new Error(
                `Branch route from "${topicName}" points to "${nextTopic}", but that topic is not generated or has no exportable start state.`,
              )
            }

            const configuredChoice = route.branchMenu.find(
              (choice) => normalizeTopicKey(choice.targetTopic) === normalizeTopicKey(nextTopic),
            )

            return buildTransitionMenuLine(
              configuredChoice?.label || buildFallbackBranchLabel(nextTopic),
              nextTopicRef.startState,
            )
          })

          if (branchLines.length) {
            sections.push('USERMENU:')
            branchLines.forEach((line) => sections.push(line))
            sections.push('')
            return
          }
        }

        if (route.transition === 'end') {
          sections.push('ACTION: $POP();$')
          sections.push('')
          return
        }
      }

      const localMenuLines = stage.menus.length
        ? stage.menus.reduce((acc, menu) => {
          const nextState = stateMap.get(normalizeTopicKey(menu.nextStage))
          if (!nextState) {
            return acc
          }
          acc.push(buildTransitionMenuLine(menu.title, nextState))
          return acc
        }, [] as string[])
        : []

      const mergedMenuLines = crossTopicMenuLines.length
        ? [...localMenuLines, ...crossTopicMenuLines]
        : localMenuLines

      if (mergedMenuLines.length) {
        sections.push('USERMENU:')
        mergedMenuLines.forEach((line) => sections.push(line))
      }

      if (!mergedMenuLines.length && isTerminalState) {
        sections.push('ACTION: $POP();$')
      }

      sections.push('')
    })
  })

  const entryTopicKey = normalizeTopicKey(routing.entryTopic)
  const firstTopicRef = Array.from(topicNameToRef.values())[0]
  const entryState =
    topicNameToRef.get(entryTopicKey)?.startState ??
    firstTopicRef?.startState ??
    null

  if (entryState) {
    sections.splice(
      2,
      0,
      `STATE: ${CONVERSATION_START_STATE}`,
      'AGENT: ...',
      buildActionGoLine(entryState),
      '',
    )
  }

  sections.push(`STATE: ${CONVERSATION_END_STATE}`)
  sections.push('AGENT: ...')
  sections.push('ACTION: $POP();$')
  sections.push('')

  return {
    topicName: conversationName,
    script: sections.join('\r\n'),
    startState: entryState ? CONVERSATION_START_STATE : null,
    topicRefs: topicNameToRef,
    routing,
  } as ConversationScriptBuildResult
}
