import type {
  LocationQuery,
  RouteLocationNormalizedLoaded,
  RouteLocationRedirectedFrom,
  RouteMeta,
  RouteParams,
  RouteParamsMode,
  RouteQueryStringifier,
  RouteRecordMatched,
  RouteRecordRaw,
  UseRouterOptions,
} from '../router'
import type { RouteRecordNormalized, RouteResolveCodec } from './types'
import { createAbsoluteRoutePath, resolvePath } from './path'
import { stringifyQuery } from './query'

export function cloneRouteMeta(meta?: RouteMeta): RouteMeta | undefined {
  if (!meta) {
    return undefined
  }
  return {
    ...meta,
  }
}

function freezeRouteRecordRawSnapshot(routeRecord: RouteRecordRaw): Readonly<RouteRecordRaw> {
  const snapshot: RouteRecordRaw = {
    name: routeRecord.name,
    path: routeRecord.path,
  }

  if (routeRecord.meta !== undefined) {
    snapshot.meta = cloneRouteMeta(routeRecord.meta)
  }
  if (Array.isArray(routeRecord.alias)) {
    snapshot.alias = Object.freeze(routeRecord.alias.slice())
  }
  else if (routeRecord.alias !== undefined) {
    snapshot.alias = routeRecord.alias
  }
  if (Array.isArray(routeRecord.beforeEnter)) {
    snapshot.beforeEnter = Object.freeze(routeRecord.beforeEnter.slice())
  }
  else if (routeRecord.beforeEnter !== undefined) {
    snapshot.beforeEnter = routeRecord.beforeEnter
  }
  if (routeRecord.redirect !== undefined) {
    snapshot.redirect = routeRecord.redirect
  }

  return Object.freeze(snapshot)
}

export function createRouterOptionsSnapshot(
  normalizedTabBarEntries: readonly string[],
  normalizedNamedRoutes: readonly RouteRecordRaw[],
  paramsMode: RouteParamsMode,
  maxRedirects: number,
  routeResolveCodec: RouteResolveCodec,
  rejectOnError: boolean,
): Readonly<UseRouterOptions> {
  const tabBarEntriesSnapshot = Object.freeze(
    normalizedTabBarEntries.map(path => createAbsoluteRoutePath(path)),
  )
  const routesSnapshot = Object.freeze(
    normalizedNamedRoutes.map(freezeRouteRecordRawSnapshot),
  ) as readonly RouteRecordRaw[]

  return Object.freeze({
    tabBarEntries: tabBarEntriesSnapshot,
    routes: routesSnapshot,
    namedRoutes: routesSnapshot,
    paramsMode,
    maxRedirects,
    parseQuery: routeResolveCodec.parseQuery,
    stringifyQuery: routeResolveCodec.stringifyQuery,
    rejectOnError,
  })
}

export function normalizeRouteRecordMatched(
  record: RouteRecordNormalized,
  matchedPath?: string,
): RouteRecordMatched {
  const matchedRecord: RouteRecordMatched = {
    name: record.name,
    path: createAbsoluteRoutePath(record.path),
  }
  const normalizedMatchedPath = typeof matchedPath === 'string' && matchedPath
    ? createAbsoluteRoutePath(resolvePath(matchedPath, ''))
    : undefined
  if (normalizedMatchedPath && normalizedMatchedPath !== matchedRecord.path) {
    matchedRecord.aliasPath = normalizedMatchedPath
  }
  if (record.meta !== undefined) {
    matchedRecord.meta = cloneRouteMeta(record.meta)
  }
  return matchedRecord
}

export function cloneRouteRecordMatchedList(matched?: readonly RouteRecordMatched[]): RouteRecordMatched[] | undefined {
  if (!matched) {
    return undefined
  }
  return matched.map(record => ({
    name: record.name,
    path: record.path,
    aliasPath: record.aliasPath,
    meta: cloneRouteMeta(record.meta),
  }))
}

export function cloneLocationQuery(query: LocationQuery): LocationQuery {
  const cloned: LocationQuery = {}
  for (const key of Object.keys(query)) {
    const value = query[key]
    cloned[key] = Array.isArray(value) ? value.slice() : value
  }
  return cloned
}

export function cloneRouteParams(params: RouteParams): RouteParams {
  const cloned: RouteParams = {}
  for (const key of Object.keys(params)) {
    const value = params[key]
    cloned[key] = Array.isArray(value) ? value.slice() : value
  }
  return cloned
}

export function cloneRouteLocationRedirectedFrom(
  redirectedFrom?: RouteLocationRedirectedFrom,
): RouteLocationRedirectedFrom | undefined {
  if (!redirectedFrom) {
    return undefined
  }

  const cloned: RouteLocationRedirectedFrom = {
    path: redirectedFrom.path,
    fullPath: redirectedFrom.fullPath,
    query: cloneLocationQuery(redirectedFrom.query),
    hash: redirectedFrom.hash,
    params: cloneRouteParams(redirectedFrom.params),
  }
  if (redirectedFrom.name !== undefined) {
    cloned.name = redirectedFrom.name
  }
  if (redirectedFrom.meta !== undefined) {
    cloned.meta = cloneRouteMeta(redirectedFrom.meta)
  }
  if (redirectedFrom.href !== undefined) {
    cloned.href = redirectedFrom.href
  }
  if (redirectedFrom.matched !== undefined) {
    cloned.matched = cloneRouteRecordMatchedList(redirectedFrom.matched)
  }
  return cloned
}

export function createRedirectedFromSnapshot(route: RouteLocationNormalizedLoaded): RouteLocationRedirectedFrom {
  const snapshot: RouteLocationRedirectedFrom = {
    path: route.path,
    fullPath: route.fullPath,
    query: cloneLocationQuery(route.query),
    hash: route.hash,
    params: cloneRouteParams(route.params),
  }
  if (route.name !== undefined) {
    snapshot.name = route.name
  }
  if (route.meta !== undefined) {
    snapshot.meta = cloneRouteMeta(route.meta)
  }
  if (route.href !== undefined) {
    snapshot.href = route.href
  }
  if (route.matched !== undefined) {
    snapshot.matched = cloneRouteRecordMatchedList(route.matched)
  }
  return snapshot
}

export function snapshotRouteLocation(route: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
  const snapshot: RouteLocationNormalizedLoaded = {
    path: route.path,
    fullPath: route.fullPath,
    query: cloneLocationQuery(route.query),
    hash: route.hash,
    params: cloneRouteParams(route.params),
  }
  if (route.meta !== undefined) {
    snapshot.meta = cloneRouteMeta(route.meta)
  }
  if (route.href !== undefined) {
    snapshot.href = route.href
  }
  if (route.matched !== undefined) {
    snapshot.matched = cloneRouteRecordMatchedList(route.matched)
  }
  if (route.redirectedFrom !== undefined) {
    snapshot.redirectedFrom = cloneRouteLocationRedirectedFrom(route.redirectedFrom)
  }
  if (route.name !== undefined) {
    snapshot.name = route.name
  }
  return snapshot
}

export function createNativeRouteUrl(
  target: RouteLocationNormalizedLoaded,
  queryStringifier: RouteQueryStringifier = stringifyQuery,
): string {
  const basePath = createAbsoluteRoutePath(target.path)
  const queryString = queryStringifier(target.query)
  return queryString ? `${basePath}?${queryString}` : basePath
}

export function hasLocationQuery(query: LocationQuery): boolean {
  return Object.keys(query).length > 0
}
