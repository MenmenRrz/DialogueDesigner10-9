import type { Cell } from '@antv/x6'
import type { StageNode } from './formatGeneticCounseling'
import { v4 as uuidV4 } from 'uuid'
import { sanitizeMenuTitle } from './menuText'
import {
  STAGE_NODE_MARGIN_HORIZONTAL,
  STAGE_NODE_MARGIN_VERTICAL,
  STAGE_NODE_OPTION_ITEM_HEIGHT,
  STAGE_NODE_OPTION_ITEM_LEFT,
  STAGE_NODE_OPTION_ITEM_WIDTH,
  STAGE_NODE_TOP_CONTENT_HEIGHT,
  STAGE_NODE_WIDTH,
  calcStageNodeHeight,
} from '@/constants/stageLayout'

const defaultOffsetTop = 450
const defaultOffsetLeft = 10
const stageColumnGap = STAGE_NODE_WIDTH + STAGE_NODE_MARGIN_HORIZONTAL + 80
const stageRowGap = STAGE_NODE_MARGIN_VERTICAL + 72
const maxStagesPerColumn = 3

const edgeLineAttrs = {
  stroke: '#5c6678',
  strokeWidth: 1,
  strokeOpacity: 0.62,
}

const createAntvStageCell = (
  stageNode: StageNode,
  shape: string,
  position: { x: number; y: number },
): Cell.Properties => {
  const { stageName, agent, menus } = stageNode
  const subtopic = typeof stageNode.subtopic === 'string' ? stageNode.subtopic : ''
  const miTechnique = typeof stageNode.miTechnique === 'string' ? stageNode.miTechnique : ''
  const flowOrder = typeof stageNode.flowOrder === 'string' ? stageNode.flowOrder.trim() : ''
  const stageHeight = calcStageNodeHeight(Array.isArray(menus) ? menus.length : 0)

  return {
    children: menus.map((menu) => menu.id),
    data: {
      agent,
      name: stageName,
      subtopic,
      miTechnique,
      flowOrder,
      menus,
    },
    id: stageName,
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
    position,
    shape,
    size: { width: STAGE_NODE_WIDTH, height: stageHeight },
    view: 'vue-shape-view',
    zIndex: 10,
  }
}

const createAntvOptionCell = (
  id: string,
  title: string,
  index: number,
  stageNodeCell: Cell.Properties,
) => {
  const normalizedTitle = sanitizeMenuTitle(title, `option_${index + 1}`)

  return {
    id,
    shape: 'option-node',
    x: stageNodeCell.position.x + STAGE_NODE_OPTION_ITEM_LEFT,
    y: stageNodeCell.position.y + STAGE_NODE_TOP_CONTENT_HEIGHT + index * STAGE_NODE_OPTION_ITEM_HEIGHT,
    width: STAGE_NODE_OPTION_ITEM_WIDTH,
    height: STAGE_NODE_OPTION_ITEM_HEIGHT,
    label: normalizedTitle,
    zIndex: 10,
    data: {
      title: normalizedTitle,
      status: 'view',
    },
    ports: [{ id: uuidV4(), group: 'right' }],
  }
}

const buildStageNodes = (originalStageNodes: StageNode[]) => {
  const stageNodes = [...originalStageNodes]
  const stageLookup = new Map(stageNodes.map((node) => [node.stageName, node]))

  originalStageNodes.forEach((stage) => {
    stage.menus.forEach((menu) => {
      if (menu.nextStage === 'end_conversation' && !stageLookup.has(menu.nextStage)) {
        const stub: StageNode = {
          stageName: menu.nextStage,
          agent: '',
          subtopic: '',
          miTechnique: '',
          flowOrder: '',
          menus: [],
        }
        stageLookup.set(menu.nextStage, stub)
        stageNodes.push(stub)
      }
    })
  })

  return stageNodes
}

const buildStageOrderIndex = (stageNodes: StageNode[]) =>
  new Map(stageNodes.map((stageNode, index) => [stageNode.stageName, index] as const))

