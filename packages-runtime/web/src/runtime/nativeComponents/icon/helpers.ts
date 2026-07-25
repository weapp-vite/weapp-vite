export const ICON_TYPES = [
  'success',
  'success_no_circle',
  'info',
  'warn',
  'waiting',
  'cancel',
  'download',
  'search',
  'clear',
] as const

export type IconType = typeof ICON_TYPES[number]

const iconTypes = new Set<string>(ICON_TYPES)

const DEFAULT_ICON_COLORS: Record<IconType, string> = {
  success: '#09bb07',
  success_no_circle: '#09bb07',
  info: '#10aeff',
  warn: '#f76260',
  waiting: '#10aeff',
  cancel: '#f76260',
  download: '#09bb07',
  search: '#7a7e83',
  clear: '#7a7e83',
}

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function resolveIconType(value: unknown): IconType {
  const type = String(value ?? '').trim().toLowerCase()
  return iconTypes.has(type) ? type as IconType : 'success'
}

export function resolveIconSize(value: unknown) {
  return Math.max(0, finiteNumber(value, 23))
}

export function resolveIconColor(type: IconType, value: unknown) {
  const color = String(value ?? '').trim()
  return color || DEFAULT_ICON_COLORS[type]
}
