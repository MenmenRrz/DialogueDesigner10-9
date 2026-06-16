export type StatePalette = {
  bg: string
  border: string
  accent: string
  glow: string
}

export const DEFAULT_STATE_PALETTE: StatePalette = {
  bg: '#f8fbff',
  border: '#bdd6f2',
  accent: '#2f6ea6',
  glow: 'rgba(47, 110, 166, 0.24)',
}

export const STATE_PALETTE: StatePalette[] = [
  { bg: '#eaf2ff', border: '#7da8e6', accent: '#1e5aa8', glow: 'rgba(30, 90, 168, 0.28)' },
  { bg: '#fff1e7', border: '#d59668', accent: '#9b5b2e', glow: 'rgba(155, 91, 46, 0.26)' },
  { bg: '#eef8ee', border: '#7eb78b', accent: '#2f7442', glow: 'rgba(47, 116, 66, 0.26)' },
  { bg: '#f0ebfb', border: '#9d85d6', accent: '#5c3ea6', glow: 'rgba(92, 62, 166, 0.24)' },
  { bg: '#eaf7f7', border: '#78b6bb', accent: '#216b74', glow: 'rgba(33, 107, 116, 0.24)' },
  { bg: '#fff8d9', border: '#d6bc5f', accent: '#856b12', glow: 'rgba(133, 107, 18, 0.22)' },
  { bg: '#fdecef', border: '#d58a9a', accent: '#9a4058', glow: 'rgba(154, 64, 88, 0.22)' },
  { bg: '#e8f7f0', border: '#69b99a', accent: '#1f7358', glow: 'rgba(31, 115, 88, 0.22)' },
  { bg: '#edf0ff', border: '#8d9ce6', accent: '#4657a8', glow: 'rgba(70, 87, 168, 0.22)' },
  { bg: '#f6edf8', border: '#c38bd0', accent: '#7b3b88', glow: 'rgba(123, 59, 136, 0.22)' },
]

export const paletteByIndex = (index: number) => {
  if (!Number.isFinite(index) || index < 0) {
    return DEFAULT_STATE_PALETTE
  }
  return STATE_PALETTE[Math.trunc(index) % STATE_PALETTE.length] ?? DEFAULT_STATE_PALETTE
}

export const hashToPalette = (value: string) => {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized.length) {
    return DEFAULT_STATE_PALETTE
  }

  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 2147483647
  }
  return STATE_PALETTE[Math.abs(hash) % STATE_PALETTE.length]
}
