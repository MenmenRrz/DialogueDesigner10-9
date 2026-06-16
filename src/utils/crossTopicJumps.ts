import type { Cell } from '@antv/x6'

export const JUMP_NODE_SHAPE = 'jump-node'
export const JUMP_NODE_WIDTH = 220
export const JUMP_NODE_HEIGHT = 78
export const END_CONVERSATION_TARGET = '__end_conversation__'

const toRecord = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

export const isJumpNodeCell = (cell: Cell.Properties | undefined | null) =>
  Boolean(cell && cell.shape === JUMP_NODE_SHAPE)

export const isCrossTopicOptionCell = (cell: Cell.Properties | undefined | null) =>
  Boolean(cell?.shape === 'option-node' && toRecord(cell?.data)?.crossTopic === true)

export const isRouteManagedJumpNodeCell = (cell: Cell.Properties | undefined | null) =>
  Boolean(isJumpNodeCell(cell) && toRecord(cell?.data)?.routeManaged === true)

export const isRouteManagedCrossTopicOptionCell = (cell: Cell.Properties | undefined | null) =>
  Boolean(isCrossTopicOptionCell(cell) && toRecord(cell?.data)?.routeManaged === true)

export const isCrossTopicMenu = (menu: unknown) =>
  Boolean(toRecord(menu)?.crossTopic === true)

export const getJumpNodeData = (cell: Cell.Properties | undefined | null) =>
  toRecord(cell?.data)

export const getJumpNodeTargetTopic = (cell: Cell.Properties | undefined | null) => {
  const value = getJumpNodeData(cell)?.targetTopic
  return typeof value === 'string' ? value.trim() : ''
}

export const getJumpNodeTargetState = (cell: Cell.Properties | undefined | null) => {
  const value = getJumpNodeData(cell)?.targetState
  return typeof value === 'string' ? value.trim() : ''
}

export const isEndConversationTarget = (value: unknown) =>
  String(value || '').trim() === END_CONVERSATION_TARGET

const stripArtifactsByPredicate = (
  cells: Cell.Properties[] | undefined,
  shouldRemoveJumpNode: (cell: Cell.Properties | undefined | null) => boolean,
  shouldRemoveOptionNode: (cell: Cell.Properties | undefined | null) => boolean,
) => {
  if (!Array.isArray(cells) || !cells.length) {
    return [] as Cell.Properties[]
  }

  const cloned = JSON.parse(JSON.stringify(cells)) as Cell.Properties[]
  const jumpNodeIds = new Set(
    cloned
      .filter((cell) => shouldRemoveJumpNode(cell))
      .map((cell) => String(cell.id || ''))
      .filter((id) => id.length > 0),
  )
  const crossTopicOptionIds = new Set(
    cloned
      .filter((cell) => shouldRemoveOptionNode(cell))
      .map((cell) => String(cell.id || ''))
      .filter((id) => id.length > 0),
  )

  const filtered = cloned.filter((cell) => {
    const id = String(cell.id || '')
    if (jumpNodeIds.has(id) || crossTopicOptionIds.has(id)) {
      return false
    }

    if (cell.shape === 'edge') {
      const source = String((cell as Cell.Properties).source?.cell || '')
      const target = String((cell as Cell.Properties).target?.cell || '')
      if (
        jumpNodeIds.has(source) ||
        jumpNodeIds.has(target) ||
        crossTopicOptionIds.has(source) ||
        crossTopicOptionIds.has(target)
      ) {
        return false
      }
    }

    return true
  })

  return filtered.map((cell) => {
    if (cell.shape !== 'stage-node') {
      return cell
    }

    const data = toRecord(cell.data) ?? {}
    const menus = Array.isArray(data.menus)
      ? data.menus.filter((menu) => {
          const record = toRecord(menu)
          const menuId = String(record?.id || '')
          return !isCrossTopicMenu(menu) && !crossTopicOptionIds.has(menuId)
        })
      : []
    const children = Array.isArray(cell.children)
      ? cell.children.filter((child) => {
          const childId =
            typeof child === 'string'
              ? child
              : child && typeof child === 'object' && 'id' in child
                ? String((child as { id?: unknown }).id || '')
                : ''
          return !crossTopicOptionIds.has(childId)
        })
      : []

    return {
      ...cell,
      children,
      data: {
        ...data,
        menus,
      },
    }
  })
}

export const stripCrossTopicArtifacts = (cells: Cell.Properties[] | undefined) => {
  return stripArtifactsByPredicate(cells, isJumpNodeCell, isCrossTopicOptionCell)
}

export const stripManagedCrossTopicArtifacts = (cells: Cell.Properties[] | undefined) =>
  stripArtifactsByPredicate(cells, isRouteManagedJumpNodeCell, isRouteManagedCrossTopicOptionCell)
