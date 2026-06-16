export type TopicRouteTransition = 'direct' | 'branch' | 'end'

export interface TopicRouteChoice {
  label: string
  targetTopic: string
}

export interface TopicRoute {
  topicName: string
  transition: TopicRouteTransition
  nextTopics: string[]
  branchMenu: TopicRouteChoice[]
}

export interface TopicRoutingPlan {
  entryTopic: string
  routes: TopicRoute[]
}

export const isLegacyTopicChoiceLabel = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLocaleLowerCase()
  return (
    normalized === 'continue' ||
    normalized === 'next' ||
    normalized.startsWith('continue with ')
  )
}

const normalizeTopicKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')

const takeFirstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate !== 'string') {
      continue
    }
    const trimmed = candidate.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return ''
}

const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? [trimmed] : []
  }

  return []
}

const humanizeTopicName = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((entry) => entry.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

export const buildDefaultTopicChoiceLabel = (value: string) => {
  const normalized = normalizeTopicKey(value)

  if (normalized.includes('test')) {
    return "I want to know more about the test."
  }
  if (normalized.includes('concern') || normalized.includes('worry') || normalized.includes('barrier')) {
    return 'I still have some concerns.'
  }
  if (normalized.includes('option')) {
    return "I'd like to talk through my options."
  }
  if (normalized.includes('next step') || normalized.includes('next_steps') || normalized.includes('step')) {
    return "I'm ready to talk about next steps."
  }
  if (normalized.includes('benefit')) {
    return 'I want to hear more about the benefits.'
  }
  if (normalized.includes('result')) {
    return 'I want to understand the results better.'
  }
  if (normalized.includes('privacy')) {
    return 'I want to know more about privacy.'
  }
  if (normalized.includes('necessity') || normalized.includes('importance') || normalized.includes('need')) {
    return 'I want to understand why this matters.'
  }
  if (normalized.includes('screen')) {
    return "I'd like to understand screening better."
  }
  if (normalized.includes('process') || normalized.includes('procedure')) {
    return 'I want to know more about the process.'
  }
  if (normalized.includes('health goal')) {
    return "I'd like to talk more about my health goals."
  }

  const display = humanizeTopicName(value).toLowerCase()
  return display.length
    ? `I'd like to learn more about ${display}.`
    : "I'd like to keep going."
}

export const buildOrderedPlanTopicNames = (
  allTopics?: Record<string, unknown> | null,
  sessionsTopics?: Record<string, Record<string, unknown>> | null,
) => {
  const ordered: string[] = []
  const seen = new Set<string>()

  Object.values(sessionsTopics ?? {}).forEach((topics) => {
    Object.keys(topics ?? {}).forEach((topicName) => {
      const key = normalizeTopicKey(topicName)
      if (!key || seen.has(key)) {
        return
      }
      seen.add(key)
      ordered.push(topicName)
    })
  })

  Object.keys(allTopics ?? {}).forEach((topicName) => {
    const key = normalizeTopicKey(topicName)
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    ordered.push(topicName)
  })

  return ordered
}

export const createDefaultTopicRouting = (orderedTopicNames: string[]): TopicRoutingPlan => {
  const normalizedNames = orderedTopicNames.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
  const entryTopic = normalizedNames[0] ?? ''

  return {
    entryTopic,
    routes: normalizedNames.map((topicName, index) => {
      const nextTopic = normalizedNames[index + 1]
      return {
        topicName,
        transition: nextTopic ? 'direct' : 'end',
        nextTopics: nextTopic ? [nextTopic] : [],
        branchMenu: [],
      }
    }),
  }
}

const normalizeRouteTransition = (
  value: unknown,
  nextTopics: string[],
): TopicRouteTransition => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'direct' || normalized === 'branch' || normalized === 'end') {
    if (normalized === 'end') {
      return 'end'
    }
    if (normalized === 'branch' && nextTopics.length > 1) {
      return 'branch'
    }
    if (normalized === 'direct' && nextTopics.length === 1) {
      return 'direct'
    }
  }

  if (nextTopics.length > 1) {
    return 'branch'
  }
  if (nextTopics.length === 1) {
    return 'direct'
  }
  return 'end'
}

const normalizeRouteChoices = (
  value: unknown,
  validTopicNames: string[],
  normalizedTopicNames: Map<string, string>,
) => {
  const choices = Array.isArray(value) ? value : []
  const seenTargets = new Set<string>()

  return choices.reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc
    }

    const record = entry as Record<string, unknown>
    const rawTarget = takeFirstString(record, ['target_topic', 'targetTopic', 'topic', 'next_topic'])
    const resolvedTarget =
      normalizedTopicNames.get(normalizeTopicKey(rawTarget)) ??
      validTopicNames.find((topicName) => normalizeTopicKey(topicName) === normalizeTopicKey(rawTarget)) ??
      ''

    if (!resolvedTarget.length) {
      return acc
    }

    const targetKey = normalizeTopicKey(resolvedTarget)
    if (seenTargets.has(targetKey)) {
      return acc
    }

    const label = takeFirstString(record, ['label', 'text', 'title'])
    seenTargets.add(targetKey)
    acc.push({
      label:
        label && !isLegacyTopicChoiceLabel(label)
          ? label
          : buildDefaultTopicChoiceLabel(resolvedTarget),
      targetTopic: resolvedTarget,
    })
    return acc
  }, [] as TopicRouteChoice[])
}

