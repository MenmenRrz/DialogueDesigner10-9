import { computed, nextTick, ref, watch, type Ref } from 'vue'

type TourStep = {
  selector: string
  title: string
  body: string
  note?: string
}

type UseConvertTourOptions = {
  isManualAuthoringMode: Ref<boolean>
  agentPanelVisible: Ref<boolean>
}

export const useConvertTour = ({
  isManualAuthoringMode,
  agentPanelVisible,
}: UseConvertTourOptions) => {
  const tourActive = ref(false)
  const tourStepIndex = ref(0)
  const tourTargetRect = ref<DOMRect | null>(null)

  const activeTourSteps = computed<TourStep[]>(() => {
    const steps: TourStep[] = [
      {
        selector: '[data-tour="topic-sidebar"]',
        title: 'Start with the topic structure',
        body:
          'The left sidebar is the outline of the patient conversation. Select each topic and subtopic so you can review the full design, not just one path.',
        note: 'You can drag the right edge of this sidebar to make the outline wider or narrower.',
      },
      {
        selector: '[data-tour="subtopic-list"]',
        title: 'Use subtopics to focus review',
        body:
          'A subtopic is a smaller design section inside a topic. Click one to focus the matching states on the canvas and review that part of the patient conversation.',
        note: 'The guide no longer blocks the page, so you can click the sidebar while this step is visible.',
      },
      {
        selector: '[data-tour="dialogue-canvas"]',
        title: 'Design the conversation flow',
        body:
          'The canvas shows coach messages, patient choices, and branches. Go through the whole flow to make sure it is safe, clear, and consistent with your counseling style.',
      },
      {
        selector: '[data-tour="add-state"]',
        title: 'Add State',
        body:
          'Use Add State to create a new conversation step. State titles must be unique so preview, export, and transitions can identify each step correctly.',
      },
      {
        selector: '[data-tour="add-transition"]',
        title: 'Add Transition',
        body:
          'Use Add Transition when this topic should move to another topic. Connect a patient option to the transition state to make the route explicit.',
      },
      {
        selector: '[data-tour="state-node"]',
        title: 'State / Step',
        body:
          'A state is one step in the patient conversation. Each state combines the coach message, the patient response options, and the outgoing connections to the next states.',
        note: 'Review every state because patients may arrive through different branches.',
      },
      {
        selector: '[data-tour="state-title"]',
        title: 'State title',
        body:
          'Double-click a state title to rename it. Use a clear unique name that describes the purpose of the step, such as ask_current_understanding.',
      },
      {
        selector: '[data-tour="state-agent-text"]',
        title: 'Coach message',
        body:
          'This is what the virtual health coach says to the patient. Review every message for safety, accuracy, tone, and counseling fit.',
      },
      {
        selector: '[data-tour="state-options"]',
        title: 'Patient choices',
        body:
          'These are the responses a patient can choose. Make sure the options cover likely reactions and connect to appropriate next states.',
      },
      {
        selector: '[data-tour="add-option"]',
        title: 'Add patient option',
        body:
          'Use this to add another patient response. In manual mode, you create and connect these options yourself.',
      },
      {
        selector: '[data-tour="state-preview"]',
        title: 'Preview from a state',
        body:
          'Use this button to preview the conversation starting from a specific state. This is useful when checking a branch or a risky counseling moment.',
      },
      {
        selector: '[data-tour="coach-preview"]',
        title: 'Coach Preview',
        body:
          'Open Coach Preview to experience the dialogue with the virtual agent. Use it to check pacing, wording, and whether the conversation can support at least 5 minutes.',
      },
      {
        selector: '[data-tour="export-dialogue"]',
        title: 'Export only after review',
        body:
          'Export becomes available when the dialogue is complete. If it is disabled, hover to see which topic still needs dialogue content.',
      },
    ]

    if (!isManualAuthoringMode.value) {
      steps.splice(8, 0, {
        selector: '[data-tour="suggest-options"]',
        title: 'Suggest options',
        body:
          'In AI-assisted mode, this can suggest patient response options. You still decide what is safe and appropriate before keeping them.',
      })
    }

    return steps
  })

  const currentTourStep = computed(() => activeTourSteps.value[tourStepIndex.value] ?? activeTourSteps.value[0])

  const updateTourTarget = () => {
    if (!tourActive.value || !currentTourStep.value || typeof document === 'undefined') {
      tourTargetRect.value = null
      return
    }

    const target =
      document.querySelector(currentTourStep.value.selector) ??
      document.querySelector('[data-tour="dialogue-canvas"]')
    if (!target) {
      tourTargetRect.value = null
      return
    }

    tourTargetRect.value = target.getBoundingClientRect()
  }

  const tourHighlightStyle = computed(() => {
    const rect = tourTargetRect.value
    if (!rect) {
      return null
    }

    const padding = 8
    const margin = 8
    const left = Math.max(margin, rect.left - padding)
    const top = Math.max(margin, rect.top - padding)
    const maxWidth =
      typeof window === 'undefined' ? rect.width + padding * 2 : window.innerWidth - left - margin
    const maxHeight =
      typeof window === 'undefined' ? rect.height + padding * 2 : window.innerHeight - top - margin
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(0, Math.min(rect.width + padding * 2, maxWidth))}px`,
      height: `${Math.max(0, Math.min(rect.height + padding * 2, maxHeight))}px`,
    }
  })

  const tourCardStyle = computed(() => {
    const rect = tourTargetRect.value
    const cardWidth = 360
    const cardHeight = 260
    const margin = 18
    if (!rect || typeof window === 'undefined') {
      return {
        left: `${margin}px`,
        top: '96px',
      }
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const safeWidth = Math.min(cardWidth, Math.max(260, viewportWidth - margin * 2))
    const maxLeft = Math.max(margin, viewportWidth - safeWidth - margin)
    const maxTop = Math.max(margin, viewportHeight - cardHeight - margin)
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    const spaces = {
      right: viewportWidth - rect.right - margin,
      left: rect.left - margin,
      bottom: viewportHeight - rect.bottom - margin,
      top: rect.top - margin,
    }

    let nextLeft = rect.right + 18
    let nextTop = rect.top

    if (spaces.right >= safeWidth + 18) {
      nextLeft = rect.right + 18
      nextTop = rect.top
    } else if (spaces.left >= safeWidth + 18) {
      nextLeft = rect.left - safeWidth - 18
      nextTop = rect.top
    } else if (spaces.bottom >= cardHeight + 18) {
      nextLeft = rect.left + rect.width / 2 - safeWidth / 2
      nextTop = rect.bottom + 18
    } else if (spaces.top >= cardHeight + 18) {
      nextLeft = rect.left + rect.width / 2 - safeWidth / 2
      nextTop = rect.top - cardHeight - 18
    } else {
      nextLeft = rect.left + rect.width / 2 - safeWidth / 2
      nextTop = margin
    }

    const left = clamp(nextLeft, margin, maxLeft)
    const top = clamp(nextTop, margin, maxTop)

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${safeWidth}px`,
      maxHeight: `calc(100vh - ${margin * 2}px)`,
    }
  })

  const startTour = () => {
    tourStepIndex.value = 0
    tourActive.value = true
    void nextTick(updateTourTarget)
  }

  const endTour = () => {
    tourActive.value = false
    tourTargetRect.value = null
  }

  const nextTourStep = () => {
    tourStepIndex.value = Math.min(tourStepIndex.value + 1, activeTourSteps.value.length - 1)
  }

  const previousTourStep = () => {
    tourStepIndex.value = Math.max(tourStepIndex.value - 1, 0)
  }

  watch([tourStepIndex, tourActive, agentPanelVisible], () => {
    void nextTick(updateTourTarget)
  })

  return {
    tourActive,
    tourStepIndex,
    activeTourSteps,
    currentTourStep,
    tourHighlightStyle,
    tourCardStyle,
    startTour,
    endTour,
    nextTourStep,
    previousTourStep,
    updateTourTarget,
  }
}
