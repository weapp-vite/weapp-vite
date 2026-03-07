import type {
  SetupContextRouter,
  TypedRouterTabBarUrl,
} from '../runtime/types/props'

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
