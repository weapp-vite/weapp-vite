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
    if (raw.type !== undefined) {
      return normalizeJsonPropertyType(raw.type)
    }
    if (Array.isArray(raw.optionalTypes)) {
      return normalizeJsonPropertyType(raw.optionalTypes)
    }
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
    const type = normalizeJsonPropertyType(config.type) ?? 'any'
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
