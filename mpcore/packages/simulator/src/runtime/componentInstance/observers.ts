import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'
import { isPureDataField } from './pureData'
import { isArrayIndexSegment, parseDataPath } from './shared'

interface PendingObserverRun {
  changedKeys: string[]
  previousProperties: Record<string, any>
  includePropertyObservers: boolean
}

interface ObserverRunState {
  running: boolean
  pending: PendingObserverRun[]
}

const observerRunStates = new WeakMap<HeadlessComponentInstance, ObserverRunState>()

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

  const changedRoots = new Set(changedKeys.map(key => parseDataPath(key)[0]!))
  for (const changedKey of Object.keys(propOptions)) {
    if (!changedRoots.has(changedKey) || isPureDataField(definition, changedKey)) {
      continue
    }
    const value = instance.properties[changedKey]
    if ((value === null || typeof value !== 'object')
      && Object.hasOwn(previousProperties, changedKey)
      && Object.is(value, previousProperties[changedKey])) {
      continue
    }
    const option = propOptions[changedKey]
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      continue
    }
    const observer = typeof option.observer === 'string' ? instance[option.observer] : option.observer
    if (typeof observer !== 'function') {
      continue
    }
    const changedPath = parseDataPath(changedKeys.find(key => parseDataPath(key)[0] === changedKey)!)
      .map(segment => isArrayIndexSegment(segment) ? Number(segment) : segment)
    observer.call(instance, value, previousProperties[changedKey], changedPath)
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

function runComponentObserversOnce(
  definition: HeadlessComponentDefinition,
  instance: HeadlessComponentInstance,
  changedKeys: string[],
  previousProperties: Record<string, any> = {},
  includePropertyObservers = true,
) {
  if (changedKeys.length === 0) {
    return
  }

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

  if (includePropertyObservers) {
    runPropertyObservers(definition, instance, changedKeys, previousProperties)
  }
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

  const state = observerRunStates.get(instance) ?? { running: false, pending: [] }
  observerRunStates.set(instance, state)
  if (state.running) {
    runPropertyObservers(definition, instance, changedKeys, previousProperties)
    state.pending.push({ changedKeys: [...changedKeys], previousProperties, includePropertyObservers: false })
    return
  }

  state.pending.push({ changedKeys: [...changedKeys], previousProperties, includePropertyObservers: true })
  state.running = true
  try {
    while (state.pending.length > 0) {
      const next = state.pending.shift()!
      runComponentObserversOnce(definition, instance, next.changedKeys, next.previousProperties, next.includePropertyObservers)
    }
  }
  catch (error) {
    state.pending.length = 0
    throw error
  }
  finally {
    state.running = false
  }
}
