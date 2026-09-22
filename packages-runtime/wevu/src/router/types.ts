import type { WevuNamedRouteMap } from '../router'
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

export interface WevuNamedRouteDefinition {
  readonly path: string
  readonly meta: RouteMeta
}

/**
 * 显式选择不收窄名称和元信息的兼容路由模式。
 */
export type WevuBroadRouteMap = Record<string, WevuNamedRouteDefinition>

type DeclaredRouteName<TRouteMap extends object> = Extract<keyof TRouteMap, string>
type IsBroadRouteMap<TRouteMap extends object> = [DeclaredRouteName<TRouteMap>] extends [never]
  ? true
  : string extends DeclaredRouteName<TRouteMap>
    ? true
    : false

export type WevuRouteName<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? string
    : DeclaredRouteName<TRouteMap>

export type WevuNamedRoutePath<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = IsBroadRouteMap<TRouteMap> extends true
  ? string
  : TName extends keyof TRouteMap
    ? TRouteMap[TName] extends { readonly path: infer TPath extends string }
      ? TPath
      : never
    : never

export type WevuNamedRouteMeta<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = IsBroadRouteMap<TRouteMap> extends true
  ? RouteMeta
  : TName extends keyof TRouteMap
    ? TRouteMap[TName] extends { readonly meta: infer TMeta extends RouteMeta }
      ? TMeta
      : never
    : never

type StrictRouteRecordMeta<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = keyof WevuNamedRouteMeta<TRouteMap, TName> extends never
  ? Record<string, never>
  : WevuNamedRouteMeta<TRouteMap, TName>

interface RouteLocationRawCommon {
  query?: LocationQueryRaw
  hash?: string
  params?: RouteParamsRaw
}

export type RouteLocationNamedRaw<
  TRouteMap extends object = WevuNamedRouteMap,
  TName extends WevuRouteName<TRouteMap> = WevuRouteName<TRouteMap>,
> = RouteLocationRawCommon & {
  name: TName
  path?: never
  fullPath?: never
}

type RouteLocationPathRaw = RouteLocationRawCommon & {
  name?: never
  path?: string
  fullPath?: string
}

type BroadRouteLocationRaw = string | RouteLocationRawCommon & {
  path?: string
  fullPath?: string
  name?: string
}

export type RouteLocationRaw<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? BroadRouteLocationRaw
    : string | RouteLocationPathRaw | {
      [TName in WevuRouteName<TRouteMap>]: RouteLocationNamedRaw<TRouteMap, TName>
    }[WevuRouteName<TRouteMap>]

interface RouteLocationNormalizedBase<TRouteMap extends object> {
  path: string
  fullPath: string
  query: LocationQuery
  hash: string
  href?: string
  matched?: readonly RouteRecordMatched<TRouteMap>[]
  redirectedFrom?: RouteLocationRedirectedFrom<TRouteMap>
  params: RouteParams
}

type RouteLocationNormalizedUnnamed<TRouteMap extends object>
  = RouteLocationNormalizedBase<TRouteMap> & {
    name?: undefined
    meta?: RouteMeta
  }

type BroadRouteLocationNormalizedLoaded<TRouteMap extends object>
  = RouteLocationNormalizedBase<TRouteMap> & {
    name?: string
    meta?: RouteMeta
  }

export type RouteLocationNormalizedByName<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = TName extends WevuRouteName<TRouteMap>
  ? IsBroadRouteMap<TRouteMap> extends true
    ? (RouteLocationNormalizedBase<TRouteMap> & {
        name: TName
        meta?: RouteMeta
      })
    : (RouteLocationNormalizedBase<TRouteMap> & {
        name: TName
        meta: WevuNamedRouteMeta<TRouteMap, TName>
      })
  : never

