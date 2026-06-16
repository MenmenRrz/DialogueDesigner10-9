import { v4 as uuidV4 } from 'uuid'
import { sanitizeMenuTitle } from './menuText'

export interface StageNodeMenu {
  title: string
  fromStage: string
  nextStage: string
  id: string
}

export interface StageNode {
  stageName: string
  agent: string
  subtopic?: string
  miTechnique?: string
  flowOrder?: string
  menus: Array<StageNodeMenu>
}

export type DialogueParseIssueLevel = 'error' | 'warning'

export interface DialogueParseIssue {
  level: DialogueParseIssueLevel
  message: string
  topic?: string
  state?: string
}

export interface DialogueParseResult {
  topics: Map<string, StageNode[]>
  issues: DialogueParseIssue[]
}

const normalizeLineBreaks = (value: string) => value.replace(/\r\n/g, '\n')

const trimLeadingNewline = (value: string) => value.replace(/^\n+/, '')

const extractActionGoMenus = (stageName: string, section: string): StageNodeMenu[] => {
  const actionIndex = section.toUpperCase().indexOf('ACTION:')
  if (actionIndex === -1) {
    return []
  }

  const actionContent = section.slice(actionIndex + 'ACTION:'.length)
  const lines = actionContent.split(/\r?\n/)
  const menus: StageNodeMenu[] = []
  let currentLabel: string | null = null
  let autoIndex = 1

  lines.forEach((rawLine) => {
    let line = rawLine.trim()
    if (!line.length) {
      return
    }

    while (line.startsWith('}')) {
      currentLabel = null
      line = line.slice(1).trim()
    }

    if (!line.length) {
      return
    }

    const conditionMatch = line.match(/^(if|else if)\s*\((.*)\)\s*\{?$/i)
    if (conditionMatch) {
      const [, keyword, expression] = conditionMatch
      currentLabel = `${keyword.toUpperCase()} ${expression.trim()}`
    } else if (/^else\b/i.test(line)) {
      currentLabel = 'ELSE'
    }

    const goRegex = /GO\((['"])([^"'()]+)\1\)/gi
    let match: RegExpExecArray | null
    while ((match = goRegex.exec(line))) {
      const target = match[2].trim()
      if (!target) {
        continue
      }
      const title = currentLabel || `Auto ${autoIndex}`
      menus.push({
        title,
        fromStage: stageName,
        nextStage: target,
        id: uuidV4(),
      })
      autoIndex += 1
    }

    if (line.includes('}')) {
      currentLabel = null
    }
  })

  return menus
}

export const formatGeneticCounseling = (content: string): DialogueParseResult => {
  const topics = new Map<string, StageNode[]>()
  const issues: DialogueParseIssue[] = []

  if (!content || !content.trim()) {
    return { topics, issues }
  }

  const normalized = normalizeLineBreaks(content)
  const topicBlocks = normalized
    .split(/(?=\n\/\/)/g)
    .map(trimLeadingNewline)
    .filter((block) => block.trim().length > 0)

  topicBlocks.forEach((block) => {
    const headerMatch = block.match(/^\/\/([^\n]*)/)
    if (!headerMatch) {
      issues.push({ level: 'error', message: 'Encountered dialogue block without a topic header.' })
      return
    }

    const topicName = headerMatch[1].trim()
    if (!topicName) {
      issues.push({ level: 'error', message: 'Topic header is empty.' })
      return
    }

    const body = block.slice(headerMatch[0].length)
    const stageSections = body
      .split(/(?=\nSTATE:)/g)
      .map(trimLeadingNewline)
      .filter((section) => section.trim().length > 0)

    const stages: StageNode[] = []
    const stageNames = new Set<string>()

    stageSections.forEach((section, stageIndex) => {
      const lines = section
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      if (!lines.length) {
        return
      }

      if (!lines[0].startsWith('STATE:')) {
        issues.push({
          level: 'error',
          topic: topicName,
          message: `Stage is missing STATE declaration: "${lines[0]}"`,
        })
        return
      }

      const stageName = lines[0].slice(6).trim()
      if (!stageName) {
        issues.push({ level: 'error', topic: topicName, message: 'Stage name is empty.' })
        return
      }

      if (stageNames.has(stageName)) {
        issues.push({
          level: 'error',
          topic: topicName,
          state: stageName,
          message: `Duplicate state name "${stageName}" detected.`,
        })
        return
      }
      stageNames.add(stageName)

      const agentLine = lines.find((line) => line.startsWith('AGENT:'))
      const agent = agentLine ? agentLine.slice(6).trim() : ''
      if (!agentLine) {
        issues.push({ level: 'warning', topic: topicName, state: stageName, message: 'Missing AGENT line.' })
      }
      const subtopicLine =
        lines.find((line) => /^SUBTOPIC:/i.test(line)) ??
        lines.find((line) => /^SUBTOPIC_LABEL:/i.test(line))
      const miTechniqueLine =
        lines.find((line) => /^MI_TECHNIQUE:/i.test(line)) ??
        lines.find((line) => /^MI TECHNIQUE:/i.test(line)) ??
        lines.find((line) => /^MI:/i.test(line))
      const flowOrderLine = lines.find((line) => /^FLOW_ORDER:/i.test(line))
      const subtopic = subtopicLine ? subtopicLine.slice(subtopicLine.indexOf(':') + 1).trim() : ''
      const miTechnique = miTechniqueLine
        ? miTechniqueLine.slice(miTechniqueLine.indexOf(':') + 1).trim()
        : ''
      const flowOrder = flowOrderLine
        ? flowOrderLine.slice(flowOrderLine.indexOf(':') + 1).trim()
        : ''

      const userMenuIndex = lines.findIndex((line) => line.startsWith('USERMENU:'))
      const menus: StageNodeMenu[] = []

      if (userMenuIndex >= 0) {
        const menuLines = lines.slice(userMenuIndex + 1)
        menuLines.forEach((menuLine) => {
          if (!menuLine || /^ACTION:/i.test(menuLine)) {
            return
          }

          if (!menuLine.includes('=>')) {
            issues.push({
              level: 'error',
              topic: topicName,
              state: stageName,
              message: `Invalid user option (missing =>): "${menuLine}"`,
            })
            return
          }

          const [titleRaw, nextRaw] = menuLine.split(/=>/g)
          const title = sanitizeMenuTitle(titleRaw, '')
          const nextStage = nextRaw.trim()

          if (!title || !nextStage) {
            issues.push({
              level: 'error',
              topic: topicName,
              state: stageName,
              message: `Invalid user option (empty title or next state): "${menuLine}"`,
            })
            return
          }

          menus.push({
            title,
            fromStage: stageName,
            nextStage,
            id: uuidV4(),
          })
        })
      }

      if (!menus.length) {
        const actionMenus = extractActionGoMenus(stageName, section)
        if (actionMenus.length) {
          menus.push(...actionMenus)
        } else if (stageIndex !== stageSections.length - 1) {
          issues.push({ level: 'warning', topic: topicName, state: stageName, message: 'Missing USERMENU section.' })
        }
      }

      stages.push({
        stageName,
        agent,
        subtopic,
        miTechnique,
        flowOrder,
        menus,
      })
    })

    topics.set(topicName, stages)
  })

  return { topics, issues }
}
