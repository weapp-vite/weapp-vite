import type { ComponentPropMap } from '../componentProps'

export interface ComponentMetadata {
  types: ComponentPropMap
  docs: Map<string, string>
}

const JSON_TYPE_ALIASES: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Object: 'Record<string, any>',
  Array: 'any[]',
  Null: 'null',
  Any: 'any',
}

function mergeTypeCandidates(candidates: Array<string | undefined>) {
  const merged = candidates
    .filter((item): item is string => Boolean(item))
    .flatMap(item => item.split('|').map(part => part.trim()).filter(Boolean))
  if (merged.length === 0) {
    return undefined
  }
  return Array.from(new Set(merged)).join(' | ')
}

function normalizeJsonPropertyType(raw: any): string | undefined {
  if (typeof raw === 'string') {
    const key = raw.trim()
    return JSON_TYPE_ALIASES[key] ?? key
  }
  if (Array.isArray(raw)) {
    const normalized = raw
      .map(item => normalizeJsonPropertyType(item))
      .filter((item): item is string => Boolean(item))
    return normalized.length > 0 ? normalized.join(' | ') : undefined
  }
  if (raw && typeof raw === 'object') {
    return mergeTypeCandidates([
      raw.type !== undefined ? normalizeJsonPropertyType(raw.type) : undefined,
      Array.isArray(raw.optionalTypes) ? normalizeJsonPropertyType(raw.optionalTypes) : undefined,
    ])
  }
  return undefined
}

export function extractJsonPropMetadata(json: Record<string, any> | undefined) {
  const props: ComponentPropMap = new Map()
  const docs = new Map<string, string>()
  if (!json || typeof json !== 'object') {
    return { props, docs }
  }
  const properties = json.properties
  if (!properties || typeof properties !== 'object') {
    return { props, docs }
  }
  for (const [propName, rawConfig] of Object.entries(properties)) {
    const config = (rawConfig ?? {}) as Record<string, any>
    const type = normalizeJsonPropertyType(rawConfig) ?? 'any'
    props.set(propName, type)
    const description = config.description
    if (typeof description === 'string' && description.trim().length > 0) {
      docs.set(propName, description.trim())
    }
  }
  return { props, docs }
}

export function mergePropMaps(base: ComponentPropMap, override: ComponentPropMap) {
  const next: ComponentPropMap = new Map(base)
  for (const [key, value] of override.entries()) {
    next.set(key, value)
  }
  return next
}
