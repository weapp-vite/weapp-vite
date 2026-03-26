import type { HeadlessComponentDefinition } from '../host'

export interface HeadlessComponentInstance extends Record<string, any> {
  __definition__?: HeadlessComponentDefinition
  data: Record<string, any>
  properties: Record<string, any>
  setData: (patch: Record<string, any>, callback?: () => void) => void
  triggerEvent: (eventName: string, detail?: unknown) => void
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

function resolveInitialProperties(
  definition: HeadlessComponentDefinition,
  properties: Record<string, any>,
) {
  const resolved: Record<string, any> = {}
  const propOptions = definition.properties
  if (propOptions && typeof propOptions === 'object' && !Array.isArray(propOptions)) {
    for (const [key, option] of Object.entries(propOptions)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        resolved[key] = properties[key]
        continue
      }

      if (option && typeof option === 'object' && !Array.isArray(option) && 'value' in option) {
        resolved[key] = typeof option.value === 'object' && option.value !== null
          ? cloneObject(option.value as Record<string, any>)
          : option.value
      }
      else {
        resolved[key] = undefined
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

function normalizeObserverPattern(pattern: string) {
  return pattern.split(',').map(item => item.trim()).filter(Boolean)
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
  triggerEvent?: (eventName: string, detail?: unknown) => void
}

export function runComponentObservers(
  definition: HeadlessComponentDefinition,
  instance: HeadlessComponentInstance,
  changedKeys: string[],
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
      handler.call(instance)
    }
  }
}

export function createComponentInstance(options: CreateComponentInstanceOptions): HeadlessComponentInstance {
  const definition = options.definition
  const instance: HeadlessComponentInstance = {
    __definition__: definition,
    data: resolveInitialData(definition),
    properties: resolveInitialProperties(definition, options.properties ?? {}),
    setData(patch, callback) {
      const changedKeys = Object.keys(patch)
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }

      runComponentObservers(definition, instance, changedKeys)

      callback?.()
    },
    triggerEvent(eventName, detail) {
      options.triggerEvent?.(eventName, detail)
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