const buildGraphDepthPositions = (stageNodes: StageNode[]) => {
  const stageByName = new Map(stageNodes.map((stageNode) => [stageNode.stageName, stageNode]))
  const stageOrderIndex = buildStageOrderIndex(stageNodes)
  const incomingCount = new Map<string, number>()
  const depthByStage = new Map<string, number>()

  stageNodes.forEach((stageNode) => {
    incomingCount.set(stageNode.stageName, 0)
  })

  stageNodes.forEach((stageNode) => {
    stageNode.menus.forEach((menu) => {
      if (!stageByName.has(menu.nextStage)) {
        return
      }
      incomingCount.set(menu.nextStage, (incomingCount.get(menu.nextStage) ?? 0) + 1)
    })
  })

  const queue = stageNodes
    .filter((stageNode) => (incomingCount.get(stageNode.stageName) ?? 0) === 0)
    .map((stageNode) => stageNode.stageName)

  if (!queue.length && stageNodes[0]) {
    queue.push(stageNodes[0].stageName)
  }

  queue.forEach((stageName) => depthByStage.set(stageName, 0))

  while (queue.length) {
    const currentStageName = queue.shift()
    if (!currentStageName) {
      continue
    }

    const currentStage = stageByName.get(currentStageName)
    if (!currentStage) {
      continue
    }

    const currentDepth = depthByStage.get(currentStageName) ?? 0
    const currentIndex = stageOrderIndex.get(currentStageName) ?? -1

    currentStage.menus.forEach((menu) => {
      const targetStage = stageByName.get(menu.nextStage)
      if (!targetStage) {
        return
      }

      const targetIndex = stageOrderIndex.get(targetStage.stageName) ?? -1
      if (targetIndex <= currentIndex) {
        return
      }

      const nextDepth = currentDepth + 1
      const previousDepth = depthByStage.get(targetStage.stageName)
      if (previousDepth === undefined || nextDepth > previousDepth) {
        depthByStage.set(targetStage.stageName, nextDepth)
        queue.push(targetStage.stageName)
      }
    })
  }

  let rollingDepth = 0
  stageNodes.forEach((stageNode, index) => {
    if (depthByStage.has(stageNode.stageName)) {
      rollingDepth = depthByStage.get(stageNode.stageName) ?? rollingDepth
      return
    }

    if (index === 0) {
      depthByStage.set(stageNode.stageName, 0)
      rollingDepth = 0
      return
    }

    depthByStage.set(stageNode.stageName, rollingDepth + 1)
    rollingDepth += 1
  })

  const depthEntries = new Map<number, StageNode[]>()
  stageNodes.forEach((stageNode) => {
    const depth = depthByStage.get(stageNode.stageName) ?? 0
    const bucket = depthEntries.get(depth) ?? []
    bucket.push(stageNode)
    depthEntries.set(depth, bucket)
  })

  const positions = new Map<string, { x: number; y: number }>()
  const orderedDepths = [...depthEntries.keys()].sort((left, right) => left - right)

  let currentColumnOffset = 0
  orderedDepths.forEach((depth) => {
    const columnStages = depthEntries.get(depth) ?? []
    const chunks = Array.from(
      { length: Math.max(1, Math.ceil(columnStages.length / maxStagesPerColumn)) },
      (_, chunkIndex) =>
        columnStages.slice(
          chunkIndex * maxStagesPerColumn,
          (chunkIndex + 1) * maxStagesPerColumn,
        ),
    )

    chunks.forEach((chunk, chunkIndex) => {
      let currentY = defaultOffsetTop

      chunk.forEach((stageNode) => {
        positions.set(stageNode.stageName, {
          x: defaultOffsetLeft + (currentColumnOffset + chunkIndex) * stageColumnGap,
          y: currentY,
        })
        currentY += calcStageNodeHeight(stageNode.menus.length) + stageRowGap
      })
    })

    currentColumnOffset += chunks.length
  })

  return positions
}

export const transform2AntvJson = (topicMap: Map<string, StageNode[]>) => {
  const topicGraph: Map<string, Cell.Properties[]> = new Map()

  topicMap.forEach((originalStageNodes, topicName) => {
    const stageNodes = buildStageNodes(originalStageNodes)
    const positions = buildGraphDepthPositions(stageNodes)
    const optionCells: Cell.Properties[] = []
    const stageMap = new Map<string, Cell.Properties>()

    stageNodes.forEach((stageNode, stageIndex) => {
      const { stageName, menus } = stageNode
      if (stageMap.has(stageName)) {
        return
      }

      const stageNodeCell = createAntvStageCell(stageNode, 'stage-node', {
        x:
          positions.get(stageName)?.x ??
          defaultOffsetLeft + stageIndex * (STAGE_NODE_WIDTH + STAGE_NODE_MARGIN_HORIZONTAL),
        y: positions.get(stageName)?.y ?? defaultOffsetTop,
      })
      stageMap.set(stageName, stageNodeCell)

      menus.forEach((option, optionIndex) => {
        const optionNodeCell = createAntvOptionCell(option.id, option.title, optionIndex, stageNodeCell)
        optionCells.push(optionNodeCell)
      })
    })

    const flatStageLayout: Cell.Properties[] = [...stageMap.values(), ...optionCells]

    stageNodes.forEach((stageNode) => {
      stageNode.menus.forEach((option) => {
        const optionNode = flatStageLayout.find((cell) => cell.id === option.id)
        const relatedStageNode = flatStageLayout.find((cell) => cell.id === option.nextStage)
        if (!optionNode || !relatedStageNode) {
          return
        }

        flatStageLayout.push({
          id: uuidV4(),
          shape: 'edge',
          source: {
            cell: optionNode.id,
            port: optionNode.ports[0].id,
          },
          target: {
            cell: relatedStageNode.id,
            port: relatedStageNode.ports.items[0].id,
          },
          zIndex: 10,
          attrs: {
            line: {
              ...edgeLineAttrs,
            },
          },
        })
      })
    })

    topicGraph.set(topicName, flatStageLayout)
  })

  return topicGraph
}
