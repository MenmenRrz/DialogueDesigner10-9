export const useFrameScheduler = (task: () => void) => {
  let frame: number | null = null

  const schedule = () => {
    if (typeof window === 'undefined') {
      task()
      return
    }

    if (frame !== null) {
      return
    }

    frame = window.requestAnimationFrame(() => {
      frame = null
      task()
    })
  }

  const cancel = () => {
    if (typeof window === 'undefined' || frame === null) {
      return
    }

    window.cancelAnimationFrame(frame)
    frame = null
  }

  return {
    schedule,
    cancel,
  }
}
