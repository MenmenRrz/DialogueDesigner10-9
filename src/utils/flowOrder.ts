const FLOW_ORDER_PATTERN = /^\d+(?:\.\d+)+$/

export const normalizeFlowOrder = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

export const parseFlowOrder = (value: unknown): number[] | null => {
  const normalized = normalizeFlowOrder(value)
  if (!FLOW_ORDER_PATTERN.test(normalized)) {
    return null
  }

  const segments = normalized
    .split('.')
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment) && segment >= 0)

  return segments.length ? segments : null
}

export const hasFlowOrder = (value: unknown) => parseFlowOrder(value) !== null

export const compareFlowOrder = (left: unknown, right: unknown) => {
  const leftSegments = parseFlowOrder(left)
  const rightSegments = parseFlowOrder(right)

  if (!leftSegments && !rightSegments) {
    return 0
  }
  if (!leftSegments) {
    return 1
  }
  if (!rightSegments) {
    return -1
  }

  const maxLength = Math.max(leftSegments.length, rightSegments.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftSegments[index] ?? -1
    const rightValue = rightSegments[index] ?? -1
    if (leftValue !== rightValue) {
      return leftValue - rightValue
    }
  }

  return 0
}

export const getFlowOrderDepth = (value: unknown) => parseFlowOrder(value)?.length ?? 0
