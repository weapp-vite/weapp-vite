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

function normalizePropertyConstructor(candidate: unknown) {
  if (candidate === String || candidate === Number || candidate === Boolean || candidate === Array || candidate === Object) {
    return candidate
  }
  if (typeof candidate !== 'function') {
    return undefined
  }
  if (candidate.name === 'String') {
    return String
  }
  if (candidate.name === 'Number') {
    return Number
  }
  if (candidate.name === 'Boolean') {
    return Boolean
  }
  if (candidate.name === 'Array') {
    return Array
  }
  if (candidate.name === 'Object') {
    return Object
  }
  return undefined
}

function normalizePropertyType(option: unknown): unknown {
  if (option === null) {
    return null
  }
  const constructor = normalizePropertyConstructor(option)
  if (constructor) {
    return constructor
  }
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    return undefined
  }
  return normalizePropertyType((option as { type?: unknown }).type)
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
      for (const optionalType of optionalTypes) {
        const normalizedType = normalizePropertyType(optionalType)
        if (normalizedType !== undefined) {
          candidates.push(normalizedType)
        }
      }
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
    return null
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
  if (fallbackCandidates.includes(null)) {
    return rawValue
  }
  return rawValue
}

function resolvePropertyDefaultValue(option: unknown, definition: HeadlessComponentDefinition) {
  if (!option || typeof option !== 'object' || Array.isArray(option) || !('value' in option)) {
    return undefined
  }
  const rawDefaultValue = (option as { value?: unknown }).value
  return cloneValue(typeof rawDefaultValue === 'function'
    ? rawDefaultValue.call(definition)
    : rawDefaultValue)
}

export function normalizeComponentPropertyValue(
  definition: HeadlessComponentDefinition,
  key: string,
  rawValue: unknown,
) {
  const option = definition.properties?.[key]
  if (rawValue == null) {
    if (option && typeof option === 'object' && !Array.isArray(option) && 'value' in option) {
      return resolvePropertyDefaultValue(option, definition)
    }
    return cloneValue(resolveDefaultValueByType(normalizePropertyType(option)))
  }
  return coerceComponentPropertyValue(rawValue, option)
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
        resolved[key] = normalizeComponentPropertyValue(definition, key, properties[key])
        continue
      }

      if (option && typeof option === 'object' && !Array.isArray(option) && 'value' in option) {
        resolved[key] = resolvePropertyDefaultValue(option, definition)
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
