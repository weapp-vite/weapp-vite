import type {
  RouteRecordNormalized,
  RouteResolveCodec,
} from './routerInternal/shared'
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
import {
  assertValidAddRouteInput,
  cloneRouteLocationRedirectedFrom,
  cloneRouteMeta,
  cloneRouteParams,
  createAbsoluteRoutePath,
  createNamedRouteLookup,
  createNamedRouteNameByStaticPath,
  createNativeRouteUrl,
  createRedirectedFromSnapshot,
  createRouteLocation,
  createRouterOptionsSnapshot,
  flattenNamedRouteRecords,
  hasLocationQuery,
  mergeMatchedRouteMeta,
  normalizeHash,
  normalizeQuery,
  normalizeRouteParams,
  normalizeRouteRecordMatched,
  normalizeRouteRecordRaw,
  parsePathInput,
  parseQuery,
  resolveCurrentRoute,
  resolveMatchedRouteRecord,
  resolveNamedRouteLocation,
  resolvePath,
  resolveRouteOptionEntries,
  snapshotRouteLocation,
  stringifyQuery,
  warnDuplicateRouteEntries,
  warnRouteConfig,
} from './routerInternal/shared'
import { getCurrentSetupContext, onLoad, onRouteDone, onShow } from './runtime/hooks'
import {
  useNativePageRouter as useNativePageRouterInternal,
  useNativeRouter as useNativeRouterInternal,
} from './runtime/vueCompat'

export type LocationQueryValue = string | null
export type LocationQueryValueRaw = LocationQueryValue | number | boolean | undefined
export type LocationQuery = Record<string, LocationQueryValue | LocationQueryValue[]>
export type LocationQueryRaw = Record<string, LocationQueryValueRaw | LocationQueryValueRaw[]>
export type RouteParamValue = string
export type RouteParamValueRaw = RouteParamValue | number | boolean | null | undefined
export type RouteParams = Record<string, RouteParamValue | RouteParamValue[]>
export type RouteParamsRaw = Record<string, RouteParamValueRaw | RouteParamValueRaw[]>
export type RouteParamsMode = 'loose' | 'strict'
export type RouteQueryParser = (search: string) => LocationQueryRaw | LocationQuery
export type RouteQueryStringifier = (query: LocationQueryRaw | LocationQuery) => string
export type RouteMeta = Record<string, unknown>
export interface NamedRouteRecord {
  name: string
  path: string
}
export type NamedRoutes = Readonly<Record<string, string>> | readonly RouteRecordRaw[]

export type RouteLocationRaw = string | {
  path?: string
  fullPath?: string
  query?: LocationQueryRaw
  hash?: string
  name?: string
  params?: RouteParamsRaw
}

