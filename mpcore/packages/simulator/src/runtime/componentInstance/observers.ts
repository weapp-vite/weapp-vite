import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'
import { isArrayIndexSegment, parseDataPath } from './shared'

function runPropertyObservers(
  definition: HeadlessComponentDefinition,
  instance: HeadlessComponentInstance,
  changedKeys: string[],
  previousProperties: Record<string, any>,
) {
  const propOptions = definition.properties
  if (!propOptions || typeof propOptions !== 'object' || Array.isArray(propOptions)) {
    return
  }

  for (const changedKey of changedKeys) {
    const option = propOptions[changedKey]
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      continue
    }
    const observer = option.observer
    if (typeof observer !== 'function') {
      continue
    }
    observer.call(instance, instance.properties[changedKey], previousProperties[changedKey])
  }
}

function normalizeObserverPattern(pattern: string) {
  return pattern.split(',').map(item => item.trim()).filter(Boolean)
}

function resolveObservedValue(instance: HeadlessComponentInstance, pattern: string) {
  if (pattern === '**') {
    return {
      ...instance.properties,
      ...instance.data,
    }
  }

  const segments = parseDataPath(pattern)
  if (segments.length === 0) {
    return undefined
  }

  const [rootSegment, ...restSegments] = segments
  const rootSource = Object.hasOwn(instance.properties, rootSegment)
    ? instance.properties
    : instance.data

  let current: any = rootSource?.[rootSegment]
  for (const segment of restSegments) {
    const normalizedSegment = isArrayIndexSegment(segment) ? Number(segment) : segment
    current = current?.[normalizedSegment]
  }
  return current
}

function matchObserverPattern(pattern: string, changedKeys: string[]) {
  if (pattern === '**') {
    return changedKeys.length > 0
  }

  const patterns = normalizeObserverPattern(pattern)
  return changedKeys.some((changedKey) => {
    return patterns.some((item) => {
      if (item === '**') {
        return true
      }
      if (changedKey === item) {
        return true
      }
      return changedKey.startsWith(`${item}.`) || changedKey.startsWith(`${item}[`)
    })
  })
}

export function runComponentObservers(
  definition: HeadlessComponentDefinition,
  instance: HeadlessComponentInstance,
  changedKeys: string[],
  previousProperties: Record<string, any> = {},
) {
  if (changedKeys.length === 0) {
    return
  }

  runPropertyObservers(definition, instance, changedKeys, previousProperties)

  const observers = definition.observers
  if (observers && typeof observers === 'object' && !Array.isArray(observers)) {
    for (const [pattern, handler] of Object.entries(observers)) {
      if (typeof handler !== 'function' || !matchObserverPattern(pattern, changedKeys)) {
        continue
      }
      const args = normalizeObserverPattern(pattern).map(item => resolveObservedValue(instance, item))
      handler.call(instance, ...args)
    }
  }
}
