import type { Cell } from '@antv/x6'
import type { StageNode } from './formatGeneticCounseling'
import { v4 as uuidV4 } from 'uuid'

const paddingVal = 10
const addOptionBtnHeight = 24
const stageNodeWidth = 300
const stageNodeMarginHorizontal = 50
const stageNodeMarginVertical = 30
const stageNodeTitleAndAgentHeight = 305
const optionItemWidth = 258
const optionItemHeight = 38.5
const optionItemLeft = 35
const defaultOffsetTop = 450
const defaultOffsetLeft = 10

const calcStageNodeHeight = (stageNode: Cell.Properties) => {
  return (
    paddingVal +
    stageNodeTitleAndAgentHeight +
    addOptionBtnHeight +
    (stageNode.menus || stageNode.data.menus).length * optionItemHeight
  )
}

const createAntvStageCell = (
  stageNode: StageNode,
  stageLayout: Cell.Properties[][],
  shape: string,
  notMenu = false,
): Cell.Properties => {
  const { stageName, agent, menus } = stageNode
  const stageHeight = calcStageNodeHeight(stageNode)
  const curIndexHeight =
    stageLayout.length > 0
      ? stageLayout
          .at(-1)!
          .reduce((p, c) => p + c.size.height + stageNodeMarginVertical, defaultOffsetTop)
      : defaultOffsetTop
  const stageNodeCell = {
    children: menus.map((e) => e.id),
    data: {
      agent,
      name: stageName,
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
    position: {
      x:
        (stageNodeWidth + stageNodeMarginHorizontal) *
          (notMenu ? stageLayout.length : stageLayout.length > 0 ? stageLayout.length - 1 : 0) +
        defaultOffsetLeft,
      y: notMenu ? defaultOffsetTop : curIndexHeight,
    },
    shape,
    size: { width: stageNodeWidth, height: stageHeight },
    view: 'vue-shape-view',
    zIndex: 10,
  }
  return stageNodeCell
}

const createAntvOptionCell = (
  id: string,
  title: string,
  i: number,
  stageNodeCell: Cell.Properties,
) => {
  const optionNode = {
    id,
    shape: 'option-node',
    x: stageNodeCell.position.x + optionItemLeft,
    y: stageNodeCell.position.y + stageNodeTitleAndAgentHeight + i * optionItemHeight,
    width: optionItemWidth,
    height: optionItemHeight,
    label: title,
    zIndex: 10,
    data: {
      title: title,
      status: 'view',
    },
    ports: [{ id: uuidV4(), group: 'right' }],
  }
  return optionNode
}

const regulateCellPosition = (layout: Cell.Properties[][], optionCells: Cell.Properties[]) => {
  layout.forEach((stageNodes) => {
    if (stageNodes.length > 0) {
      const totalHeightInCurrentLevel = stageNodes.reduce(
        (p, c: Cell.Properties) => p + c.size.height + stageNodeMarginVertical,
        0,
      )
      stageNodes.forEach((stageNode) => {
        const offsetVal = (totalHeightInCurrentLevel - stageNodeMarginVertical) / 2
        stageNode.position.y -= offsetVal
        const relatedOptionCells = optionCells.filter((e) => stageNode.children?.includes(e.id!))
        relatedOptionCells.forEach((optionNode) => {
          optionNode.y -= offsetVal
        })
      })
    }
  })
}

export const transform2AntvJson = (topicMap: Map<string, StageNode[]>) => {
  let topicGraph: Map<string, Cell.Properties[]> = new Map()
  topicMap.forEach((originalStageNodes, topicName) => {
    const stageNodes = [...originalStageNodes]
    const stageLookup = new Map(stageNodes.map((node) => [node.stageName, node]))

    originalStageNodes.forEach((stage) => {
      stage.menus.forEach((menu) => {
        if (menu.nextStage === 'end_conversation' && !stageLookup.has(menu.nextStage)) {
          const stub = { stageName: menu.nextStage, agent: '', menus: [] }
          stageLookup.set(menu.nextStage, stub)
          stageNodes.push(stub)
        }
      })
    })

    let stageLayout: Cell.Properties[][] = []
    let optionCells: Cell.Properties[] = []
    let stageMap = new Map<string, Cell.Properties>()
    stageNodes.forEach((stageNode) => {
      const { stageName, menus } = stageNode
      if (!stageMap.has(stageName)) {
        const stageNodeCell = createAntvStageCell(stageNode, stageLayout, 'stage-node', true)
        stageLayout.push([stageNodeCell])
        stageMap.set(stageName, stageNodeCell)

        if (
          menus.length > 0 &&
          !menus.some((e) => stageNodes.every((item) => item.stageName === e.nextStage))
        ) {
          stageLayout.push([])
        }
        menus.forEach((option, i) => {
          const { title, nextStage, id } = option
          const relatedStageNode = stageNodes.find((e) => e.stageName === nextStage)
          let relatedStageNodeCell: Cell.Properties
          if (relatedStageNode) {
            if (!stageMap.has(nextStage)) {
              relatedStageNodeCell = createAntvStageCell(
                relatedStageNode,
                stageLayout,
                'stage-node',
              )
              stageLayout.at(-1)?.push(relatedStageNodeCell)
              stageMap.set(nextStage, relatedStageNodeCell)

              relatedStageNode.menus.forEach((relatedStageOption, index) => {
                const { title, id } = relatedStageOption
                const optionNodeCell = createAntvOptionCell(id, title, index, relatedStageNodeCell)
                optionCells.push(optionNodeCell)
              })
            }
          }
          const optionNodeCell = createAntvOptionCell(id, title, i, stageNodeCell)
          optionCells.push(optionNodeCell)
        })
      }
    })

    regulateCellPosition(stageLayout, optionCells)
    const flatStageLayout: Cell.Properties[] = [...stageLayout.flat(Infinity), ...optionCells]

    stageNodes.forEach((stageNode) => {
      const { menus } = stageNode
      menus.forEach((option, i) => {
        const { nextStage, id } = option
        const optionNode = flatStageLayout.find((e) => e.id === id)
        const relatedStageNode = flatStageLayout.find((e) => e.id === nextStage)
        if (relatedStageNode) {
          const edgeNodeCell = {
            id: uuidV4(),
            shape: 'edge',
            source: {
              cell: optionNode!.id,
              port: optionNode!.ports[0].id,
            },
            target: {
              cell: relatedStageNode.id,
              port: relatedStageNode.ports.items[0].id,
            },
            zIndex: 10,
            connector: 'smooth',
            attrs: {
              line: {
                stroke: '#000',
                strokeWidth: 0.8,
              },
            },
          }
          flatStageLayout.push(edgeNodeCell)
        }
      })
    })

    topicGraph.set(topicName, flatStageLayout)
  })
  return topicGraph
}
