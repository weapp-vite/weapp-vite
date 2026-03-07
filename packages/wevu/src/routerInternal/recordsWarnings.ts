import type { RouteRecordRaw } from '../router'
import type { FlattenedRouteRecordSeed, RouteOptionSource } from './types'
import { createAbsoluteRoutePath, resolvePath } from './path'

export function warnRouteConfig(message: string): void {
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

export function assertValidAddRouteInput(routeRecord: RouteRecordRaw): void {
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

export function warnDuplicateRouteEntries(routeEntries: readonly FlattenedRouteRecordSeed[]): void {
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