export type RouteLocationNormalizedLoaded<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? BroadRouteLocationNormalizedLoaded<WevuBroadRouteMap>
    : RouteLocationNormalizedUnnamed<TRouteMap> | {
      [TName in WevuRouteName<TRouteMap>]: RouteLocationNormalizedByName<TRouteMap, TName>
    }[WevuRouteName<TRouteMap>]

interface RouteLocationRedirectedFromBase<TRouteMap extends object> {
  path: string
  fullPath: string
  query: LocationQuery
  hash: string
  href?: string
  matched?: readonly RouteRecordMatched<TRouteMap>[]
  params: RouteParams
}

type RouteLocationRedirectedFromByName<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = IsBroadRouteMap<TRouteMap> extends true
  ? (RouteLocationRedirectedFromBase<TRouteMap> & {
      name: TName
      meta?: RouteMeta
    })
  : (RouteLocationRedirectedFromBase<TRouteMap> & {
      name: TName
      meta: WevuNamedRouteMeta<TRouteMap, TName>
    })

export type RouteLocationRedirectedFrom<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? (RouteLocationRedirectedFromBase<WevuBroadRouteMap> & {
        name?: string
        meta?: RouteMeta
      })
    : (RouteLocationRedirectedFromBase<TRouteMap> & {
        name?: undefined
        meta?: RouteMeta
      } | {
        [TName in WevuRouteName<TRouteMap>]: RouteLocationRedirectedFromByName<TRouteMap, TName>
      }[WevuRouteName<TRouteMap>])

export const NavigationFailureType = {
  unknown: 1,
  aborted: 4,
  cancelled: 8,
  duplicated: 16,
} as const

export type NavigationFailureTypeValue = (typeof NavigationFailureType)[keyof typeof NavigationFailureType]

export interface NavigationFailure<TRouteMap extends object = WevuNamedRouteMap> extends Error {
  readonly __wevuNavigationFailure: true
  readonly type: NavigationFailureTypeValue
  readonly to?: RouteLocationNormalizedLoaded<TRouteMap>
  readonly from?: RouteLocationNormalizedLoaded<TRouteMap>
  readonly cause?: unknown
}

export type NavigationMode = 'push' | 'replace' | 'back'
export type InitialNavigationMode = 'eager' | 'blocking'

export interface NavigationRedirect<TRouteMap extends object = WevuNamedRouteMap> {
  to: RouteLocationRaw<TRouteMap>
  replace?: boolean
}

export type RouteRecordRedirect<TRouteMap extends object = WevuNamedRouteMap>
  = | RouteLocationRaw<TRouteMap>
    | NavigationRedirect<TRouteMap>
    | ((
      to: RouteLocationNormalizedLoaded<TRouteMap>,
      from: RouteLocationNormalizedLoaded<TRouteMap>,
    ) => RouteLocationRaw<TRouteMap> | NavigationRedirect<TRouteMap> | Promise<RouteLocationRaw<TRouteMap> | NavigationRedirect<TRouteMap>>)

interface RouteRecordCommon<TRouteMap extends object> {
  alias?: string | readonly string[]
  beforeEnter?: NavigationGuard<TRouteMap> | readonly NavigationGuard<TRouteMap>[]
  redirect?: RouteRecordRedirect<TRouteMap>
}

type BroadRouteRecordInput<TRouteMap extends object> = RouteRecordCommon<TRouteMap> & {
  name?: string
  path: string
  meta?: RouteMeta
  children?: readonly RouteRecordInput<TRouteMap>[]
}

type StrictRouteRecordInputByName<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = RouteRecordCommon<TRouteMap> & {
  name: TName
  path: WevuNamedRoutePath<TRouteMap, TName>
  meta: StrictRouteRecordMeta<TRouteMap, TName>
  children?: readonly RouteRecordInput<TRouteMap>[]
}

export type RouteRecordInput<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? BroadRouteRecordInput<TRouteMap>
    : {
        [TName in WevuRouteName<TRouteMap>]: StrictRouteRecordInputByName<TRouteMap, TName>
      }[WevuRouteName<TRouteMap>]

