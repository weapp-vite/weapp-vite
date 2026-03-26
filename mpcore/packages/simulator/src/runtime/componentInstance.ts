import type { HeadlessBehaviorDefinition, HeadlessComponentDefinition } from '../host'

export interface HeadlessComponentInstance extends Record<string, any> {
  __definition__?: HeadlessComponentDefinition
  __lastInteractionEvent__?: Record<string, any>
  __propertySnapshots__?: Record<string, any>
  __ready__?: boolean
  data: Record<string, any>
  properties: Record<string, any>
  selectAllComponents?: (selector: string) => any[]
  selectComponent?: (selector: string) => any
  selectOwnerComponent?: () => any
  setData: (patch: Record<string, any>, callback?: () => void) => void
  triggerEvent: (eventName: string, detail?: unknown, options?: Record<string, any>) => void
}

function bindFunction(target: Record<string, any>, key: string, value: unknown) {
  if (typeof value !== 'function') {
    target[key] = value
    return
  }
  target[key] = (...args: any[]) => value.apply(target, args)
}

function cloneObject<T extends Record<string, any>>(value: T) {
  return JSON.parse(JSON.stringify(value))
}

function cloneValue<T>(value: T) {
  if (Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value)) as T
  }
  if (value && typeof value === 'object') {
    return cloneObject(value as Record<string, any>) as T
  }
  return value
}

export { cloneValue }

function parseDataPath(path: string) {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

function isArrayIndexSegment(segment: string) {
  return /^\d+$/.test(segment)
}

function createContainerByNextSegment(nextSegment?: string) {
  return isArrayIndexSegment(nextSegment ?? '') ? [] : {}
}

function assignByPath(target: Record<string, any>, path: string, value: unknown) {
  const segments = parseDataPath(path)
  if (segments.length === 0) {
    return
  }

  let current: any = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!
    const nextSegment = segments[index + 1]
    const normalizedSegment = isArrayIndexSegment(segment) ? Number(segment) : segment
    const next = current?.[normalizedSegment]
    if (!next || typeof next !== 'object') {
      current[normalizedSegment] = createContainerByNextSegment(nextSegment)
    }
    current = current[normalizedSegment]
  }

  const leafSegment = segments[segments.length - 1]!
  const normalizedLeafSegment = isArrayIndexSegment(leafSegment) ? Number(leafSegment) : leafSegment
  current[normalizedLeafSegment] = value
}

function resolveInitialData(definition: HeadlessComponentDefinition) {
  const rawData = definition.data
  if (typeof rawData === 'function') {
    const next = rawData.call(definition)
    return next && typeof next === 'object' && !Array.isArray(next)
      ? cloneObject(next)
      : {}
  }
  return rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? cloneObject(rawData)
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

function mergeRecord(...records: Array<Record<string, any> | undefined>) {
  return Object.assign({}, ...records.filter(Boolean))
}

function normalizeComponentDefinition(definition: HeadlessComponentDefinition): HeadlessComponentDefinition {
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

function resolveInitialProperties(
  definition: HeadlessComponentDefinition,
  properties: Record<string, any>,
) {
  const resolved: Record<string, any> = {}
  const propOptions = definition.properties
  if (propOptions && typeof propOptions === 'object' && !Array.isArray(propOptions)) {
    for (const [key, option] of Object.entries(propOptions)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
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
  const rootSource = Object.prototype.hasOwnProperty.call(instance.properties, rootSegment)
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

export interface CreateComponentInstanceOptions {
  definition: HeadlessComponentDefinition
  properties?: Record<string, any>
  triggerEvent?: (
    instance: HeadlessComponentInstance,
    eventName: string,
    detail?: unknown,
    options?: Record<string, any>,
  ) => void
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

export function createComponentInstance(options: CreateComponentInstanceOptions): HeadlessComponentInstance {
  const definition = normalizeComponentDefinition(options.definition)
  const instance: HeadlessComponentInstance = {
    __definition__: definition,
    data: resolveInitialData(definition),
    __propertySnapshots__: {},
    properties: resolveInitialProperties(definition, options.properties ?? {}),
    setData(patch, callback) {
      const changedKeys = Object.keys(patch)
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }

      runComponentObservers(definition, instance, changedKeys)

      callback?.()
    },
    triggerEvent(eventName, detail, triggerOptions) {
      options.triggerEvent?.(instance, eventName, detail, triggerOptions)
    },
  }

  for (const [key, value] of Object.entries(definition.methods ?? {})) {
    bindFunction(instance, key, value)
  }

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'data' || key === 'methods' || key === 'properties' || key === 'observers' || key === 'lifetimes') {
      continue
    }
    bindFunction(instance, key, value)
  }

  return instance
}

export function runComponentLifecycle(
  instance: HeadlessComponentInstance,
  lifecycleName: 'attached' | 'created' | 'detached' | 'ready',
) {
  const definition = instance.__definition__
  const fromLifetimes = definition?.lifetimes?.[lifecycleName]
  if (typeof fromLifetimes === 'function') {
    fromLifetimes.call(instance)
    return
  }
  const topLevel = definition?.[lifecycleName]
  if (typeof topLevel === 'function') {
    topLevel.call(instance)
  }
}

export function runComponentPageLifetime(
  instance: HeadlessComponentInstance,
  lifetimeName: 'hide' | 'resize' | 'show',
  payload?: unknown,
) {
  const pageLifetimes = instance.__definition__?.pageLifetimes
  const handler = pageLifetimes?.[lifetimeName]
  if (typeof handler !== 'function') {
    return
  }
  handler.call(instance, payload)
}
