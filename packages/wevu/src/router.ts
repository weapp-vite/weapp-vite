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

export const NavigationFailureType = {
  unknown: 1,
  aborted: 4,
  cancelled: 8,
  duplicated: 16,
} as const

export type NavigationFailureTypeValue = (typeof NavigationFailureType)[keyof typeof NavigationFailureType]

export interface NavigationFailure extends Error {
  readonly __wevuNavigationFailure: true
  readonly type: NavigationFailureTypeValue
  readonly to?: RouteLocationNormalizedLoaded
  readonly from?: RouteLocationNormalizedLoaded
  readonly cause?: unknown
}

export type NavigationMode = 'push' | 'replace' | 'back'
export type NavigationGuardResult = void | boolean | NavigationFailure
export type NavigationGuard = (
  context: NavigationGuardContext,
) => NavigationGuardResult | Promise<NavigationGuardResult>

export interface NavigationGuardContext {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded
  readonly from: RouteLocationNormalizedLoaded
  readonly nativeRouter: SetupContextRouter
}

export interface UseRouterNavigationOptions {
  tabBarEntries?: readonly (TypedRouterTabBarUrl | string)[]
}

export interface RouterNavigation {
  readonly nativeRouter: SetupContextRouter
  resolve: (to: RouteLocationRaw) => RouteLocationNormalizedLoaded
  push: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
  replace: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
  back: (delta?: number) => Promise<void | NavigationFailure>
  beforeEach: (guard: NavigationGuard) => () => void
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

function cloneLocationQuery(query: LocationQuery): LocationQuery {
  const cloned: LocationQuery = {}
  for (const key of Object.keys(query)) {
    const value = query[key]
    cloned[key] = Array.isArray(value) ? value.slice() : value
  }
  return cloned
}

function snapshotRouteLocation(route: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
  return {
    path: route.path,
    fullPath: route.fullPath,
    query: cloneLocationQuery(route.query),
  }
}

function createAbsoluteRoutePath(path: string): string {
  return path ? `/${path}` : '/'
}

function hasLocationQuery(query: LocationQuery): boolean {
  return Object.keys(query).length > 0
}

function normalizeNavigationErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).errMsg
    if (typeof message === 'string') {
      return message
    }
    if (error instanceof Error) {
      return error.message
    }
  }
  return ''
}

function resolveNavigationFailureType(error: unknown): NavigationFailureTypeValue {
  const normalizedMessage = normalizeNavigationErrorMessage(error).toLowerCase()
  if (/already|same|duplicat|重复/.test(normalizedMessage)) {
    return NavigationFailureType.duplicated
  }
  if (/cancel|取消/.test(normalizedMessage)) {
    return NavigationFailureType.cancelled
  }
  if (/abort|interrupt|中断/.test(normalizedMessage)) {
    return NavigationFailureType.aborted
  }
  return NavigationFailureType.unknown
}

export function createNavigationFailure(
  type: NavigationFailureTypeValue,
  to?: RouteLocationNormalizedLoaded,
  from?: RouteLocationNormalizedLoaded,
  cause?: unknown,
): NavigationFailure {
  const message = normalizeNavigationErrorMessage(cause) || 'Navigation failed'
  const error = new Error(message) as NavigationFailure
  ;(error as { __wevuNavigationFailure: true }).__wevuNavigationFailure = true
  ;(error as { type: NavigationFailureTypeValue }).type = type
  ;(error as { to?: RouteLocationNormalizedLoaded }).to = to
  ;(error as { from?: RouteLocationNormalizedLoaded }).from = from
  ;(error as { cause?: unknown }).cause = cause
  return error
}

export function isNavigationFailure(error: unknown, type?: NavigationFailureTypeValue): error is NavigationFailure {
  if (!error || typeof error !== 'object') {
    return false
  }
  const navigationError = error as Partial<NavigationFailure>
  if (navigationError.__wevuNavigationFailure !== true) {
    return false
  }
  if (type === undefined) {
    return true
  }
  return navigationError.type === type
}

async function runNavigationGuards(
  guards: ReadonlySet<NavigationGuard>,
  context: NavigationGuardContext,
): Promise<void | NavigationFailure> {
  for (const guard of guards) {
    try {
      const result = await guard(context)
      if (isNavigationFailure(result)) {
        return result
      }
      if (result === false) {
        return createNavigationFailure(
          NavigationFailureType.aborted,
          context.to,
          context.from,
          'Navigation aborted by guard',
        )
      }
    }
    catch (error) {
      return createNavigationFailure(NavigationFailureType.aborted, context.to, context.from, error)
    }
  }
}

