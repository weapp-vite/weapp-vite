import type {
  NamedRoutes,
  NavigationGuard,
  RouteRecordInput,
  RouteRecordRaw,
  UseRouterOptions,
} from '../router'
import type {
  FlattenedRouteRecordSeed,
  NamedRouteLookup,
  RouteOptionSource,
  RouteRecordNormalized,
} from './types'
import { createAbsoluteRoutePath, isDynamicRoutePath, resolvePath } from './path'
import { warnRouteConfig } from './recordsWarnings'

function normalizeBeforeEnterGuards(beforeEnter?: RouteRecordRaw['beforeEnter']): readonly NavigationGuard[] {
  if (!beforeEnter) {
    return []
  }
  if (Array.isArray(beforeEnter)) {
    return beforeEnter as readonly NavigationGuard[]
  }
  return [beforeEnter as NavigationGuard]
}

function resolveRouteRecordName(
  route: RouteRecordInput,
  normalizedPath: string,
  source: RouteOptionSource = 'namedRoutes',
): string {
  if (typeof route.name === 'string' && route.name.trim()) {
    return route.name.trim()
  }

  if (source === 'routes') {
    return normalizedPath || '/'
  }

  return ''
}

export function normalizeRouteRecordRaw(
  route: RouteRecordInput,
  parentName?: string,
  source: RouteOptionSource = 'namedRoutes',
): RouteRecordNormalized | undefined {
  const normalizedPath = resolvePath(route.path, '')
  if (!normalizedPath && route.path !== '/') {
    return undefined
  }

  const routeName = resolveRouteRecordName(route, normalizedPath, source)
  if (!routeName) {
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
  namedRoutes?: NamedRoutes | readonly RouteRecordInput[],
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

export function resolveRouteOptionEntries(options: UseRouterOptions): FlattenedRouteRecordSeed[] {
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

export function createRouteRecordAliasValue(aliasPaths: readonly string[]): RouteRecordRaw['alias'] {
  if (aliasPaths.length === 0) {
    return undefined
  }
  if (aliasPaths.length === 1) {
    return createAbsoluteRoutePath(aliasPaths[0])
  }
  return aliasPaths.map(aliasPath => createAbsoluteRoutePath(aliasPath))
}

export function flattenNamedRouteRecords(
  records: readonly RouteRecordInput[],
  parentPath?: string,
  parentName?: string,
  parentAliasPaths: readonly string[] = [],
  source?: RouteOptionSource,
  pathPrefix = 'namedRoutes',
  ancestorRecords: ReadonlySet<RouteRecordInput> = new Set<RouteRecordInput>(),
): FlattenedRouteRecordSeed[] {
  const flattenedRecords: FlattenedRouteRecordSeed[] = []

  for (const [index, record] of records.entries()) {
    const routeConfigPath = `${pathPrefix}[${index}]`
    if (ancestorRecords.has(record)) {
      warnRouteConfig(`ignored route record at ${routeConfigPath}: detected circular children reference`)
      continue
    }

    if (typeof record.path !== 'string' || !record.path) {
      const routeName = typeof record?.name === 'string'
        ? record.name.trim()
        : ''
      warnRouteConfig(`ignored route record "${routeName}" at ${routeConfigPath}: route path is required`)
      continue
    }

    const normalizedPath = normalizeNestedRoutePath(record.path, parentPath)
    const routeName = resolveRouteRecordName(record, normalizedPath, source)
    if (!routeName) {
      warnRouteConfig(`ignored route record at ${routeConfigPath}: route name is required`)
      continue
    }
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
      name: routeName,
      path: normalizedPath ? createAbsoluteRoutePath(normalizedPath) : '/',
      alias: createRouteRecordAliasValue(normalizedAliasPaths),
      meta: record.meta,
      beforeEnter: record.beforeEnter,
      redirect: record.redirect,
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

export function createNamedRouteNameByStaticPath(recordByName: ReadonlyMap<string, RouteRecordNormalized>): Map<string, string> {
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

export function createNamedRouteLookup(routeEntries: readonly FlattenedRouteRecordSeed[]): NamedRouteLookup {
  const recordByName = new Map<string, RouteRecordNormalized>()

  for (const routeRecord of routeEntries) {
    const normalizedRecord = normalizeRouteRecordRaw(
      routeRecord.route,
      routeRecord.parentName,
      routeRecord.source,
    )
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
