export const sanitizeMenuTitle = (value: unknown, fallback = '') => {
  let normalized = typeof value === 'string' ? value : ''
  normalized = normalized.trim()
  if (!normalized.length) {
    return fallback
  }

  // remove wrapping quotes
  normalized = normalized.replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '').trim()
  // remove angle wrappers and angle chars that often leak from prompts
  normalized = normalized.replace(/^<+|>+$/g, '').replace(/[<>]/g, '').trim()
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized.length ? normalized : fallback
}
