import { v4 as uuidV4 } from 'uuid'

export interface StageNodeMenu {
  title: string
  fromStage: string
  nextStage: string
  id: string
}

export interface StageNode {
  stageName: string
  agent: string
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

    stageSections.forEach((section) => {
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
          const title = titleRaw.trim()
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
      } else {
        issues.push({ level: 'warning', topic: topicName, state: stageName, message: 'Missing USERMENU section.' })
      }

      stages.push({
        stageName,
        agent,
        menus,
      })
    })

    if (!stages.some((stage) => stage.stageName === 'end_conversation')) {
      issues.push({
        level: 'warning',
        topic: topicName,
        state: 'end_conversation',
        message: 'Missing end_conversation state; a placeholder will be added.',
      })
      stages.push({
        stageName: 'end_conversation',
        agent: '',
        menus: [],
      })
    }

    topics.set(topicName, stages)
  })

  return { topics, issues }
}
