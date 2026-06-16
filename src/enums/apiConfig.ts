const normalizeApiBase = (value: string | undefined, fallback: string) => {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/g, '')
  return normalized.length ? normalized : fallback
}

export const apiBaseURL = {
  DEFAULT: normalizeApiBase(
    import.meta.env.VITE_AI_API_BASE || import.meta.env.VITE_API_BASE,
    '/api',
  ),
  R2J: normalizeApiBase(import.meta.env.VITE_R2J_API_BASE, '/api/r2j'),
} as const

export type ApiBaseURL = (typeof apiBaseURL)[keyof typeof apiBaseURL]