type BroadRouteRecordRaw<TRouteMap extends object> = RouteRecordCommon<TRouteMap> & {
  name: string
  path: string
  meta?: RouteMeta
  children?: readonly RouteRecordRaw<TRouteMap>[]
}

type StrictRouteRecordRawByName<
  TRouteMap extends object,
  TName extends WevuRouteName<TRouteMap>,
> = RouteRecordCommon<TRouteMap> & {
  name: TName
  path: WevuNamedRoutePath<TRouteMap, TName>
  meta: StrictRouteRecordMeta<TRouteMap, TName>
  children?: readonly RouteRecordRaw<TRouteMap>[]
}

export type RouteRecordRaw<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? BroadRouteRecordRaw<TRouteMap>
    : {
        [TName in WevuRouteName<TRouteMap>]: StrictRouteRecordRawByName<TRouteMap, TName>
      }[WevuRouteName<TRouteMap>]

export type NamedRouteRecord<TRouteMap extends object = WevuNamedRouteMap>
  = RouteRecordRaw<TRouteMap> extends infer TRoute
    ? TRoute extends { name: string, path: string }
      ? Pick<TRoute, 'name' | 'path'>
      : never
    : never

export type NamedRoutes<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? Readonly<Record<string, string>> | readonly RouteRecordRaw<TRouteMap>[]
    : readonly RouteRecordRaw<TRouteMap>[]

export type RouteRecordMatched<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? {
        name: string
        path: string
        aliasPath?: string
        meta?: RouteMeta
      }
    : {
        [TName in WevuRouteName<TRouteMap>]: {
          name: TName
          path: string
          aliasPath?: string
          meta: WevuNamedRouteMeta<TRouteMap, TName>
        }
      }[WevuRouteName<TRouteMap>]

export type NavigationGuardResult<TRouteMap extends object = WevuNamedRouteMap>
  = | void
    | boolean
    | NavigationFailure<TRouteMap>
    | RouteLocationRaw<TRouteMap>
    | NavigationRedirect<TRouteMap>

export type NavigationGuard<TRouteMap extends object = WevuNamedRouteMap> = (
  to: RouteLocationNormalizedLoaded<TRouteMap> | undefined,
  from: RouteLocationNormalizedLoaded<TRouteMap>,
  context?: NavigationGuardContext<TRouteMap>,
) => NavigationGuardResult<TRouteMap> | Promise<NavigationGuardResult<TRouteMap>>

export type NavigationAfterEach<TRouteMap extends object = WevuNamedRouteMap> = (
  to: RouteLocationNormalizedLoaded<TRouteMap> | undefined,
  from: RouteLocationNormalizedLoaded<TRouteMap>,
  failure?: NavigationFailure<TRouteMap>,
  context?: NavigationAfterEachContext<TRouteMap>,
) => void | Promise<void>

export interface NavigationGuardContext<TRouteMap extends object = WevuNamedRouteMap> {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded<TRouteMap>
  readonly from: RouteLocationNormalizedLoaded<TRouteMap>
  readonly nativeRouter: SetupContextRouter
}

export interface NavigationAfterEachContext<TRouteMap extends object = WevuNamedRouteMap> {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded<TRouteMap>
  readonly from: RouteLocationNormalizedLoaded<TRouteMap>
  readonly nativeRouter: SetupContextRouter
  readonly failure?: NavigationFailure<TRouteMap>
}

export interface NavigationErrorContext<TRouteMap extends object = WevuNamedRouteMap> {
  readonly mode: NavigationMode
  readonly to?: RouteLocationNormalizedLoaded<TRouteMap>
  readonly from: RouteLocationNormalizedLoaded<TRouteMap>
  readonly nativeRouter: SetupContextRouter
  readonly failure: NavigationFailure<TRouteMap>
}

