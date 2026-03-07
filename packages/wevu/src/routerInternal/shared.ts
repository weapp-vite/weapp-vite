import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw,
  NamedRoutes,
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  RouteLocationRedirectedFrom,
  RouteMeta,
  RouteParams,
  RouteParamsMode,
  RouteParamsRaw,
  RouteParamValue,
  RouteParamValueRaw,
  RouteQueryParser,
  RouteQueryStringifier,
  RouteRecordMatched,
  RouteRecordRaw,
  RouteRecordRedirect,
  UseRouterOptions,
} from '../router'

interface MiniProgramPageLike {
  route?: string
  __route__?: string
  options?: Record<string, unknown>
}

interface RouteResolveCodec {
  parseQuery: RouteQueryParser
  stringifyQuery: RouteQueryStringifier
}

interface RouteRecordNormalized {
  name: string
  path: string
  aliasPaths: readonly string[]
  parentName?: string
  meta?: RouteMeta
  beforeEnterGuards: readonly NavigationGuard[]
  redirect?: RouteRecordRedirect
}

interface NamedRouteLookup {
  recordByName: Map<string, RouteRecordNormalized>
  nameByStaticPath: Map<string, string>
}

type RouteOptionSource = 'routes' | 'namedRoutes'

interface PathParamToken {
  key: string
  modifier: '' | '?' | '+' | '*'
}

interface NamedRoutePathResolveResult {
  path: string
  consumedKeys: ReadonlySet<string>
}

interface FlattenedRouteRecordSeed {
  route: RouteRecordRaw
  parentName?: string
  source?: RouteOptionSource
}

interface MatchedRouteRecordResolveResult {
  record: RouteRecordNormalized
  matchedRecords: readonly RouteRecordNormalized[]
  matchedPath?: string
  params?: RouteParams
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

function pushRouteParamValue(target: RouteParams, key: string, value: RouteParamValue) {
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

function normalizeRouteParamValue(value: RouteParamValueRaw): RouteParamValue | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  return String(value)
}

function normalizeRouteParams(params: RouteParamsRaw | RouteParams): RouteParams {
  const normalized: RouteParams = {}
  for (const key of Object.keys(params)) {
    const rawValue = (params as Record<string, RouteParamValueRaw | RouteParamValueRaw[]>)[key]
    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const next = normalizeRouteParamValue(item)
        if (next !== undefined) {
          pushRouteParamValue(normalized, key, next)
        }
      }
      continue
    }
    const next = normalizeRouteParamValue(rawValue)
    if (next !== undefined) {
      pushRouteParamValue(normalized, key, next)
    }
  }
  return normalized
}

