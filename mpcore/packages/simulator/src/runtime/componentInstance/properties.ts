import type { HeadlessBehaviorDefinition, HeadlessComponentDefinition } from './types'
import { cloneRecord, cloneValue, mergeRecord } from './shared'

export function resolveInitialData(definition: HeadlessComponentDefinition) {
  const rawData = definition.data
  if (typeof rawData === 'function') {
    const next = rawData.call(definition)
    return next && typeof next === 'object' && !Array.isArray(next)
      ? cloneRecord(next)
      : {}
  }
  return rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? cloneRecord(rawData)
    : {}
}

function isBehaviorDefinition(value: unknown): value is HeadlessBehaviorDefinition {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as HeadlessBehaviorDefinition).__isHeadlessBehavior__ === true
}

function flattenBehaviors(definition: HeadlessComponentDefinition) {
  const flattened: HeadlessBehaviorDefinition[] = []
  const queue = Array.isArray(definition.behaviors) ? definition.behaviors : []
  for (const item of queue) {
    if (!isBehaviorDefinition(item)) {
      continue
    }
    flattened.push(...flattenBehaviors(item as HeadlessComponentDefinition))
    flattened.push(item)
  }
  return flattened
}

export function normalizeComponentDefinition(definition: HeadlessComponentDefinition): HeadlessComponentDefinition {
  const behaviors = flattenBehaviors(definition)
  if (behaviors.length === 0) {
    return definition
  }

  const mergedDataEntries = behaviors
    .map(item => item.data)
    .filter(Boolean)

  const mergedDefinition: HeadlessComponentDefinition = {
    ...mergeRecord(...behaviors, definition),
    methods: mergeRecord(...behaviors.map(item => item.methods), definition.methods),
    observers: mergeRecord(...behaviors.map(item => item.observers), definition.observers),
    pageLifetimes: mergeRecord(...behaviors.map(item => item.pageLifetimes), definition.pageLifetimes),
    properties: mergeRecord(...behaviors.map(item => item.properties), definition.properties),
    lifetimes: mergeRecord(...behaviors.map(item => item.lifetimes), definition.lifetimes),
  }

  if (mergedDataEntries.length > 0 || definition.data) {
    mergedDefinition.data = function mergedComponentData(this: unknown) {
      const merged = mergeRecord(
        ...mergedDataEntries.map((entry) => {
          if (typeof entry === 'function') {
            return entry.call(this)
          }
          return entry
        }),
      )
      const ownData = typeof definition.data === 'function'
        ? definition.data.call(this)
        : definition.data
      return mergeRecord(merged, ownData)
    }
  }

  return mergedDefinition
}

function normalizePropertyType(option: unknown) {
  if (option === null) {
    return null
  }
  if (option === String || option === Number || option === Boolean || option === Array || option === Object) {
    return option
  }
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    return undefined
  }
  return (option as { type?: unknown }).type
}

function resolvePropertyTypeCandidates(option: unknown) {
  const candidates: unknown[] = []
  const primaryType = normalizePropertyType(option)
  if (primaryType) {
    candidates.push(primaryType)
  }

  if (option && typeof option === 'object' && !Array.isArray(option)) {
    const optionalTypes = (option as { optionalTypes?: unknown[] }).optionalTypes
    if (Array.isArray(optionalTypes)) {
      candidates.push(...optionalTypes)
    }
  }

  return candidates
}

function resolveDefaultValueByType(type: unknown) {
  if (type === Number) {
    return 0
  }
  if (type === Boolean) {
    return false
  }
  if (type === String) {
    return ''
  }
  if (type === Array) {
    return []
  }
  if (type === Object) {
    return {}
  }
  if (type === null) {
    return null
  }
  return undefined
}

function matchesRuntimeType(rawValue: unknown, type: unknown) {
  if (type === null) {
    return true
  }
  if (type === Number) {
    return typeof rawValue === 'number'
  }
  if (type === Boolean) {
    return typeof rawValue === 'boolean'
  }
  if (type === String) {
    return typeof rawValue === 'string'
  }
  if (type === Array) {
    return Array.isArray(rawValue)
  }
  if (type === Object) {
    return !!rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
  }
  return false
}

export function coerceComponentPropertyValue(rawValue: unknown, option: unknown) {
  const candidates = resolvePropertyTypeCandidates(option)
  const primaryType = candidates[0]
  if (primaryType && matchesRuntimeType(rawValue, primaryType)) {
    return rawValue
  }

  const fallbackCandidates = primaryType ? candidates.slice(1) : candidates
  for (const type of fallbackCandidates) {
    if (type === Number) {
      const nextValue = typeof rawValue === 'number' ? rawValue : Number(rawValue)
      if (!Number.isNaN(nextValue)) {
        return nextValue
      }
      continue
    }
    if (type === Boolean) {
      if (typeof rawValue === 'boolean') {
        return rawValue
      }
      if (rawValue === '' || rawValue === 'true') {
        return true
      }
      if (rawValue === 'false') {
        return false
      }
      continue
    }
    if (type === String) {
      return rawValue == null ? '' : String(rawValue)
    }
    if (type === Array && Array.isArray(rawValue)) {
      return rawValue
    }
    if (type === Object && rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      return rawValue
    }
    if (type === null) {
      return rawValue
    }
  }

  if (primaryType === Number) {
    const nextValue = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return Number.isNaN(nextValue) ? rawValue : nextValue
  }
  if (primaryType === Boolean) {
    if (typeof rawValue === 'boolean') {
      return rawValue
    }
    if (rawValue === '' || rawValue === 'true') {
      return true
    }
    if (rawValue === 'false') {
      return false
    }
    return Boolean(rawValue)
  }
  if (primaryType === String) {
    return rawValue == null ? '' : String(rawValue)
  }
  return rawValue
}

export function resolveInitialProperties(
  definition: HeadlessComponentDefinition,
  properties: Record<string, any>,
) {
  const resolved: Record<string, any> = {}
  const propOptions = definition.properties
  if (propOptions && typeof propOptions === 'object' && !Array.isArray(propOptions)) {
    for (const [key, option] of Object.entries(propOptions)) {
      if (Object.hasOwn(properties, key)) {
        resolved[key] = coerceComponentPropertyValue(properties[key], option)
        continue
      }

      if (option && typeof option === 'object' && !Array.isArray(option) && 'value' in option) {
        const rawDefaultValue = typeof option.value === 'function'
          ? option.value.call(definition)
          : option.value
        resolved[key] = cloneValue(rawDefaultValue)
      }
      else {
        resolved[key] = cloneValue(resolveDefaultValueByType(normalizePropertyType(option)))
      }
    }
  }

  for (const [key, value] of Object.entries(properties)) {
    if (!(key in resolved)) {
      resolved[key] = value
    }
  }

  return resolved
}

function resolvePropertyDefaultValue(option: unknown) {
  if (!option || typeof option !== 'object' || Array.isArray(option) || !('value' in option)) {
    return undefined
  }
  return cloneValue((option as { value?: unknown }).value)
}

export function normalizeComponentPropertyValue(
  definition: HeadlessComponentDefinition,
  key: string,
  rawValue: unknown,
) {
  const option = definition.properties?.[key]
  if (rawValue == null) {
    return resolvePropertyDefaultValue(option)
  }
  return coerceComponentPropertyValue(rawValue, option)
}
