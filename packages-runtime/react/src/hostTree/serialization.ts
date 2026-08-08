import type { HostProps } from '../types'

const UNITLESS_STYLE_PROPERTIES = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'lineHeight',
  'opacity',
  'order',
  'zIndex',
])

const SERIALIZED_PROP_NAMES = new Set([
  'checked',
  'disabled',
  'hidden',
  'id',
  'placeholder',
  'type',
  'value',
])

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
}

export function serializeStyle(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const declarations: string[] = []
  for (const [name, rawValue] of Object.entries(value)) {
    if (rawValue === null || rawValue === undefined || rawValue === false) {
      continue
    }
    const normalized = typeof rawValue === 'number' && !UNITLESS_STYLE_PROPERTIES.has(name)
      ? `${rawValue}px`
      : String(rawValue)
    declarations.push(`${toKebabCase(name)}:${normalized}`)
  }
  return declarations.join(';')
}

export function serializeProps(props: HostProps) {
  const serialized: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(props)) {
    if (SERIALIZED_PROP_NAMES.has(name) && value !== undefined) {
      serialized[name] = value
    }
  }
  return Object.keys(serialized).length > 0 ? serialized : undefined
}

export function hasSerializedPropChanges(previous: HostProps, next: HostProps) {
  const previousClass = previous.className ?? previous.class
  const nextClass = next.className ?? next.class
  if (previousClass !== nextClass) {
    return true
  }
  if (serializeStyle(previous.style) !== serializeStyle(next.style)) {
    return true
  }
  return JSON.stringify(serializeProps(previous)) !== JSON.stringify(serializeProps(next))
}