export interface RouteLocationNormalizedLoaded {
  path: string
  fullPath: string
  query: LocationQuery
  hash: string
  name?: string
  meta?: RouteMeta
  href?: string
  matched?: readonly RouteRecordMatched[]
  redirectedFrom?: RouteLocationRedirectedFrom
  params: RouteParams
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
export interface NavigationRedirect {
  to: RouteLocationRaw
  replace?: boolean
}
export type RouteRecordRedirect = RouteLocationRaw | NavigationRedirect | ((
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
) => RouteLocationRaw | NavigationRedirect | Promise<RouteLocationRaw | NavigationRedirect>)
export interface RouteRecordRaw extends NamedRouteRecord {
  meta?: RouteMeta
  alias?: string | readonly string[]
  children?: readonly RouteRecordRaw[]
  beforeEnter?: NavigationGuard | readonly NavigationGuard[]
  redirect?: RouteRecordRedirect
}

export interface RouteRecordMatched {
  name: string
  path: string
  aliasPath?: string
  meta?: RouteMeta
}

export interface RouteLocationRedirectedFrom {
  path: string
  fullPath: string
  query: LocationQuery
  hash: string
  name?: string
  meta?: RouteMeta
  href?: string
  matched?: readonly RouteRecordMatched[]
  params: RouteParams
}

export type NavigationGuardResult = void | boolean | NavigationFailure | RouteLocationRaw | NavigationRedirect
export type NavigationGuard = (
  to: RouteLocationNormalizedLoaded | undefined,
  from: RouteLocationNormalizedLoaded,
  context?: NavigationGuardContext,
) => NavigationGuardResult | Promise<NavigationGuardResult>
export type NavigationAfterEach = (
  to: RouteLocationNormalizedLoaded | undefined,
  from: RouteLocationNormalizedLoaded,
  failure?: NavigationFailure,
  context?: NavigationAfterEachContext,
) => void | Promise<void>

export interface NavigationGuardContext {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded
  readonly from: RouteLocationNormalizedLoaded
  readonly nativeRouter: SetupContextRouter
}

export interface NavigationAfterEachContext {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded
  readonly from: RouteLocationNormalizedLoaded
  readonly nativeRouter: SetupContextRouter
  readonly failure?: NavigationFailure
}

export interface NavigationErrorContext {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded
  readonly from: RouteLocationNormalizedLoaded
  readonly nativeRouter: SetupContextRouter
  readonly failure: NavigationFailure
}

export type NavigationErrorHandler = (
  error: unknown,
  context: NavigationErrorContext,
) => void | Promise<void>

export interface UseRouterOptions {
  tabBarEntries?: readonly (TypedRouterTabBarUrl | string)[]
  /**
   * Vue Router 对齐入口：推荐使用 `routes`
   */
  routes?: readonly RouteRecordRaw[]
  /**
   * 兼容入口：支持对象 map 或路由记录数组
   */
  namedRoutes?: NamedRoutes
  paramsMode?: RouteParamsMode
  maxRedirects?: number
  parseQuery?: RouteQueryParser
  stringifyQuery?: RouteQueryStringifier
  /**
   * 异常型导航失败时是否以 Promise reject 抛出失败对象。
   *
   * - `true`：更贴近 Vue Router 心智（默认）
   * - `false`：始终以返回值形式携带失败对象
   */
  rejectOnError?: boolean
}

export interface RouterNavigation {
  readonly nativeRouter: SetupContextRouter
  readonly options: Readonly<UseRouterOptions>
  readonly currentRoute: Readonly<RouteLocationNormalizedLoaded>
  install: (app?: unknown) => void
  resolve: (to: RouteLocationRaw) => RouteLocationNormalizedLoaded
  isReady: () => Promise<void>
  push: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
  replace: (to: RouteLocationRaw) => Promise<void | NavigationFailure>
  back: (delta?: number) => Promise<void | NavigationFailure>
  go: (delta: number) => Promise<void | NavigationFailure>
  forward: () => Promise<void | NavigationFailure>
  hasRoute: (name: string) => boolean
  getRoutes: () => readonly RouteRecordRaw[]
  addRoute: AddRoute
  removeRoute: (name: string) => void
  clearRoutes: () => void
  beforeEach: (guard: NavigationGuard) => () => void
  beforeResolve: (guard: NavigationGuard) => () => void
  afterEach: (hook: NavigationAfterEach) => () => void
  onError: (handler: NavigationErrorHandler) => () => void
}

export interface AddRoute {
  (route: RouteRecordRaw): () => void
  (parentName: string, route: RouteRecordRaw): () => void
}

const DEFAULT_ROUTE_RESOLVE_CODEC: RouteResolveCodec = {
  parseQuery,
  stringifyQuery,
}

export { parseQuery, stringifyQuery }

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

interface GuardPipelineContinue {
  status: 'continue'
}

interface GuardPipelineFailure {
  status: 'failure'
  failure: NavigationFailure
}

interface GuardPipelineRedirect {
  status: 'redirect'
  target: RouteLocationNormalizedLoaded
  replace?: boolean
}

type GuardPipelineResult = GuardPipelineContinue | GuardPipelineFailure | GuardPipelineRedirect

function isNavigationRedirectCandidate(value: unknown): value is NavigationRedirect {
  if (!value || typeof value !== 'object') {
    return false
  }
  return 'to' in (value as Record<string, unknown>)
}

function isRouteLocationRawCandidate(value: unknown): value is RouteLocationRaw {
  if (typeof value === 'string') {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return 'path' in candidate
    || 'fullPath' in candidate
    || 'query' in candidate
    || 'hash' in candidate
    || 'name' in candidate
    || 'params' in candidate
}

async function runNavigationGuards(
  guards: ReadonlySet<NavigationGuard>,
  context: NavigationGuardContext,
  resolveRoute: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): Promise<GuardPipelineResult> {
  for (const guard of guards) {
    try {
      const result = await guard(context.to, context.from, context)
      if (isNavigationFailure(result)) {
        return {
          status: 'failure',
          failure: result,
        }
      }
      if (result === false) {
        return {
          status: 'failure',
          failure: createNavigationFailure(
            NavigationFailureType.aborted,
            context.to,
            context.from,
            'Navigation aborted by guard',
          ),
        }
      }
      if (isNavigationRedirectCandidate(result)) {
        if (!context.to) {
          return {
            status: 'failure',
            failure: createNavigationFailure(
              NavigationFailureType.aborted,
              context.to,
              context.from,
              'Redirect is not supported in back navigation guards',
            ),
          }
        }
        return {
          status: 'redirect',
          target: resolveRoute(result.to, context.to.path),
          replace: result.replace,
        }
      }
      if (isRouteLocationRawCandidate(result)) {
        if (!context.to) {
          return {
            status: 'failure',
            failure: createNavigationFailure(
              NavigationFailureType.aborted,
              context.to,
              context.from,
              'Redirect is not supported in back navigation guards',
            ),
          }
        }
        return {
          status: 'redirect',
          target: resolveRoute(result, context.to.path),
        }
      }
    }
    catch (error) {
      return {
        status: 'failure',
        failure: createNavigationFailure(NavigationFailureType.aborted, context.to, context.from, error),
      }
    }
  }
  return { status: 'continue' }
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

interface NavigationRunResult {
  mode: NavigationMode
  from: RouteLocationNormalizedLoaded
  to?: RouteLocationNormalizedLoaded
  failure?: NavigationFailure
}

async function runAfterEachHooks(
  hooks: ReadonlySet<NavigationAfterEach>,
  context: NavigationAfterEachContext,
) {
  for (const hook of hooks) {
    try {
      await hook(context.to, context.from, context.failure, context)
    }
    catch {
      // 忽略 afterEach hook 的异常，避免影响导航主流程。
    }
  }
}

async function runNavigationErrorHooks(
  handlers: ReadonlySet<NavigationErrorHandler>,
  error: unknown,
  context: NavigationErrorContext,
) {
  for (const handler of handlers) {
    try {
      await handler(error, context)
    }
    catch {
      // 忽略 onError 回调中的异常，避免影响导航主流程。
    }
  }
}

function isNativeFailureLikeError(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  const errMsg = (value as Record<string, unknown>).errMsg
  return typeof errMsg === 'string'
}

function shouldEmitNavigationError(failure: NavigationFailure): boolean {
  if (failure.type === NavigationFailureType.unknown) {
    return true
  }
  if (failure.cause instanceof Error) {
    return true
  }
  if (failure.type === NavigationFailureType.aborted && failure.cause !== undefined) {
    if (typeof failure.cause === 'string') {
      return false
    }
    if (isNativeFailureLikeError(failure.cause)) {
      return false
    }
    return true
  }
  return false
}

export function resolveRouteLocation(
  to: RouteLocationRaw,
  currentPath = '',
  codec: RouteResolveCodec = DEFAULT_ROUTE_RESOLVE_CODEC,
): RouteLocationNormalizedLoaded {
  if (typeof to === 'string') {
    const parsed = parsePathInput(to, codec)
    const path = resolvePath(parsed.path, currentPath)
    return createRouteLocation(path, parsed.query, parsed.hash, undefined, {}, codec.stringifyQuery)
  }

  const parsedFromFullPath = typeof to.fullPath === 'string'
    ? parsePathInput(to.fullPath, codec)
    : undefined

  const rawPath = to.path ?? parsedFromFullPath?.path ?? currentPath
  const path = resolvePath(rawPath, currentPath)
  const query = to.query
    ? normalizeQuery(to.query)
    : parsedFromFullPath?.query ?? {}
  const hash = normalizeHash(to.hash ?? parsedFromFullPath?.hash)
  const name = typeof to.name === 'string' ? to.name : undefined
  const params = to.params
    ? normalizeRouteParams(to.params)
    : {}

  return createRouteLocation(path, query, hash, name, params, codec.stringifyQuery)
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
    hash: currentRoute.hash,
    params: currentRoute.params,
    name: currentRoute.name,
  })
  if (currentRoute.meta !== undefined) {
    routeState.meta = currentRoute.meta
  }

  function syncRoute(queryOverride?: LocationQueryRaw) {
    const nextRoute = resolveCurrentRoute(queryOverride)
    routeState.path = nextRoute.path
    routeState.fullPath = nextRoute.fullPath
    routeState.query = nextRoute.query
    routeState.hash = nextRoute.hash
    if (nextRoute.meta === undefined) {
      delete (routeState as Partial<RouteLocationNormalizedLoaded>).meta
    }
    else {
      routeState.meta = nextRoute.meta
    }
    routeState.params = nextRoute.params
    routeState.name = nextRoute.name
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

/**
 * @description 获取当前组件路径语义的原生 Router
 */
export function useNativeRouter(): SetupContextRouter {
  return useNativeRouterInternal()
}

/**
 * @description 获取当前页面路径语义的原生 Page Router
 */
export function useNativePageRouter(): SetupContextRouter {
  return useNativePageRouterInternal()
}

/**
 * @description 获取高阶路由导航器（对齐 Vue Router 心智）
 */
export function useRouter(options: UseRouterOptions = {}): RouterNavigation {
  const nativeRouter = useNativeRouter()
  const route = useRoute()
  const beforeEachGuards = new Set<NavigationGuard>()
  const beforeResolveGuards = new Set<NavigationGuard>()
  const afterEachHooks = new Set<NavigationAfterEach>()
  const errorHandlers = new Set<NavigationErrorHandler>()
  const maxRedirects = options.maxRedirects ?? 10
  const paramsMode = options.paramsMode ?? 'loose'
  const rejectOnError = options.rejectOnError ?? true
  const routeResolveCodec: RouteResolveCodec = {
    parseQuery: options.parseQuery ?? parseQuery,
    stringifyQuery: options.stringifyQuery ?? stringifyQuery,
  }
  const readyPromise = Promise.resolve()
  const routeEntries = resolveRouteOptionEntries(options)
  warnDuplicateRouteEntries(routeEntries)
  const namedRouteLookup = createNamedRouteLookup(routeEntries)
  const normalizedTabBarEntries = (options.tabBarEntries ?? [])
    .map(path => resolvePath(path, ''))
    .filter(Boolean)
  const tabBarPathSet = new Set(normalizedTabBarEntries)
  const normalizedNamedRoutes = Array.from(namedRouteLookup.recordByName.values()).map(normalizeRouteRecordForOutput)
  const routerOptions = createRouterOptionsSnapshot(
    normalizedTabBarEntries,
    normalizedNamedRoutes,
    paramsMode,
    maxRedirects,
    routeResolveCodec,
    rejectOnError,
  )

  function resolveWithCodec(to: RouteLocationRaw, currentPath: string): RouteLocationNormalizedLoaded {
    const rawTo = typeof to === 'string'
      ? to
      : resolveNamedRouteLocation(to, namedRouteLookup, paramsMode)
    const resolved = resolveRouteLocation(rawTo, currentPath, routeResolveCodec)
    resolved.href = resolved.fullPath
    const matchedResult = resolveMatchedRouteRecord(resolved, namedRouteLookup)
    if (matchedResult) {
      const matchedRecord = matchedResult.record
      if (resolved.name === undefined) {
        resolved.name = matchedRecord.name
      }
      const mergedRouteMeta = mergeMatchedRouteMeta(matchedResult.matchedRecords)
      if (mergedRouteMeta !== undefined) {
        resolved.meta = cloneRouteMeta(mergedRouteMeta)
      }
      if (matchedResult.params && Object.keys(resolved.params).length === 0) {
        resolved.params = cloneRouteParams(matchedResult.params)
      }
      resolved.matched = matchedResult.matchedRecords.map((record, index, records) => {
        const leafMatchedPath = index === records.length - 1
          ? matchedResult.matchedPath
          : undefined
        return normalizeRouteRecordMatched(record, leafMatchedPath)
      })
    }
    else {
      resolved.matched = []
    }
    return resolved
  }

  function resolve(to: RouteLocationRaw): RouteLocationNormalizedLoaded {
    return resolveWithCodec(to, route.path)
  }

  function install(_app?: unknown): void {
  }

  function isReady(): Promise<void> {
    return readyPromise
  }

  function hasRoute(name: string): boolean {
    return namedRouteLookup.recordByName.has(name)
  }

  function normalizeRouteRecordForOutput(record: RouteRecordNormalized): RouteRecordRaw {
    const normalizedRoute: RouteRecordRaw = {
      name: record.name,
      path: record.path ? `/${record.path}` : '/',
    }
    if (record.meta !== undefined) {
      normalizedRoute.meta = cloneRouteMeta(record.meta)
    }
    if (record.aliasPaths.length === 1) {
      normalizedRoute.alias = createAbsoluteRoutePath(record.aliasPaths[0])
    }
    else if (record.aliasPaths.length > 1) {
      normalizedRoute.alias = record.aliasPaths.map(aliasPath => createAbsoluteRoutePath(aliasPath))
    }
    if (record.beforeEnterGuards.length === 1) {
      normalizedRoute.beforeEnter = record.beforeEnterGuards[0]
    }
    else if (record.beforeEnterGuards.length > 1) {
      normalizedRoute.beforeEnter = record.beforeEnterGuards.slice()
    }
    if (record.redirect !== undefined) {
      normalizedRoute.redirect = record.redirect
    }
    return normalizedRoute
  }

  function getRoutes(): readonly RouteRecordRaw[] {
    return Array.from(namedRouteLookup.recordByName.values()).map(normalizeRouteRecordForOutput)
  }

  function addRoute(route: RouteRecordRaw): () => void
  function addRoute(parentName: string, route: RouteRecordRaw): () => void
  function addRoute(parentNameOrRoute: string | RouteRecordRaw, maybeRoute?: RouteRecordRaw): () => void {
    const route = typeof parentNameOrRoute === 'string'
      ? maybeRoute
      : parentNameOrRoute
    if (!route) {
      throw new Error('Route record is required when adding a child route')
    }
    assertValidAddRouteInput(route)

    const parentRouteName = typeof parentNameOrRoute === 'string'
      ? parentNameOrRoute
      : undefined
    const parentRouteRecord = parentRouteName
      ? namedRouteLookup.recordByName.get(parentRouteName)
      : undefined
    if (parentRouteName && !parentRouteRecord) {
      throw new Error(`Parent route "${parentRouteName}" is not defined in useRouter({ routes | namedRoutes })`)
    }

    const routeRecords = flattenNamedRouteRecords(
      [route],
      parentRouteRecord?.path,
      parentRouteName,
      parentRouteRecord?.aliasPaths,
      undefined,
      'addRoute',
    )
    if (routeRecords.length === 0) {
      throw new Error('Route name and path are required when adding a named route')
    }
    const addedRoutes: RouteRecordNormalized[] = []
    for (const routeRecord of routeRecords) {
      const normalizedRoute = normalizeRouteRecordRaw(routeRecord.route, routeRecord.parentName)
      if (!normalizedRoute) {
        continue
      }
      const existingRoute = namedRouteLookup.recordByName.get(normalizedRoute.name)
      if (existingRoute) {
        const namesToRemove = collectRouteNamesForRemoval(existingRoute.name, namedRouteLookup.recordByName)
        for (const routeName of namesToRemove) {
          namedRouteLookup.recordByName.delete(routeName)
        }
        warnRouteConfig(
          `addRoute() replaced existing route "${normalizedRoute.name}" (${createAbsoluteRoutePath(existingRoute.path)} -> ${createAbsoluteRoutePath(normalizedRoute.path)}) and removed ${namesToRemove.size - 1} nested route(s)`,
        )
      }
      namedRouteLookup.recordByName.set(normalizedRoute.name, normalizedRoute)
      addedRoutes.push(normalizedRoute)
    }
    namedRouteLookup.nameByStaticPath = createNamedRouteNameByStaticPath(namedRouteLookup.recordByName)

    return () => {
      let changed = false
      for (const addedRoute of addedRoutes) {
        const currentRoute = namedRouteLookup.recordByName.get(addedRoute.name)
        if (currentRoute === addedRoute) {
          namedRouteLookup.recordByName.delete(addedRoute.name)
          changed = true
        }
      }
      if (changed) {
        namedRouteLookup.nameByStaticPath = createNamedRouteNameByStaticPath(namedRouteLookup.recordByName)
      }
    }
  }

  function removeRoute(name: string): void {
    const namesToRemove = collectRouteNamesForRemoval(name, namedRouteLookup.recordByName)
    if (namesToRemove.size === 0) {
      return
    }

    let changed = false
    for (const routeName of namesToRemove) {
      changed = namedRouteLookup.recordByName.delete(routeName) || changed
    }
    if (changed) {
      namedRouteLookup.nameByStaticPath = createNamedRouteNameByStaticPath(namedRouteLookup.recordByName)
    }
  }

  function clearRoutes(): void {
    namedRouteLookup.recordByName.clear()
    namedRouteLookup.nameByStaticPath.clear()
  }

  async function resolveRouteRecordRedirect(
    redirect: RouteRecordRedirect,
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
  ): Promise<{ target: RouteLocationNormalizedLoaded, replace?: boolean }> {
    const redirectResult = typeof redirect === 'function'
      ? await redirect(to, from)
      : redirect

    if (isNavigationRedirectCandidate(redirectResult)) {
      return {
        target: resolveWithCodec(redirectResult.to, to.path),
        replace: redirectResult.replace,
      }
    }

    return {
      target: resolveWithCodec(redirectResult, to.path),
      replace: true,
    }
  }

  function applyRedirectedFrom(
    redirectedTarget: RouteLocationNormalizedLoaded,
    currentTarget: RouteLocationNormalizedLoaded,
  ) {
    const redirectedFrom = currentTarget.redirectedFrom
      ? cloneRouteLocationRedirectedFrom(currentTarget.redirectedFrom)
      : createRedirectedFromSnapshot(currentTarget)
    redirectedTarget.redirectedFrom = redirectedFrom
  }

  function isTabBarTarget(target: RouteLocationNormalizedLoaded): boolean {
    return tabBarPathSet.has(target.path)
  }

  function beforeEach(guard: NavigationGuard): () => void {
    beforeEachGuards.add(guard)
    return () => {
      beforeEachGuards.delete(guard)
    }
  }

  function beforeResolve(guard: NavigationGuard): () => void {
    beforeResolveGuards.add(guard)
    return () => {
      beforeResolveGuards.delete(guard)
    }
  }

  function afterEach(hook: NavigationAfterEach): () => void {
    afterEachHooks.add(hook)
    return () => {
      afterEachHooks.delete(hook)
    }
  }

  function onError(handler: NavigationErrorHandler): () => void {
    errorHandlers.add(handler)
    return () => {
      errorHandlers.delete(handler)
    }
  }

  function createDuplicatedFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
    return createNavigationFailure(
      NavigationFailureType.duplicated,
      target,
      from,
      'Avoided redundant navigation to current location',
    )
  }

  function createTabBarQueryFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
    return createNavigationFailure(
      NavigationFailureType.aborted,
      target,
      from,
      'switchTab does not support query parameters',
    )
  }

  function createTooManyRedirectsFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
    return createNavigationFailure(
      NavigationFailureType.aborted,
      target,
      from,
      `Navigation redirected more than ${maxRedirects} times`,
    )
  }