function executeNavigationMethod(
  method: (options: Record<string, any>) => unknown,
  options: Record<string, any>,
  to?: RouteLocationNormalizedLoaded,
  from?: RouteLocationNormalizedLoaded,
): Promise<void | NavigationFailure> {
  return new Promise((resolve) => {
    let settled = false
    const finalize = (result?: void | NavigationFailure) => {
      if (settled) {
        return
      }
      settled = true
      resolve(result)
    }

    try {
      const maybePromise = method({
        ...options,
        success: () => finalize(),
        fail: (error: unknown) => {
          finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error))
        },
      })

      if (maybePromise && typeof (maybePromise as PromiseLike<unknown>).then === 'function') {
        ;(maybePromise as PromiseLike<unknown>).then(
          () => finalize(),
          error => finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error)),
        )
      }
    }
    catch (error) {
      finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error))
    }
  })
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

export function useRouterNavigation(options: UseRouterNavigationOptions = {}): RouterNavigation {
  const nativeRouter = useRouter()
  const route = useRoute()
  const navigationGuards = new Set<NavigationGuard>()
  const tabBarPathSet = new Set(
    (options.tabBarEntries ?? [])
      .map(path => resolvePath(path, ''))
      .filter(Boolean),
  )

  function resolve(to: RouteLocationRaw): RouteLocationNormalizedLoaded {
    return resolveRouteLocation(to, route.path)
  }

  function isTabBarTarget(target: RouteLocationNormalizedLoaded): boolean {
    return tabBarPathSet.has(target.path)
  }

  function beforeEach(guard: NavigationGuard): () => void {
    navigationGuards.add(guard)
    return () => {
      navigationGuards.delete(guard)
    }
  }

  async function push(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    const target = resolveRouteLocation(to, from.path)
    const tabBarTarget = isTabBarTarget(target)
    const duplicated = tabBarTarget ? target.path === from.path : target.fullPath === from.fullPath
    if (duplicated) {
      return Promise.resolve(
        createNavigationFailure(
          NavigationFailureType.duplicated,
          target,
          from,
          'Avoided redundant navigation to current location',
        ),
      )
    }

    if (tabBarTarget && hasLocationQuery(target.query)) {
      return Promise.resolve(
        createNavigationFailure(
          NavigationFailureType.aborted,
          target,
          from,
          'switchTab does not support query parameters',
        ),
      )
    }

    const guardResult = await runNavigationGuards(navigationGuards, {
      mode: 'push',
      to: target,
      from,
      nativeRouter,
    })
    if (guardResult) {
      return guardResult
    }

    if (tabBarTarget) {
      return executeNavigationMethod(
        nativeRouter.switchTab as (options: Record<string, any>) => unknown,
        {
          url: createAbsoluteRoutePath(target.path),
        },
        target,
        from,
      )
    }

    return executeNavigationMethod(
      nativeRouter.navigateTo as (options: Record<string, any>) => unknown,
      {
        url: target.fullPath,
      },
      target,
      from,
    )
  }

  async function replace(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    const target = resolveRouteLocation(to, from.path)
    const tabBarTarget = isTabBarTarget(target)
    const duplicated = tabBarTarget ? target.path === from.path : target.fullPath === from.fullPath
    if (duplicated) {
      return Promise.resolve(
        createNavigationFailure(
          NavigationFailureType.duplicated,
          target,
          from,
          'Avoided redundant navigation to current location',
        ),
      )
    }

    if (tabBarTarget && hasLocationQuery(target.query)) {
      return Promise.resolve(
        createNavigationFailure(
          NavigationFailureType.aborted,
          target,
          from,
          'switchTab does not support query parameters',
        ),
      )
    }

    const guardResult = await runNavigationGuards(navigationGuards, {
      mode: 'replace',
      to: target,
      from,
      nativeRouter,
    })
    if (guardResult) {
      return guardResult
    }

    if (tabBarTarget) {
      return executeNavigationMethod(
        nativeRouter.switchTab as (options: Record<string, any>) => unknown,
        {
          url: createAbsoluteRoutePath(target.path),
        },
        target,
        from,
      )
    }

    return executeNavigationMethod(
      nativeRouter.redirectTo as (options: Record<string, any>) => unknown,
      {
        url: target.fullPath,
      },
      target,
      from,
    )
  }

  async function back(delta = 1): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    const guardResult = await runNavigationGuards(navigationGuards, {
      mode: 'back',
      from,
      nativeRouter,
    })
    if (guardResult) {
      return guardResult
    }
    return executeNavigationMethod(
      nativeRouter.navigateBack as (options: Record<string, any>) => unknown,
      {
        delta,
      },
      undefined,
      from,
    )
  }

  return {
    nativeRouter,
    resolve,
    push,
    replace,
    back,
    beforeEach,
  }
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
