import type {
  NamedRouteLookup,
  RouteRecordNormalized,
} from '../routerInternal/shared'
import type { AddRoute, RouteRecordRaw } from './types'
import {
  assertValidAddRouteInput,
  cloneRouteMeta,
  collectRouteNamesForRemoval,
  createAbsoluteRoutePath,
  createNamedRouteNameByStaticPath,
  flattenNamedRouteRecords,
  normalizeRouteRecordRaw,
  warnRouteConfig,
} from '../routerInternal/shared'

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

export function createRouteRegistry(namedRouteLookup: NamedRouteLookup) {
  const hasRoute = (name: string) => namedRouteLookup.recordByName.has(name)
  const getRoutes = (): readonly RouteRecordRaw[] =>
    Array.from(namedRouteLookup.recordByName.values()).map(normalizeRouteRecordForOutput)

  const addRoute: AddRoute = ((parentNameOrRoute: string | RouteRecordRaw, maybeRoute?: RouteRecordRaw) => {
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
  }) as AddRoute

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

  return {
    hasRoute,
    getRoutes,
    addRoute,
    removeRoute,
    clearRoutes,
  }
}
