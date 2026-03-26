import type { HeadlessPageDefinition } from '../host'

export interface HeadlessPageInstance extends Record<string, any> {
  __route__: string
  data: Record<string, any>
  options: Record<string, string>
  route: string
  setData: (patch: Record<string, any>, callback?: () => void) => void
}

function bindFunction(target: Record<string, any>, key: string, value: unknown) {
  if (typeof value !== 'function') {
    target[key] = value
    return
  }
  target[key] = (...args: any[]) => value.apply(target, args)
}

function cloneObject(value: Record<string, any>) {
  return JSON.parse(JSON.stringify(value))
}

function resolveInitialData(definition: HeadlessPageDefinition) {
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

function normalizeRoute(route: string) {
  return route.replace(/^\/+/, '')
}

export function createPageInstance(
  route: string,
  definition: HeadlessPageDefinition,
  options: Record<string, string> = {},
): HeadlessPageInstance {
  const normalizedRoute = normalizeRoute(route)
  const instance: HeadlessPageInstance = {
    __route__: normalizedRoute,
    data: resolveInitialData(definition),
    options: { ...options },
    route: normalizedRoute,
    setData(patch, callback) {
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }
      callback?.()
    },
  }

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'data') {
      continue
    }
    bindFunction(instance, key, value)
  }

  return instance
}
