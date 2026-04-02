import type {
  NavigationGuard,
  RouteMeta,
  RouteParams,
  RouteQueryParser,
  RouteQueryStringifier,
  RouteRecordRaw,
  RouteRecordRedirect,
} from '../router'

export interface MiniProgramPageLike {
  route?: string
  __route__?: string
  options?: Record<string, unknown>
}

export interface RouteResolveCodec {
  parseQuery: RouteQueryParser
  stringifyQuery: RouteQueryStringifier
}

export interface RouteRecordNormalized {
  name: string
  path: string
  aliasPaths: readonly string[]
  parentName?: string
  meta?: RouteMeta
  beforeEnterGuards: readonly NavigationGuard[]
  redirect?: RouteRecordRedirect
}

export interface NamedRouteLookup {
  recordByName: Map<string, RouteRecordNormalized>
  nameByStaticPath: Map<string, string>
}

export type RouteOptionSource = 'routes' | 'namedRoutes'

export interface PathParamToken {
  key: string
  modifier: '' | '?' | '+' | '*'
}

export interface NamedRoutePathResolveResult {
  path: string
  consumedKeys: ReadonlySet<string>
}

export interface FlattenedRouteRecordSeed {
  route: RouteRecordRaw
  parentName?: string
  source?: RouteOptionSource
}

export interface MatchedRouteRecordResolveResult {
  record: RouteRecordNormalized
  matchedRecords: readonly RouteRecordNormalized[]
  matchedPath?: string
  params?: RouteParams
}