export type NavigationErrorHandler<TRouteMap extends object = WevuNamedRouteMap> = (
  error: unknown,
  context: NavigationErrorContext<TRouteMap>,
) => void | Promise<void>

export interface UseRouterOptions<TRouteMap extends object = WevuNamedRouteMap> {
  tabBarEntries?: readonly (TypedRouterTabBarUrl | string)[]
  /**
   * Vue Router 对齐入口：推荐使用 `routes`
   */
  routes?: readonly RouteRecordInput<TRouteMap>[]
  /**
   * 兼容入口：支持对象 map 或路由记录数组
   */
  namedRoutes?: NamedRoutes<TRouteMap>
  paramsMode?: RouteParamsMode
  maxRedirects?: number
  /**
   * 首屏导航守卫模式。默认立即挂载页面，只有明确配置 `blocking` 时才等待守卫完成。
   */
  initialNavigationMode?: InitialNavigationMode
  /**
   * blocking 首屏导航守卫的最大等待时间（毫秒），超时后放行页面挂载。
   */
  initialNavigationTimeout?: number
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

export type RouterResolve<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? (to: RouteLocationRaw<TRouteMap>) => RouteLocationNormalizedLoaded<TRouteMap>
    : {
        <TName extends WevuRouteName<TRouteMap>>(
          to: RouteLocationNamedRaw<TRouteMap, TName>,
        ): RouteLocationNormalizedByName<TRouteMap, TName>
        (to: RouteLocationRaw<TRouteMap>): RouteLocationNormalizedLoaded<TRouteMap>
      }

export interface AddRoute<TRouteMap extends object = WevuNamedRouteMap> {
  (route: RouteRecordRaw<TRouteMap>): () => void
  (parentName: WevuRouteName<TRouteMap>, route: RouteRecordRaw<TRouteMap>): () => void
}

export interface RouterNavigation<TRouteMap extends object = WevuNamedRouteMap> {
  readonly nativeRouter: SetupContextRouter
  readonly options: Readonly<UseRouterOptions<TRouteMap>>
  readonly currentRoute: Readonly<RouteLocationNormalizedLoaded<TRouteMap>>
  install: (app?: unknown) => void
  resolve: RouterResolve<TRouteMap>
  isReady: () => Promise<void>
  push: (to: RouteLocationRaw<TRouteMap>) => Promise<void | NavigationFailure<TRouteMap>>
  replace: (to: RouteLocationRaw<TRouteMap>) => Promise<void | NavigationFailure<TRouteMap>>
  back: (delta?: number) => Promise<void | NavigationFailure<TRouteMap>>
  go: (delta: number) => Promise<void | NavigationFailure<TRouteMap>>
  forward: () => Promise<void | NavigationFailure<TRouteMap>>
  hasRoute: (name: WevuRouteName<TRouteMap>) => boolean
  getRoutes: () => readonly RouteRecordRaw<TRouteMap>[]
  addRoute: AddRoute<TRouteMap>
  removeRoute: (name: WevuRouteName<TRouteMap>) => void
  clearRoutes: () => void
  beforeEach: (guard: NavigationGuard<TRouteMap>) => () => void
  beforeResolve: (guard: NavigationGuard<TRouteMap>) => () => void
  afterEach: (hook: NavigationAfterEach<TRouteMap>) => () => void
  onError: (handler: NavigationErrorHandler<TRouteMap>) => () => void
}

export type WevuAutoRoute<TRouteMap extends object = WevuNamedRouteMap>
  = IsBroadRouteMap<TRouteMap> extends true
    ? {
        readonly name: string
        readonly path: string
        readonly meta: RouteMeta
      }
    : {
        [TName in WevuRouteName<TRouteMap>]: {
          readonly name: TName
          readonly path: WevuNamedRoutePath<TRouteMap, TName>
          readonly meta: StrictRouteRecordMeta<TRouteMap, TName>
        }
      }[WevuRouteName<TRouteMap>]
