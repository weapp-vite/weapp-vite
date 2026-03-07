import type { RouteResolveCodec } from '../routerInternal/shared'
import type {
  NavigationAfterEach,
  NavigationErrorHandler,
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  RouterNavigation,
  UseRouterOptions,
} from './types'
import {
  cloneRouteMeta,
  cloneRouteParams,
  createNamedRouteLookup,
  createRouterOptionsSnapshot,
  mergeMatchedRouteMeta,
  normalizeRouteRecordMatched,
  parseQuery,
  resolveMatchedRouteRecord,
  resolveNamedRouteLocation,
  resolvePath,
  resolveRouteOptionEntries,
  stringifyQuery,
  warnDuplicateRouteEntries,
} from '../routerInternal/shared'
import { createNavigationApi } from './navigationApi'
import { createNavigationResultController } from './navigationResult'
import { resolveRouteLocation } from './resolve'
import { createRouteRegistry } from './routeRegistry'
import { useNativeRouter, useRoute } from './useRoute'

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
  const routeRegistry = createRouteRegistry(namedRouteLookup)
  const routerOptions = createRouterOptionsSnapshot(
    normalizedTabBarEntries,
    routeRegistry.getRoutes(),
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

  const navigationResultController = createNavigationResultController({
    afterEachHooks,
    errorHandlers,
    nativeRouter,
    rejectOnError,
  })

  const navigationApi = createNavigationApi({
    nativeRouter,
    route,
    routeResolveCodec,
    namedRouteLookup,
    beforeEachGuards,
    beforeResolveGuards,
    maxRedirects,
    tabBarPathSet,
    resolveWithCodec,
    settleNavigationResult: navigationResultController.settleNavigationResult,
  })

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

  return {
    nativeRouter,
    options: routerOptions,
    currentRoute: route,
    install,
    resolve,
    isReady,
    push: navigationApi.push,
    replace: navigationApi.replace,
    back: navigationApi.back,
    go: navigationApi.go,
    forward: navigationApi.forward,
    hasRoute: routeRegistry.hasRoute,
    getRoutes: routeRegistry.getRoutes,
    addRoute: routeRegistry.addRoute,
    removeRoute: routeRegistry.removeRoute,
    clearRoutes: routeRegistry.clearRoutes,
    beforeEach,
    beforeResolve,
    afterEach,
    onError,
  }
}
