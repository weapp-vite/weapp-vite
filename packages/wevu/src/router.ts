import type {
  RouterNavigateToOption,
  RouterRedirectToOption,
  RouterReLaunchOption,
  RouterSwitchTabOption,
  SetupContextRouter,
  TypedRouterTabBarUrl,
  TypedRouterUrl,
  WevuTypedRouterRouteMap,
} from './runtime/types/props'
import { reactive, readonly } from './reactivity'
import { getCurrentSetupContext, onLoad, onRouteDone, onShow } from './runtime/hooks'
import { usePageRouter, useRouter } from './runtime/vueCompat'

export type LocationQueryValue = string | null
export type LocationQueryValueRaw = LocationQueryValue | number | boolean | undefined
export type LocationQuery = Record<string, LocationQueryValue | LocationQueryValue[]>
export type LocationQueryRaw = Record<string, LocationQueryValueRaw | LocationQueryValueRaw[]>

export type RouteLocationRaw = string | {
  path?: string
  fullPath?: string
  query?: LocationQueryRaw
}

export interface RouteLocationNormalizedLoaded {
  path: string
  fullPath: string
  query: LocationQuery
}

interface MiniProgramPageLike {
  route?: string
  __route__?: string
  options?: Record<string, unknown>
}

function decodeQuerySegment(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '))
}

function encodeQuerySegment(value: string): string {
  return encodeURIComponent(value)
}

function pushQueryValue(target: LocationQuery, key: string, value: LocationQueryValue) {
  const previous = target[key]
  if (previous === undefined) {
    target[key] = value
    return
  }
  if (Array.isArray(previous)) {
    previous.push(value)
    return
  }
  target[key] = [previous, value]
}

function normalizeQueryValue(value: LocationQueryValueRaw): LocationQueryValue | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return String(value)
}

function normalizeQuery(query: LocationQueryRaw | LocationQuery): LocationQuery {
  const normalized: LocationQuery = {}
  for (const key of Object.keys(query)) {
    const rawValue = (query as Record<string, LocationQueryValueRaw | LocationQueryValueRaw[]>)[key]
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const next = normalizeQueryValue(item)
        if (next !== undefined) {
          pushQueryValue(normalized, key, next)
        }
      }
      continue
    }
    const next = normalizeQueryValue(rawValue)
    if (next !== undefined) {
      pushQueryValue(normalized, key, next)
    }
  }
  return normalized
}

function normalizePathSegments(path: string): string[] {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length > 0) {
        segments.pop()
      }
      continue
    }
    segments.push(segment)
  }
  return segments
}

function resolvePath(path: string, currentPath: string): string {
  if (!path) {
    return normalizePathSegments(currentPath).join('/')
  }

  if (path.startsWith('/')) {
    return normalizePathSegments(path).join('/')
  }

  if (path.startsWith('./') || path.startsWith('../')) {
    const baseSegments = normalizePathSegments(currentPath)
    if (baseSegments.length > 0) {
      baseSegments.pop()
    }

    for (const segment of path.split('/')) {
      if (!segment || segment === '.') {
        continue
      }
      if (segment === '..') {
        if (baseSegments.length > 0) {
          baseSegments.pop()
        }
        continue
      }
      baseSegments.push(segment)
    }

    return baseSegments.join('/')
  }

  return normalizePathSegments(path).join('/')
}

function parsePathInput(input: string): { path: string, query: LocationQuery } {
  const hashIndex = input.indexOf('#')
  const withoutHash = hashIndex >= 0 ? input.slice(0, hashIndex) : input
  const queryIndex = withoutHash.indexOf('?')

  if (queryIndex < 0) {
    return {
      path: withoutHash,
      query: {},
    }
  }

  return {
    path: withoutHash.slice(0, queryIndex),
    query: parseQuery(withoutHash.slice(queryIndex + 1)),
  }
}

function createRouteLocation(path: string, query: LocationQuery): RouteLocationNormalizedLoaded {
  const normalizedPath = resolvePath(path, '')
  const queryString = stringifyQuery(query)
  const fullPathBase = normalizedPath ? `/${normalizedPath}` : '/'

  return {
    path: normalizedPath,
    fullPath: queryString ? `${fullPathBase}?${queryString}` : fullPathBase,
    query,
  }
}