export const normalizeTopicRouting = (
  input: unknown,
  orderedTopicNames: string[],
): TopicRoutingPlan => {
  const fallback = createDefaultTopicRouting(orderedTopicNames)
  if (!orderedTopicNames.length) {
    return fallback
  }

  const validTopicNames = orderedTopicNames.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
  const validTopicNameByKey = new Map(
    validTopicNames.map((topicName) => [normalizeTopicKey(topicName), topicName] as const),
  )

  if (!input || typeof input !== 'object') {
    return fallback
  }

  const record = input as Record<string, unknown>
  const entryTopicRaw = takeFirstString(record, ['entry_topic', 'entryTopic', 'start_topic', 'startTopic'])
  const entryTopic =
    validTopicNameByKey.get(normalizeTopicKey(entryTopicRaw)) ??
    validTopicNames[0] ??
    fallback.entryTopic

  const rawRoutes = Array.isArray(record.routes)
    ? record.routes
    : record.routes && typeof record.routes === 'object'
      ? Object.entries(record.routes as Record<string, unknown>).map(([topicName, routeValue]) => ({
          topic: topicName,
          ...(routeValue && typeof routeValue === 'object'
            ? (routeValue as Record<string, unknown>)
            : {}),
        }))
      : []

  const routeByTopic = new Map<string, TopicRoute>()

  rawRoutes.forEach((routeEntry) => {
    if (!routeEntry || typeof routeEntry !== 'object') {
      return
    }

    const routeRecord = routeEntry as Record<string, unknown>
    const rawTopicName = takeFirstString(routeRecord, ['topic', 'topic_name', 'topicName', 'name'])
    const topicName = validTopicNameByKey.get(normalizeTopicKey(rawTopicName)) ?? ''
    if (!topicName.length) {
      return
    }

    const nextTopics = [
      ...toStringArray(routeRecord.next_topics),
      ...toStringArray(routeRecord.nextTopics),
      ...toStringArray(routeRecord.next_topic),
      ...toStringArray(routeRecord.nextTopic),
    ].reduce((acc, rawTopic) => {
      const resolved = validTopicNameByKey.get(normalizeTopicKey(rawTopic)) ?? ''
      if (!resolved.length || normalizeTopicKey(resolved) === normalizeTopicKey(topicName)) {
        return acc
      }
      if (!acc.some((entry) => normalizeTopicKey(entry) === normalizeTopicKey(resolved))) {
        acc.push(resolved)
      }
      return acc
    }, [] as string[])

    const branchMenu = normalizeRouteChoices(
      routeRecord.branch_menu ?? routeRecord.branchMenu,
      validTopicNames,
      validTopicNameByKey,
    )
    const transition = normalizeRouteTransition(routeRecord.transition, nextTopics)

    routeByTopic.set(normalizeTopicKey(topicName), {
      topicName,
      transition,
      nextTopics,
      branchMenu:
        transition === 'branch'
          ? (branchMenu.length
              ? branchMenu
              : nextTopics.map((nextTopic) => ({
                  label: buildDefaultTopicChoiceLabel(nextTopic),
                  targetTopic: nextTopic,
                })))
          : [],
    })
  })

  const routes = validTopicNames.map((topicName, index) => {
    const existing = routeByTopic.get(normalizeTopicKey(topicName))
    if (existing) {
      return existing
    }

    const nextTopic = validTopicNames[index + 1]
    return {
      topicName,
      transition: nextTopic ? ('direct' as const) : ('end' as const),
      nextTopics: nextTopic ? [nextTopic] : [],
      branchMenu: [],
    }
  })

  return {
    entryTopic,
    routes,
  }
}

export const getTopicRouteLookup = (routing: TopicRoutingPlan) =>
  new Map(routing.routes.map((route) => [normalizeTopicKey(route.topicName), route] as const))

export const getTopicRouteContext = (routing: TopicRoutingPlan, topicName: string) => {
  const topicKey = normalizeTopicKey(topicName)
  const routeLookup = getTopicRouteLookup(routing)
  const route = routeLookup.get(topicKey) ?? {
    topicName,
    transition: 'end' as TopicRouteTransition,
    nextTopics: [],
    branchMenu: [],
  }

  const incomingTopics = routing.routes
    .filter((entry) =>
      entry.nextTopics.some((candidate) => normalizeTopicKey(candidate) === topicKey),
    )
    .map((entry) => entry.topicName)

  return {
    entryTopic: routing.entryTopic,
    isEntryTopic: normalizeTopicKey(routing.entryTopic) === topicKey,
    incomingTopics,
    nextTopics: route.nextTopics,
    transition: route.transition,
    branchMenu: route.branchMenu,
    isTerminalTopic: route.transition === 'end' || route.nextTopics.length === 0,
  }
}
