import type { HeadlessPageDefinition, HeadlessWxMediaQueryObserver } from '../host'
import type { HeadlessBackgroundSnapshot, HeadlessBackgroundTextStyle, HeadlessNavigationBarSnapshot } from '../project/pageConfig'
import type { HeadlessComponentInstance } from './componentInstance'
import { bindComponentPageAttachment } from '../host/componentPageAttachment'
import { cloneBackgroundSnapshot, cloneNavigationBarSnapshot } from '../project/pageConfig'

const ARRAY_INDEX_PATH_RE = /\[(\d+)\]/g
const ARRAY_INDEX_SEGMENT_RE = /^\d+$/
const LEADING_ROUTE_SLASH_RE = /^\/+/

export interface HeadlessPageInstance extends Record<string, any> {
  __background__?: HeadlessBackgroundSnapshot
  __backgroundTextStyle__?: HeadlessBackgroundTextStyle
  __lastChangedKeys__?: string[]
  __navigationBar__?: HeadlessNavigationBarSnapshot
  __navigationBarTitle__?: string
  __route__: string
  __scrollTop__?: number
  data: Record<string, any>
  properties: Record<string, any>
  options: Record<string, string>
  route: string
  createIntersectionObserver?: (options?: Record<string, any>) => any
  createMediaQueryObserver?: () => HeadlessWxMediaQueryObserver
  getTabBar?: () => HeadlessComponentInstance | null
  selectAllComponents?: (selector: string) => any[]
  selectComponent?: (selector: string) => any
  setData: (patch: Record<string, any>, callback?: () => void) => void
}

const pageInstanceIds = new WeakMap<HeadlessPageInstance, number>()
let nextPageInstanceId = 0

export function getPageInstanceId(page: HeadlessPageInstance) {
  let id = pageInstanceIds.get(page)
  if (id === undefined) {
    id = ++nextPageInstanceId
    pageInstanceIds.set(page, id)
  }
  return id
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
    background?: HeadlessBackgroundSnapshot
    backgroundTextStyle?: HeadlessBackgroundTextStyle
    navigationBar?: HeadlessNavigationBarSnapshot
    requestRender?: (callback?: () => void) => void
  } = {},
): HeadlessPageInstance {
  const normalizedRoute = normalizeRoute(route)
  const data = resolveInitialData(definition)
  const instance: HeadlessPageInstance = {
    __background__: pageState.background
      ? cloneBackgroundSnapshot(pageState.background)
      : undefined,
    __backgroundTextStyle__: pageState.background?.textStyle ?? pageState.backgroundTextStyle,
    __route__: normalizedRoute,
    __navigationBar__: pageState.navigationBar
      ? cloneNavigationBarSnapshot(pageState.navigationBar)
      : undefined,
    __navigationBarTitle__: pageState.navigationBar?.title,
    data,
    properties: { ...data },
    options: { ...options },
    route: normalizedRoute,
    setData(patch, callback) {
      instance.__lastChangedKeys__ = Object.keys(patch)
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
        const rootKey = parseDataPath(key)[0]
        if (rootKey) {
          instance.properties[rootKey] = instance.data[rootKey]
        }
      }
      if (pageState.requestRender) {
        pageState.requestRender(callback)
      }
      else {
        callback?.()
      }
    },
  }

  for (const [key, value] of Object.entries(definition)) {
    // options 保存导航参数，properties 是实例数据视图，不能被定义对象覆盖。
    if (key === 'data' || key === 'options' || key === 'properties') {
      continue
    }
    bindFunction(instance, key, value)
  }

  bindComponentPageAttachment(instance, definition)
  return instance
}