function getCurrentMiniProgramPage(): MiniProgramPageLike | undefined {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }

  try {
    const pages = getCurrentPagesFn() as MiniProgramPageLike[]
    if (!Array.isArray(pages) || pages.length === 0) {
      return undefined
    }
    return pages[pages.length - 1]
  }
  catch {
    return undefined
  }
}

function resolveCurrentRoute(queryOverride?: LocationQueryRaw): RouteLocationNormalizedLoaded {
  const currentPage = getCurrentMiniProgramPage()
  if (!currentPage) {
    return createRouteLocation('', {})
  }

  const rawPath = typeof currentPage.route === 'string'
    ? currentPage.route
    : typeof currentPage.__route__ === 'string'
      ? currentPage.__route__
      : ''

  const querySource = queryOverride ?? ((currentPage.options ?? {}) as LocationQueryRaw)
  const query = normalizeQuery(querySource)
  return createRouteLocation(rawPath, query)
}

export function parseQuery(search: string): LocationQuery {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search
  const query: LocationQuery = {}

  if (!normalizedSearch) {
    return query
  }

  for (const segment of normalizedSearch.split('&')) {
    if (!segment) {
      continue
    }

    const equalIndex = segment.indexOf('=')
    const rawKey = equalIndex >= 0 ? segment.slice(0, equalIndex) : segment
    if (!rawKey) {
      continue
    }

    const key = decodeQuerySegment(rawKey)
    const value = equalIndex >= 0
      ? decodeQuerySegment(segment.slice(equalIndex + 1))
      : null

    pushQueryValue(query, key, value)
  }

  return query
}

export function stringifyQuery(query: LocationQueryRaw | LocationQuery = {}): string {
  const normalizedQuery = normalizeQuery(query)
  const segments: string[] = []

  for (const key of Object.keys(normalizedQuery)) {
    const encodedKey = encodeQuerySegment(key)
    const rawValue = normalizedQuery[key]

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (item === null) {
          segments.push(encodedKey)
        }
        else {
          segments.push(`${encodedKey}=${encodeQuerySegment(item)}`)
        }
      }
      continue
    }

    if (rawValue === null) {
      segments.push(encodedKey)
      continue
    }

    segments.push(`${encodedKey}=${encodeQuerySegment(rawValue)}`)
  }

  return segments.join('&')
}

export function resolveRouteLocation(to: RouteLocationRaw, currentPath = ''): RouteLocationNormalizedLoaded {
  if (typeof to === 'string') {
    const parsed = parsePathInput(to)
    const path = resolvePath(parsed.path, currentPath)
    return createRouteLocation(path, parsed.query)
  }

  const parsedFromFullPath = typeof to.fullPath === 'string'
    ? parsePathInput(to.fullPath)
    : undefined

  const rawPath = to.path ?? parsedFromFullPath?.path ?? currentPath
  const path = resolvePath(rawPath, currentPath)
  const query = to.query
    ? normalizeQuery(to.query)
    : parsedFromFullPath?.query ?? {}

  return createRouteLocation(path, query)
}

export function useRoute(): Readonly<RouteLocationNormalizedLoaded> {
  if (!getCurrentSetupContext()) {
    throw new Error('useRoute() 必须在 setup() 的同步阶段调用')
  }

  const currentRoute = resolveCurrentRoute()
  const routeState = reactive<RouteLocationNormalizedLoaded>({
    path: currentRoute.path,
    fullPath: currentRoute.fullPath,
    query: currentRoute.query,
  })

  function syncRoute(queryOverride?: LocationQueryRaw) {
    const nextRoute = resolveCurrentRoute(queryOverride)
    routeState.path = nextRoute.path
    routeState.fullPath = nextRoute.fullPath
    routeState.query = nextRoute.query
  }

  onLoad((query) => {
    syncRoute(query as unknown as LocationQueryRaw)
  })
  onShow(() => {
    syncRoute()
  })
  onRouteDone(() => {
    syncRoute()
  })

  return readonly(routeState) as Readonly<RouteLocationNormalizedLoaded>
}

export type {
  RouterNavigateToOption,
  RouterRedirectToOption,
  RouterReLaunchOption,
  RouterSwitchTabOption,
  SetupContextRouter,
  TypedRouterTabBarUrl,
  TypedRouterUrl,
  WevuTypedRouterRouteMap,
}
export { usePageRouter, useRouter }