function normalizeHash(rawHash?: string): string {
  if (!rawHash) {
    return ''
  }
  return rawHash.startsWith('#') ? rawHash : `#${rawHash}`
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

const DEFAULT_ROUTE_RESOLVE_CODEC: RouteResolveCodec = {
  parseQuery,
  stringifyQuery,
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

function isDynamicRoutePath(path: string): boolean {
  return /(?:^|\/):/.test(path)
}

function normalizeBeforeEnterGuards(beforeEnter?: RouteRecordRaw['beforeEnter']): readonly NavigationGuard[] {
  if (!beforeEnter) {
    return []
  }
  if (Array.isArray(beforeEnter)) {
    return beforeEnter
  }
  return [beforeEnter]
}

function normalizeRouteRecordRaw(route: RouteRecordRaw, parentName?: string): RouteRecordNormalized | undefined {
  const routeName = route.name.trim()
  if (!routeName) {
    return undefined
  }

  const normalizedPath = resolvePath(route.path, '')
  if (!normalizedPath) {
    return undefined
  }
  const aliasPaths = normalizeRouteRecordAliasPaths(route.alias, normalizedPath)

  return {
    name: routeName,
    path: normalizedPath,
    aliasPaths,
    parentName,
    meta: route.meta,
    beforeEnterGuards: normalizeBeforeEnterGuards(route.beforeEnter),
    redirect: route.redirect,
  }
}

function normalizeRouteRecordAliasPaths(
  alias: RouteRecordRaw['alias'],
  normalizedPath: string,
): readonly string[] {
  if (!alias) {
    return []
  }
  const aliasList = Array.isArray(alias)
    ? alias
    : [alias]

  const normalizedAliasPaths: string[] = []
  for (const aliasPath of aliasList) {
    if (typeof aliasPath !== 'string') {
      continue
    }
    const normalizedAliasPath = resolvePath(aliasPath, '')
    if (!normalizedAliasPath || normalizedAliasPath === normalizedPath) {
      continue
    }
    if (!normalizedAliasPaths.includes(normalizedAliasPath)) {
      normalizedAliasPaths.push(normalizedAliasPath)
    }
  }

  return normalizedAliasPaths
}

function normalizeNamedRouteEntries(
  namedRoutes?: NamedRoutes,
  source: RouteOptionSource = 'namedRoutes',
): FlattenedRouteRecordSeed[] {
  if (!namedRoutes) {
    return []
  }

  if (Array.isArray(namedRoutes)) {
    return flattenNamedRouteRecords(namedRoutes, undefined, undefined, [], source, source)
  }

  const normalizedEntries: FlattenedRouteRecordSeed[] = []
  for (const [rawName, rawPath] of Object.entries(namedRoutes)) {
    const routeName = typeof rawName === 'string'
      ? rawName.trim()
      : ''
    if (!routeName) {
      warnRouteConfig(`ignored route record at ${source}: route name is required`)
      continue
    }
    if (typeof rawPath !== 'string' || !rawPath) {
      warnRouteConfig(`ignored route record "${routeName}" at ${source}: route path is required`)
      continue
    }
    normalizedEntries.push({
      route: {
        name: routeName,
        path: rawPath,
      },
      source,
    })
  }

  return normalizedEntries
}

function resolveRouteOptionEntries(options: UseRouterOptions): FlattenedRouteRecordSeed[] {
  return [
    ...normalizeNamedRouteEntries(options.routes, 'routes'),
    ...normalizeNamedRouteEntries(options.namedRoutes, 'namedRoutes'),
  ]
}

function normalizeNestedRoutePath(path: string, parentPath?: string): string {
  if (!parentPath || path.startsWith('/')) {
    return resolvePath(path, '')
  }
  return resolvePath(`${createAbsoluteRoutePath(parentPath)}/${path}`, '')
}

function normalizeAliasInputList(alias: RouteRecordRaw['alias']): string[] {
  if (!alias) {
    return []
  }
  if (Array.isArray(alias)) {
    return alias.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  return typeof alias === 'string' && alias.length > 0
    ? [alias]
    : []
}

function mergeAliasPaths(aliasPaths: readonly string[]): string[] {
  const mergedAliasPaths: string[] = []
  for (const aliasPath of aliasPaths) {
    if (!aliasPath || mergedAliasPaths.includes(aliasPath)) {
      continue
    }
    mergedAliasPaths.push(aliasPath)
  }
  return mergedAliasPaths
}

function createRouteRecordAliasValue(aliasPaths: readonly string[]): RouteRecordRaw['alias'] {
  if (aliasPaths.length === 0) {
    return undefined
  }
  if (aliasPaths.length === 1) {
    return createAbsoluteRoutePath(aliasPaths[0])
  }
  return aliasPaths.map(aliasPath => createAbsoluteRoutePath(aliasPath))
}

function flattenNamedRouteRecords(
  records: readonly RouteRecordRaw[],
  parentPath?: string,
  parentName?: string,
  parentAliasPaths: readonly string[] = [],
  source?: RouteOptionSource,
  pathPrefix = 'namedRoutes',
  ancestorRecords: ReadonlySet<RouteRecordRaw> = new Set<RouteRecordRaw>(),
): FlattenedRouteRecordSeed[] {
  const flattenedRecords: FlattenedRouteRecordSeed[] = []

  for (const [index, record] of records.entries()) {
    const routeConfigPath = `${pathPrefix}[${index}]`
    if (ancestorRecords.has(record)) {
      warnRouteConfig(`ignored route record at ${routeConfigPath}: detected circular children reference`)
      continue
    }

    const routeName = typeof record?.name === 'string'
      ? record.name.trim()
      : ''
    if (!routeName) {
      warnRouteConfig(`ignored route record at ${routeConfigPath}: route name is required`)
      continue
    }
    if (typeof record.path !== 'string' || !record.path) {
      warnRouteConfig(`ignored route record "${routeName}" at ${routeConfigPath}: route path is required`)
      continue
    }

    const normalizedPath = normalizeNestedRoutePath(record.path, parentPath)
    const normalizedDirectAliasPaths: string[] = []
    const directAliasByNormalizedPath = new Map<string, string>()
    for (const rawAliasPath of normalizeAliasInputList(record.alias)) {
      const normalizedAliasPath = normalizeNestedRoutePath(rawAliasPath, parentPath)
      if (!normalizedAliasPath) {
        continue
      }
      if (normalizedAliasPath === normalizedPath) {
        warnRouteConfig(`ignored alias "${createAbsoluteRoutePath(normalizedAliasPath)}" for route "${routeName}" at ${routeConfigPath}: alias is same as route path`)
        continue
      }

      const duplicateAliasPath = directAliasByNormalizedPath.get(normalizedAliasPath)
      if (duplicateAliasPath) {
        warnRouteConfig(
          `ignored duplicate alias "${createAbsoluteRoutePath(normalizedAliasPath)}" for route "${routeName}" at ${routeConfigPath}: already declared by "${duplicateAliasPath}"`,
        )
        continue
      }

      directAliasByNormalizedPath.set(normalizedAliasPath, rawAliasPath)
      normalizedDirectAliasPaths.push(normalizedAliasPath)
    }
    const normalizedInheritedAliasPaths = record.path.startsWith('/')
      ? []
      : parentAliasPaths
          .map(parentAliasPath => normalizeNestedRoutePath(record.path, parentAliasPath))
          .filter(Boolean)
          .filter(aliasPath => aliasPath !== normalizedPath)
    const normalizedAliasPaths = mergeAliasPaths([
      ...normalizedDirectAliasPaths,
      ...normalizedInheritedAliasPaths,
    ])
    const normalizedRecord: RouteRecordRaw = {
      ...record,
      name: routeName,
      path: normalizedPath ? createAbsoluteRoutePath(normalizedPath) : '/',
      alias: createRouteRecordAliasValue(normalizedAliasPaths),
    }
    flattenedRecords.push({
      route: normalizedRecord,
      parentName,
      source,
    })

    if (Array.isArray(record.children) && record.children.length > 0) {
      const nextAncestorRecords = new Set(ancestorRecords)
      nextAncestorRecords.add(record)
      flattenedRecords.push(
        ...flattenNamedRouteRecords(
          record.children,
          normalizedPath,
          routeName,
          normalizedAliasPaths,
          source,
          `${routeConfigPath}.children`,
          nextAncestorRecords,
        ),
      )
    }
  }

  return flattenedRecords
}

function createNamedRouteNameByStaticPath(recordByName: ReadonlyMap<string, RouteRecordNormalized>): Map<string, string> {
  const nameByStaticPath = new Map<string, string>()
  for (const [name, record] of recordByName.entries()) {
    if (!isDynamicRoutePath(record.path) && !nameByStaticPath.has(record.path)) {
      nameByStaticPath.set(record.path, name)
    }
    for (const aliasPath of record.aliasPaths) {
      if (!isDynamicRoutePath(aliasPath) && !nameByStaticPath.has(aliasPath)) {
        nameByStaticPath.set(aliasPath, name)
      }
    }
  }
  return nameByStaticPath
}

function warnRouteConfig(message: string): void {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') {
    return
  }
  console.warn(`[wevu/router] ${message}`)
}

function formatRoutePathForWarning(path: string): string {
  const normalizedPath = resolvePath(path, '')
  if (!normalizedPath) {
    return '/'
  }
  return createAbsoluteRoutePath(normalizedPath)
}

function hasCircularChildrenReference(
  routeRecord: RouteRecordRaw,
  ancestorRecords: ReadonlySet<RouteRecordRaw> = new Set<RouteRecordRaw>(),
): boolean {
  if (ancestorRecords.has(routeRecord)) {
    return true
  }

  if (!Array.isArray(routeRecord.children) || routeRecord.children.length === 0) {
    return false
  }

  const nextAncestorRecords = new Set(ancestorRecords)
  nextAncestorRecords.add(routeRecord)
  for (const childRecord of routeRecord.children) {
    if (hasCircularChildrenReference(childRecord, nextAncestorRecords)) {
      return true
    }
  }

  return false
}

function assertValidAddRouteInput(routeRecord: RouteRecordRaw): void {
  const routeName = typeof routeRecord.name === 'string'
    ? routeRecord.name.trim()
    : ''
  if (!routeName) {
    throw new Error('Route name is required when adding a named route')
  }
  if (typeof routeRecord.path !== 'string' || !routeRecord.path) {
    throw new Error(`Route path is required when adding named route "${routeName}"`)
  }
  if (hasCircularChildrenReference(routeRecord)) {
    throw new Error(`Circular children reference detected when adding named route "${routeName}"`)
  }
}

function warnDuplicateRouteEntries(routeEntries: readonly FlattenedRouteRecordSeed[]): void {
  const latestRouteInfoByName = new Map<string, { source: RouteOptionSource, path: string }>()
  const duplicateMessages: string[] = []

  for (const routeEntry of routeEntries) {
    const routeName = routeEntry.route.name.trim()
    if (!routeName) {
      continue
    }

    const currentSource = routeEntry.source ?? 'namedRoutes'
    const currentPath = formatRoutePathForWarning(routeEntry.route.path)
    const previousInfo = latestRouteInfoByName.get(routeName)
    if (previousInfo) {
      duplicateMessages.push(`"${routeName}" (${previousInfo.source}:${previousInfo.path} -> ${currentSource}:${currentPath})`)
    }
    latestRouteInfoByName.set(routeName, {
      source: currentSource,
      path: currentPath,
    })
  }

  if (duplicateMessages.length === 0) {
    return
  }

  warnRouteConfig(`duplicate route names detected, later entries override earlier ones: ${duplicateMessages.join(', ')}`)
}

function createNamedRouteLookup(routeEntries: readonly FlattenedRouteRecordSeed[]): NamedRouteLookup {
  const recordByName = new Map<string, RouteRecordNormalized>()

  for (const routeRecord of routeEntries) {
    const normalizedRecord = normalizeRouteRecordRaw(routeRecord.route, routeRecord.parentName)
    if (!normalizedRecord) {
      continue
    }
    recordByName.set(normalizedRecord.name, normalizedRecord)
  }

  return {
    recordByName,
    nameByStaticPath: createNamedRouteNameByStaticPath(recordByName),
  }
}

function parsePathParamToken(segment: string): PathParamToken | undefined {
  const match = /^:(\w+)(?:\([^)]*\))?([+*?])?$/.exec(segment)
  if (!match) {
    return undefined
  }

  return {
    key: match[1],
    modifier: (match[2] ?? '') as PathParamToken['modifier'],
  }
}

function normalizePathParamValues(value: RouteParamValue | RouteParamValue[] | undefined): RouteParamValue[] {
  if (value === undefined) {
    return []
  }
  if (Array.isArray(value)) {
    return value
  }
  return [value]
}

function stringifyPathParamSegment(value: RouteParamValue): string {
  return encodeURIComponent(value)
}

function decodeRouteParamSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function resolveNamedRoutePath(pathTemplate: string, params: RouteParams, routeName: string): NamedRoutePathResolveResult {
  const resolvedSegments: string[] = []
  const consumedKeys = new Set<string>()
  for (const rawSegment of pathTemplate.split('/')) {
    if (!rawSegment) {
      continue
    }

    const token = parsePathParamToken(rawSegment)
    if (!token) {
      resolvedSegments.push(rawSegment)
      continue
    }

    const values = normalizePathParamValues(params[token.key])
    if (token.modifier === '') {
      if (values.length !== 1) {
        throw new Error(`Missing required param "${token.key}" for named route "${routeName}"`)
      }
      consumedKeys.add(token.key)
      resolvedSegments.push(stringifyPathParamSegment(values[0]))
      continue
    }

    if (token.modifier === '?') {
      if (values.length === 0) {
        continue
      }
      if (values.length > 1) {
        throw new Error(`Param "${token.key}" for named route "${routeName}" must be a single value`)
      }
      consumedKeys.add(token.key)
      resolvedSegments.push(stringifyPathParamSegment(values[0]))
      continue
    }

    if (token.modifier === '+') {
      if (values.length === 0) {
        throw new Error(`Missing required repeatable param "${token.key}" for named route "${routeName}"`)
      }
      consumedKeys.add(token.key)
      for (const value of values) {
        resolvedSegments.push(stringifyPathParamSegment(value))
      }
      continue
    }

    if (values.length > 0) {
      consumedKeys.add(token.key)
    }
    for (const value of values) {
      resolvedSegments.push(stringifyPathParamSegment(value))
    }
  }

  return {
    path: resolvedSegments.join('/'),
    consumedKeys,
  }
}

function hasNonEmptyRouteParamValue(value: RouteParamValue | RouteParamValue[] | undefined): boolean {
  if (value === undefined) {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

function assertNoUnexpectedNamedRouteParams(
  params: RouteParams,
  consumedKeys: ReadonlySet<string>,
  routeName: string,
) {
  const unexpectedKeys = Object.keys(params)
    .filter(key => !consumedKeys.has(key))
    .filter(key => hasNonEmptyRouteParamValue(params[key]))

  if (unexpectedKeys.length === 0) {
    return
  }

  throw new Error(`Unexpected params for named route "${routeName}": ${unexpectedKeys.join(', ')}`)
}

function resolveNamedRouteLocation(
  to: Extract<RouteLocationRaw, Record<string, unknown>>,
  lookup: NamedRouteLookup,
  paramsMode: RouteParamsMode,
): Extract<RouteLocationRaw, Record<string, unknown>> {
  const routeName = to.name
  if (typeof routeName !== 'string' || !routeName) {
    return to
  }
  if (to.path !== undefined || to.fullPath !== undefined) {
    return to
  }

  const routeRecord = lookup.recordByName.get(routeName)
  if (!routeRecord) {
    throw new Error(`Named route "${routeName}" is not defined in useRouter({ routes | namedRoutes })`)
  }

  const params = to.params
    ? normalizeRouteParams(to.params)
    : {}
  const resolvedResult = resolveNamedRoutePath(routeRecord.path, params, routeName)
  if (paramsMode === 'strict') {
    assertNoUnexpectedNamedRouteParams(params, resolvedResult.consumedKeys, routeName)
  }

  return {
    ...to,
    path: resolvedResult.path ? `/${resolvedResult.path}` : '/',
    params,
  }
}

function cloneRouteMeta(meta?: RouteMeta): RouteMeta | undefined {
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

function createRouterOptionsSnapshot(
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

function normalizeRouteRecordMatched(
  record: RouteRecordNormalized,
  matchedPath?: string,
): RouteRecordMatched {
  const matchedRecord: RouteRecordMatched = {
    name: record.name,
    path: record.path ? `/${record.path}` : '/',
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

function cloneRouteRecordMatchedList(matched?: readonly RouteRecordMatched[]): RouteRecordMatched[] | undefined {
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

function cloneRouteLocationRedirectedFrom(
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

function createRedirectedFromSnapshot(route: RouteLocationNormalizedLoaded): RouteLocationRedirectedFrom {
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

function splitRoutePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function listRouteRecordMatchPaths(record: RouteRecordNormalized): readonly string[] {
  return [record.path, ...record.aliasPaths]
}

function resolveMatchedRouteRecordChain(
  record: RouteRecordNormalized,
  lookup: NamedRouteLookup,
): RouteRecordNormalized[] {
  const matchedRecords: RouteRecordNormalized[] = []
  const visitedNames = new Set<string>()
  let currentRecord: RouteRecordNormalized | undefined = record

  while (currentRecord) {
    if (visitedNames.has(currentRecord.name)) {
      break
    }
    visitedNames.add(currentRecord.name)
    matchedRecords.unshift(currentRecord)
    if (!currentRecord.parentName) {
      break
    }
    currentRecord = lookup.recordByName.get(currentRecord.parentName)
  }

  return matchedRecords
}

function mergeMatchedRouteMeta(matchedRecords: readonly RouteRecordNormalized[]): RouteMeta | undefined {
  let mergedRouteMeta: RouteMeta | undefined
  for (const matchedRecord of matchedRecords) {
    if (!matchedRecord.meta) {
      continue
    }
    if (!mergedRouteMeta) {
      mergedRouteMeta = {}
    }
    Object.assign(mergedRouteMeta, matchedRecord.meta)
  }
  return mergedRouteMeta
}

function collectRouteNamesForRemoval(
  routeName: string,
  recordByName: ReadonlyMap<string, RouteRecordNormalized>,
): Set<string> {
  const namesToRemove = new Set<string>()
  if (!recordByName.has(routeName)) {
    return namesToRemove
  }

  namesToRemove.add(routeName)
  let expanded = true
  while (expanded) {
    expanded = false
    for (const [name, record] of recordByName.entries()) {
      if (!record.parentName || namesToRemove.has(name)) {
        continue
      }
      if (namesToRemove.has(record.parentName)) {
        namesToRemove.add(name)
        expanded = true
      }
    }
  }

  return namesToRemove
}

function buildRouteParamsFromMatch(matchValues: ReadonlyMap<string, string[]>): RouteParams {
  const params: RouteParams = {}
  for (const [key, values] of matchValues.entries()) {
    if (values.length === 0) {
      continue
    }
    params[key] = values.length === 1 ? values[0] : values
  }
  return params
}

function matchRoutePathParams(pathTemplate: string, targetPath: string): RouteParams | undefined {
  const templateSegments = splitRoutePathSegments(pathTemplate)
  const targetSegments = splitRoutePathSegments(targetPath)
  const matchedValues = new Map<string, string[]>()

  const pushValue = (key: string, value: string) => {
    const previous = matchedValues.get(key)
    if (previous) {
      previous.push(value)
      return
    }
    matchedValues.set(key, [value])
  }

  const popValue = (key: string) => {
    const previous = matchedValues.get(key)
    if (!previous || previous.length === 0) {
      return
    }
    previous.pop()
    if (previous.length === 0) {
      matchedValues.delete(key)
    }
  }

  const consumeRepeatableToken = (key: string, startIndex: number, count: number): () => void => {
    for (let index = 0; index < count; index += 1) {
      pushValue(key, decodeRouteParamSegment(targetSegments[startIndex + index]))
    }
    return () => {
      for (let index = 0; index < count; index += 1) {
        popValue(key)
      }
    }
  }

  const matchRecursively = (templateIndex: number, targetIndex: number): boolean => {
    if (templateIndex >= templateSegments.length) {
      return targetIndex >= targetSegments.length
    }

    const templateSegment = templateSegments[templateIndex]
    const token = parsePathParamToken(templateSegment)
    if (!token) {
      if (targetIndex >= targetSegments.length || templateSegment !== targetSegments[targetIndex]) {
        return false
      }
      return matchRecursively(templateIndex + 1, targetIndex + 1)
    }

    if (token.modifier === '') {
      if (targetIndex >= targetSegments.length) {
        return false
      }
      pushValue(token.key, decodeRouteParamSegment(targetSegments[targetIndex]))
      const matched = matchRecursively(templateIndex + 1, targetIndex + 1)
      if (!matched) {
        popValue(token.key)
      }
      return matched
    }

    if (token.modifier === '?') {
      if (targetIndex < targetSegments.length) {
        pushValue(token.key, decodeRouteParamSegment(targetSegments[targetIndex]))
        const consumeMatched = matchRecursively(templateIndex + 1, targetIndex + 1)
        if (consumeMatched) {
          return true
        }
        popValue(token.key)
      }
      return matchRecursively(templateIndex + 1, targetIndex)
    }

    const minimumCount = token.modifier === '+' ? 1 : 0
    const maximumCount = targetSegments.length - targetIndex

    for (let count = maximumCount; count >= minimumCount; count -= 1) {
      const rollback = consumeRepeatableToken(token.key, targetIndex, count)
      const matched = matchRecursively(templateIndex + 1, targetIndex + count)
      if (matched) {
        return true
      }
      rollback()
    }

    return false
  }

  if (!matchRecursively(0, 0)) {
    return undefined
  }

  return buildRouteParamsFromMatch(matchedValues)
}

function resolveMatchedRouteRecord(
  target: RouteLocationNormalizedLoaded,
  lookup: NamedRouteLookup,
): MatchedRouteRecordResolveResult | undefined {
  if (target.name) {
    const byName = lookup.recordByName.get(target.name)
    if (byName) {
      return {
        record: byName,
        matchedRecords: resolveMatchedRouteRecordChain(byName, lookup),
      }
    }
  }

  const staticNamedRoute = lookup.nameByStaticPath.get(target.path)
  if (staticNamedRoute) {
    const record = lookup.recordByName.get(staticNamedRoute)
    if (record) {
      return {
        record,
        matchedRecords: resolveMatchedRouteRecordChain(record, lookup),
        matchedPath: target.path,
      }
    }
  }

  for (const record of lookup.recordByName.values()) {
    for (const routePath of listRouteRecordMatchPaths(record)) {
      if (!isDynamicRoutePath(routePath)) {
        continue
      }
      const matchedParams = matchRoutePathParams(routePath, target.path)
      if (!matchedParams) {
        continue
      }
      return {
        record,
        matchedRecords: resolveMatchedRouteRecordChain(record, lookup),
        matchedPath: routePath,
        params: matchedParams,
      }
    }
  }

  return undefined
}

function parsePathInput(
  input: string,
  codec: RouteResolveCodec = DEFAULT_ROUTE_RESOLVE_CODEC,
): { path: string, query: LocationQuery, hash: string } {
  const hashIndex = input.indexOf('#')
  const withoutHash = hashIndex >= 0 ? input.slice(0, hashIndex) : input
  const hash = hashIndex >= 0 ? normalizeHash(input.slice(hashIndex + 1)) : ''
  const queryIndex = withoutHash.indexOf('?')

  if (queryIndex < 0) {
    return {
      path: withoutHash,
      query: {},
      hash,
    }
  }

  return {
    path: withoutHash.slice(0, queryIndex),
    query: normalizeQuery(codec.parseQuery(withoutHash.slice(queryIndex + 1))),
    hash,
  }
}

function createRouteLocation(
  path: string,
  query: LocationQuery,
  hash = '',
  name?: string,
  params: RouteParams = {},
  queryStringifier: RouteQueryStringifier = stringifyQuery,
): RouteLocationNormalizedLoaded {
  const normalizedPath = resolvePath(path, '')
  const queryString = queryStringifier(query)
  const fullPathBase = normalizedPath ? `/${normalizedPath}` : '/'
  const normalizedHash = normalizeHash(hash)
  const fullPath = queryString ? `${fullPathBase}?${queryString}` : fullPathBase
  const location: RouteLocationNormalizedLoaded = {
    path: normalizedPath,
    fullPath: normalizedHash ? `${fullPath}${normalizedHash}` : fullPath,
    query,
    hash: normalizedHash,
    params,
  }
  if (name !== undefined) {
    location.name = name
  }

  return location
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
  return createRouteLocation(rawPath, query, '', undefined, {})
}

function cloneLocationQuery(query: LocationQuery): LocationQuery {
  const cloned: LocationQuery = {}
  for (const key of Object.keys(query)) {
    const value = query[key]
    cloned[key] = Array.isArray(value) ? value.slice() : value
  }
  return cloned
}

function cloneRouteParams(params: RouteParams): RouteParams {
  const cloned: RouteParams = {}
  for (const key of Object.keys(params)) {
    const value = params[key]
    cloned[key] = Array.isArray(value) ? value.slice() : value
  }
  return cloned
}

function snapshotRouteLocation(route: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
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

function createAbsoluteRoutePath(path: string): string {
  return path ? `/${path}` : '/'
}

function createNativeRouteUrl(
  target: RouteLocationNormalizedLoaded,
  queryStringifier: RouteQueryStringifier = stringifyQuery,
): string {
  const basePath = createAbsoluteRoutePath(target.path)
  const queryString = queryStringifier(target.query)
  return queryString ? `${basePath}?${queryString}` : basePath
}

function hasLocationQuery(query: LocationQuery): boolean {
  return Object.keys(query).length > 0
}

export {
  assertValidAddRouteInput,
  cloneLocationQuery,
  cloneRouteLocationRedirectedFrom,
  cloneRouteMeta,
  cloneRouteParams,
  cloneRouteRecordMatchedList,
  collectRouteNamesForRemoval,
  createAbsoluteRoutePath,
  createNamedRouteLookup,
  createNamedRouteNameByStaticPath,
  createNativeRouteUrl,
  createRedirectedFromSnapshot,
  createRouteLocation,
  createRouteRecordAliasValue,
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
  resolveCurrentRoute,
  resolveMatchedRouteRecord,
  resolveNamedRouteLocation,
  resolvePath,
  resolveRouteOptionEntries,
  snapshotRouteLocation,
  warnDuplicateRouteEntries,
  warnRouteConfig,
}

export type {
  FlattenedRouteRecordSeed,
  MatchedRouteRecordResolveResult,
  NamedRouteLookup,
  RouteOptionSource,
  RouteRecordNormalized,
  RouteResolveCodec,
}