  function createHashOnlyNavigationFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
    return createNavigationFailure(
      NavigationFailureType.aborted,
      target,
      from,
      'Hash-only navigation is not supported in mini-program router',
    )
  }

  function createForwardNotSupportedFailure(from: RouteLocationNormalizedLoaded): NavigationFailure {
    return createNavigationFailure(
      NavigationFailureType.aborted,
      undefined,
      from,
      'Forward navigation is not supported in mini-program router',
    )
  }

  function createNavigationRunResult(
    mode: NavigationMode,
    from: RouteLocationNormalizedLoaded,
    to?: RouteLocationNormalizedLoaded,
    failure?: NavigationFailure,
  ): NavigationRunResult {
    return {
      mode,
      from,
      to,
      failure,
    }
  }

  async function emitNavigationAfterEach(result: NavigationRunResult): Promise<void> {
    await runAfterEachHooks(afterEachHooks, {
      mode: result.mode,
      to: result.to,
      from: result.from,
      nativeRouter,
      failure: result.failure,
    })

    if (result.failure && shouldEmitNavigationError(result.failure)) {
      await runNavigationErrorHooks(
        errorHandlers,
        result.failure.cause ?? result.failure,
        {
          mode: result.mode,
          to: result.to,
          from: result.from,
          nativeRouter,
          failure: result.failure,
        },
      )
    }
  }

  function shouldRejectNavigationFailure(failure: NavigationFailure): boolean {
    return rejectOnError && shouldEmitNavigationError(failure)
  }

  async function settleNavigationResult(result: NavigationRunResult): Promise<void | NavigationFailure> {
    await emitNavigationAfterEach(result)
    if (result.failure && shouldRejectNavigationFailure(result.failure)) {
      throw result.failure
    }
    return result.failure
  }

  async function navigateWithTarget(
    mode: Exclude<NavigationMode, 'back'>,
    target: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
  ): Promise<NavigationRunResult> {
    let currentTarget = target
    let currentMode: Exclude<NavigationMode, 'back'> = mode
    let redirectCount = 0

    while (true) {
      const tabBarTarget = isTabBarTarget(currentTarget)
      const sameNativeLocation = createNativeRouteUrl(currentTarget, routeResolveCodec.stringifyQuery)
        === createNativeRouteUrl(from, routeResolveCodec.stringifyQuery)
      if (sameNativeLocation && currentTarget.hash !== from.hash) {
        return createNavigationRunResult(currentMode, from, currentTarget, createHashOnlyNavigationFailure(currentTarget, from))
      }

      const duplicated = tabBarTarget
        ? currentTarget.path === from.path
        : currentTarget.fullPath === from.fullPath
      if (duplicated) {
        return createNavigationRunResult(currentMode, from, currentTarget, createDuplicatedFailure(currentTarget, from))
      }

      if (tabBarTarget && hasLocationQuery(currentTarget.query)) {
        return createNavigationRunResult(currentMode, from, currentTarget, createTabBarQueryFailure(currentTarget, from))
      }

      const beforeEachResult = await runNavigationGuards(beforeEachGuards, {
        mode: currentMode,
        to: currentTarget,
        from,
        nativeRouter,
      }, resolveWithCodec)

      if (beforeEachResult.status === 'failure') {
        return createNavigationRunResult(currentMode, from, currentTarget, beforeEachResult.failure)
      }
      if (beforeEachResult.status === 'redirect') {
        const redirectedTarget = beforeEachResult.target
        const redirectedMode = beforeEachResult.replace === true
          ? 'replace'
          : beforeEachResult.replace === false
            ? 'push'
            : currentMode
        if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
          applyRedirectedFrom(redirectedTarget, currentTarget)
          currentTarget = redirectedTarget
          currentMode = redirectedMode
          redirectCount += 1
          if (redirectCount > maxRedirects) {
            return createNavigationRunResult(currentMode, from, currentTarget, createTooManyRedirectsFailure(currentTarget, from))
          }
          continue
        }
      }

      const matchedRouteResult = resolveMatchedRouteRecord(currentTarget, namedRouteLookup)
      const matchedRouteRecords = matchedRouteResult?.matchedRecords ?? []
      let redirectedByRouteRecord = false
      for (const matchedRouteRecord of matchedRouteRecords) {
        if (matchedRouteRecord.redirect === undefined) {
          continue
        }
        let redirectedByRecord: { target: RouteLocationNormalizedLoaded, replace?: boolean }
        try {
          redirectedByRecord = await resolveRouteRecordRedirect(matchedRouteRecord.redirect, currentTarget, from)
        }
        catch (error) {
          return createNavigationRunResult(
            currentMode,
            from,
            currentTarget,
            createNavigationFailure(NavigationFailureType.aborted, currentTarget, from, error),
          )
        }

        const redirectedMode = redirectedByRecord.replace === false ? 'push' : 'replace'
        const redirectedTarget = redirectedByRecord.target
        if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
          applyRedirectedFrom(redirectedTarget, currentTarget)
          currentTarget = redirectedTarget
          currentMode = redirectedMode
          redirectCount += 1
          if (redirectCount > maxRedirects) {
            return createNavigationRunResult(currentMode, from, currentTarget, createTooManyRedirectsFailure(currentTarget, from))
          }
          redirectedByRouteRecord = true
          break
        }
      }
      if (redirectedByRouteRecord) {
        continue
      }

      let redirectedByBeforeEnter = false
      for (const matchedRouteRecord of matchedRouteRecords) {
        if (matchedRouteRecord.beforeEnterGuards.length === 0) {
          continue
        }
        const beforeEnterResult = await runNavigationGuards(new Set(matchedRouteRecord.beforeEnterGuards), {
          mode: currentMode,
          to: currentTarget,
          from,
          nativeRouter,
        }, resolveWithCodec)

        if (beforeEnterResult.status === 'failure') {
          return createNavigationRunResult(currentMode, from, currentTarget, beforeEnterResult.failure)
        }
        if (beforeEnterResult.status === 'redirect') {
          const redirectedTarget = beforeEnterResult.target
          const redirectedMode = beforeEnterResult.replace === true
            ? 'replace'
            : beforeEnterResult.replace === false
              ? 'push'
              : currentMode
          if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
            applyRedirectedFrom(redirectedTarget, currentTarget)
            currentTarget = redirectedTarget
            currentMode = redirectedMode
            redirectCount += 1
            if (redirectCount > maxRedirects) {
              return createNavigationRunResult(currentMode, from, currentTarget, createTooManyRedirectsFailure(currentTarget, from))
            }
            redirectedByBeforeEnter = true
            break
          }
        }
      }
      if (redirectedByBeforeEnter) {
        continue
      }

      const beforeResolveResult = await runNavigationGuards(beforeResolveGuards, {
        mode: currentMode,
        to: currentTarget,
        from,
        nativeRouter,
      }, resolveWithCodec)

      if (beforeResolveResult.status === 'failure') {
        return createNavigationRunResult(currentMode, from, currentTarget, beforeResolveResult.failure)
      }
      if (beforeResolveResult.status === 'redirect') {
        const redirectedTarget = beforeResolveResult.target
        const redirectedMode = beforeResolveResult.replace === true
          ? 'replace'
          : beforeResolveResult.replace === false
            ? 'push'
            : currentMode
        if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
          applyRedirectedFrom(redirectedTarget, currentTarget)
          currentTarget = redirectedTarget
          currentMode = redirectedMode
          redirectCount += 1
          if (redirectCount > maxRedirects) {
            return createNavigationRunResult(currentMode, from, currentTarget, createTooManyRedirectsFailure(currentTarget, from))
          }
          continue
        }
      }

      if (tabBarTarget) {
        const result = await executeNavigationMethod(
          nativeRouter.switchTab as (options: Record<string, any>) => unknown,
          {
            url: createAbsoluteRoutePath(currentTarget.path),
          },
          currentTarget,
          from,
        )
        if (isNavigationFailure(result)) {
          return createNavigationRunResult(currentMode, from, currentTarget, result)
        }
        return createNavigationRunResult(currentMode, from, currentTarget)
      }

      const nativeMethod = currentMode === 'push'
        ? nativeRouter.navigateTo
        : nativeRouter.redirectTo

      const result = await executeNavigationMethod(
        nativeMethod as (options: Record<string, any>) => unknown,
        {
          url: createNativeRouteUrl(currentTarget, routeResolveCodec.stringifyQuery),
        },
        currentTarget,
        from,
      )
      if (isNavigationFailure(result)) {
        return createNavigationRunResult(currentMode, from, currentTarget, result)
      }
      return createNavigationRunResult(currentMode, from, currentTarget)
    }
  }

  async function push(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    let target: RouteLocationNormalizedLoaded
    try {
      target = resolveWithCodec(to, from.path)
    }
    catch (error) {
      const result = createNavigationRunResult(
        'push',
        from,
        undefined,
        createNavigationFailure(NavigationFailureType.unknown, undefined, from, error),
      )
      return settleNavigationResult(result)
    }
    const result = await navigateWithTarget('push', target, from)
    return settleNavigationResult(result)
  }

  async function replace(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    let target: RouteLocationNormalizedLoaded
    try {
      target = resolveWithCodec(to, from.path)
    }
    catch (error) {
      const result = createNavigationRunResult(
        'replace',
        from,
        undefined,
        createNavigationFailure(NavigationFailureType.unknown, undefined, from, error),
      )
      return settleNavigationResult(result)
    }
    const result = await navigateWithTarget('replace', target, from)
    return settleNavigationResult(result)
  }

  async function back(delta = 1): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    const beforeEachResult = await runNavigationGuards(beforeEachGuards, {
      mode: 'back',
      from,
      nativeRouter,
    }, resolveWithCodec)
    if (beforeEachResult.status === 'failure') {
      const result = createNavigationRunResult('back', from, undefined, beforeEachResult.failure)
      return settleNavigationResult(result)
    }
    if (beforeEachResult.status === 'redirect') {
      const result = createNavigationRunResult(
        'back',
        from,
        undefined,
        createNavigationFailure(
          NavigationFailureType.aborted,
          undefined,
          from,
          'Redirect is not supported in back navigation guards',
        ),
      )
      return settleNavigationResult(result)
    }

    const beforeResolveResult = await runNavigationGuards(beforeResolveGuards, {
      mode: 'back',
      from,
      nativeRouter,
    }, resolveWithCodec)
    if (beforeResolveResult.status === 'failure') {
      const result = createNavigationRunResult('back', from, undefined, beforeResolveResult.failure)
      return settleNavigationResult(result)
    }
    if (beforeResolveResult.status === 'redirect') {
      const result = createNavigationRunResult(
        'back',
        from,
        undefined,
        createNavigationFailure(
          NavigationFailureType.aborted,
          undefined,
          from,
          'Redirect is not supported in back navigation guards',
        ),
      )
      return settleNavigationResult(result)
    }

    const result = await executeNavigationMethod(
      nativeRouter.navigateBack as (options: Record<string, any>) => unknown,
      {
        delta,
      },
      undefined,
      from,
    )
    const runResult = isNavigationFailure(result)
      ? createNavigationRunResult('back', from, undefined, result)
      : createNavigationRunResult('back', from)
    return settleNavigationResult(runResult)
  }

  async function go(delta: number): Promise<void | NavigationFailure> {
    if (delta < 0) {
      return back(Math.abs(delta))
    }

    if (delta === 0) {
      return undefined
    }

    const from = snapshotRouteLocation(route)
    const result = createNavigationRunResult(
      'back',
      from,
      undefined,
      createForwardNotSupportedFailure(from),
    )
    return settleNavigationResult(result)
  }

  async function forward(): Promise<void | NavigationFailure> {
    return go(1)
  }

  return {
    nativeRouter,
    options: routerOptions,
    currentRoute: route,
    install,
    resolve,
    isReady,
    push,
    replace,
    back,
    go,
    forward,
    hasRoute,
    getRoutes,
    addRoute,
    removeRoute,
    clearRoutes,
    beforeEach,
    beforeResolve,
    afterEach,
    onError,
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
