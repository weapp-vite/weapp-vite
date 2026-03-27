import type { HeadlessPageDefinition } from '../host'
import type { HeadlessNavigationBarSnapshot } from '../project/pageConfig'
import { cloneNavigationBarSnapshot } from '../project/pageConfig'

const ARRAY_INDEX_PATH_RE = /\[(\d+)\]/g
const ARRAY_INDEX_SEGMENT_RE = /^\d+$/
const LEADING_ROUTE_SLASH_RE = /^\/+/

export interface HeadlessPageInstance extends Record<string, any> {
  __lastChangedKeys__?: string[]
  __navigationBar__?: HeadlessNavigationBarSnapshot
  __navigationBarTitle__?: string
  __route__: string
  data: Record<string, any>
  options: Record<string, string>
  route: string
  selectAllComponents?: (selector: string) => any[]
  selectComponent?: (selector: string) => any
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
    .replace(ARRAY_INDEX_PATH_RE, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

function isArrayIndexSegment(segment: string) {
  return ARRAY_INDEX_SEGMENT_RE.test(segment)
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

  const leafSegment = segments.at(-1)!
  const normalizedLeafSegment = isArrayIndexSegment(leafSegment) ? Number(leafSegment) : leafSegment
  current[normalizedLeafSegment] = value
}

function normalizeRoute(route: string) {
  return route.replace(LEADING_ROUTE_SLASH_RE, '')
}

export function createPageInstance(
  route: string,
  definition: HeadlessPageDefinition,
  options: Record<string, string> = {},
  pageState: {
    navigationBar?: HeadlessNavigationBarSnapshot
  } = {},
): HeadlessPageInstance {
  const normalizedRoute = normalizeRoute(route)
  const instance: HeadlessPageInstance = {
    __route__: normalizedRoute,
    __navigationBar__: pageState.navigationBar
      ? cloneNavigationBarSnapshot(pageState.navigationBar)
      : undefined,
    __navigationBarTitle__: pageState.navigationBar?.title,
    data: resolveInitialData(definition),
    options: { ...options },
    route: normalizedRoute,
    setData(patch, callback) {
      instance.__lastChangedKeys__ = Object.keys(patch)
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
