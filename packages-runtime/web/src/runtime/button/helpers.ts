const DEFAULT_HOVER_CLASS = 'button-hover'

export const DEFAULT_HOVER_START = 20
export const DEFAULT_HOVER_STAY = 70

export function toBoolean(value: string | null) {
  if (value === null) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'true') {
    return true
  }
  return normalized !== 'false' && normalized !== '0'
}

export function parseNumber(value: string | null, fallback: number) {
  if (value === null || value === '') {
    return fallback
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function isDisabled(element: HTMLElement) {
  return toBoolean(element.getAttribute('disabled')) || toBoolean(element.getAttribute('loading'))
}

export function normalizeType(value: string | null) {
  if (!value) {
    return 'default'
  }
  const normalized = value.toLowerCase()
  if (normalized === 'primary' || normalized === 'warn') {
    return normalized
  }
  return 'default'
}

export function getHoverClass(element: HTMLElement) {
  const hoverClass = element.getAttribute('hover-class')
  if (!hoverClass) {
    return DEFAULT_HOVER_CLASS
  }
  if (hoverClass === 'none') {
    return ''
  }
  return hoverClass
}

export function isInternalNode(node: Node) {
  return node instanceof HTMLElement && node.dataset?.weappInternal === 'true'
}
