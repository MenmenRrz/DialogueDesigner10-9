import { ref, type Ref } from 'vue'
import type { Cell, Graph } from '@antv/x6'

type SnapshotOptions = {
  structureChanged?: boolean
}

type UseGraphSnapshotQueueOptions = {
  graph: Ref<Graph | undefined>
  topicGraph: Ref<Map<string, Cell.Properties[]>>
  selectedTopic: Ref<string | null | undefined>
  isGraphHydrating: () => boolean
  computeTopicStats: (cells: Cell.Properties[]) => void
}

export const useGraphSnapshotQueue = ({
  graph,
  topicGraph,
  selectedTopic,
  isGraphHydrating,
  computeTopicStats,
}: UseGraphSnapshotQueueOptions) => {
  const graphMutationRevision = ref(0)
  const graphStructureRevision = ref(0)
  let graphSnapshotTimer: number | null = null
  let pendingSnapshotTopicName: string | null = null
  let pendingSnapshotOptions: SnapshotOptions = {}

  const clearScheduledGraphSnapshotTimer = () => {
    if (typeof window === 'undefined' || graphSnapshotTimer === null) {
      return false
    }

    window.clearTimeout(graphSnapshotTimer)
    graphSnapshotTimer = null
    return true
  }

  const flushGraphSnapshot = (
    targetTopicName?: string | null,
    options: SnapshotOptions = {},
  ) => {
    if (!graph.value || isGraphHydrating()) {
      return false
    }

    const key = targetTopicName ?? selectedTopic.value
    if (!key) {
      return false
    }

    const snapshot = ((graph.value.toJSON().cells ?? []) as Cell.Properties[])
    topicGraph.value.set(key, snapshot)
    graphMutationRevision.value += 1
    if (options.structureChanged) {
      graphStructureRevision.value += 1
    }
    computeTopicStats(snapshot)
    if (pendingSnapshotTopicName === key) {
      pendingSnapshotTopicName = null
      pendingSnapshotOptions = {}
      clearScheduledGraphSnapshotTimer()
    }
    return true
  }

  const captureGraphSnapshot = (options: SnapshotOptions = {}) => {
    const targetTopicName = selectedTopic.value
    if (!targetTopicName) {
      return
    }

    pendingSnapshotTopicName = targetTopicName
    pendingSnapshotOptions = {
      structureChanged: Boolean(pendingSnapshotOptions.structureChanged || options.structureChanged),
    }

    if (typeof window === 'undefined') {
      flushGraphSnapshot(targetTopicName, pendingSnapshotOptions)
      return
    }

    clearScheduledGraphSnapshotTimer()

    graphSnapshotTimer = window.setTimeout(() => {
      graphSnapshotTimer = null
      flushGraphSnapshot(targetTopicName, pendingSnapshotOptions)
    }, pendingSnapshotOptions.structureChanged ? 180 : 420)
  }

  const flushPendingGraphSnapshot = () => {
    if (!pendingSnapshotTopicName) {
      return false
    }

    const targetTopicName = pendingSnapshotTopicName
    const options = { ...pendingSnapshotOptions }
    clearScheduledGraphSnapshotTimer()
    return flushGraphSnapshot(targetTopicName, options)
  }

  const clearGraphSnapshotTimer = () => {
    return clearScheduledGraphSnapshotTimer()
  }

  return {
    graphMutationRevision,
    graphStructureRevision,
    flushGraphSnapshot,
    flushPendingGraphSnapshot,
    captureGraphSnapshot,
    clearGraphSnapshotTimer,
  }
}
