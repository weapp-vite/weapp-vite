import type { RouteResolveCodec } from '../routerInternal/shared'
import type { NavigationRunResult } from './navigationResult'
import type { RouteStateSyncPayload } from './routeSync'
import type {
  InitialNavigationMode,
  LocationQueryRaw,
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
  resolveCurrentRoute,
  resolveMatchedRouteRecord,
  resolveNamedRouteLocation,
  resolvePath,
  resolveRouteOptionEntries,
  snapshotRouteLocation,
  stringifyQuery,
  warnDuplicateRouteEntries,
} from '../routerInternal/shared'
import { getMiniProgramGlobalObject } from '../runtime/platform'
import { resolveBackNavigationTarget, runBackNavigationGuards } from './backNavigation'
import { DEFAULT_INITIAL_NAVIGATION_TIMEOUT, registerInitialNavigationRunner } from './initialNavigation'
import { setActiveRouter } from './instance'
import { createNavigationApi } from './navigationApi'
import { createNavigationResultController } from './navigationResult'
import { navigateWithTarget } from './navigationTarget'
import { resolveRouteLocation } from './resolve'
import { createRouteRegistry } from './routeRegistry'
import { installRouteStateSyncOnNativeRouter, notifyRouteStateSync } from './routeSync'
import { createRouteStateController, useNativeRouter } from './useRoute'

/**
 * @description 创建高阶路由导航器（对齐 Vue Router 的 createRouter 心智）
 */
export function createRouter(options: UseRouterOptions = {}): RouterNavigation {
  const nativeRouter = useNativeRouter()
  installRouteStateSyncOnNativeRouter(getMiniProgramGlobalObject())
  const beforeEachGuards = new Set<NavigationGuard>()
  const beforeResolveGuards = new Set<NavigationGuard>()
  const afterEachHooks = new Set<NavigationAfterEach>()
  const errorHandlers = new Set<NavigationErrorHandler>()
  const maxRedirects = options.maxRedirects ?? 10
  const initialNavigationMode: InitialNavigationMode = options.initialNavigationMode === 'blocking' ? 'blocking' : 'eager'
  const initialNavigationTimeout = Number.isFinite(options.initialNavigationTimeout) && (options.initialNavigationTimeout ?? 0) > 0
    ? Math.max(1, Math.trunc(options.initialNavigationTimeout!))
    : DEFAULT_INITIAL_NAVIGATION_TIMEOUT
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
  let managedNavigationCount = 0
  let activeManagedRoutePath: string | undefined
  let pendingManagedRouteSyncPath: string | undefined
  let pendingExternalRouteSyncPath: string | undefined
  const routerOptions = createRouterOptionsSnapshot(
    normalizedTabBarEntries,
    routeRegistry.getRoutes(),
    paramsMode,
    maxRedirects,
    initialNavigationMode,
    initialNavigationTimeout,
    routeResolveCodec,
    rejectOnError,
  )

  function enrichRouteRecordState(routeLocation: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
    const resolved = { ...routeLocation }
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

  function resolveWithCodec(to: RouteLocationRaw, currentPath: string): RouteLocationNormalizedLoaded {
    const rawTo = typeof to === 'string'
      ? to
      : resolveNamedRouteLocation(to, namedRouteLookup, paramsMode)
    return enrichRouteRecordState(resolveRouteLocation(rawTo, currentPath, routeResolveCodec))
  }

  let route: Readonly<RouteLocationNormalizedLoaded>
  let emitObservedNavigationAfterEach: ((result: NavigationRunResult) => Promise<void>) | undefined

  function isExternalBackSync(payload: RouteStateSyncPayload): boolean {
    return payload.source === 'page'
      || (payload.source === 'native' && payload.method === 'navigateBack')
  }

  function beforeRouteStateSync(
    nextRoute: RouteLocationNormalizedLoaded,
    payload: RouteStateSyncPayload,
  ) {
    if (managedNavigationCount > 0 || !isExternalBackSync(payload)) {
      return
    }

    if (pendingExternalRouteSyncPath !== undefined) {
      return
    }

    if (pendingManagedRouteSyncPath !== undefined) {
      const expectedPath = pendingManagedRouteSyncPath
      pendingManagedRouteSyncPath = undefined
      if (nextRoute.fullPath === expectedPath) {
        return
      }
    }

    if (nextRoute.fullPath === route.fullPath) {
      return
    }

    pendingExternalRouteSyncPath = nextRoute.fullPath
    const from = snapshotRouteLocation(route)
    void runBackNavigationGuards({
      target: nextRoute,
      from,
      nativeRouter,
      beforeEachGuards,
      beforeResolveGuards,
      resolveWithCodec,
    }).then((result) => {
      return emitObservedNavigationAfterEach?.(result)
    }).finally(() => {
      pendingExternalRouteSyncPath = undefined
    })
  }

  const routeController = createRouteStateController({
    beforeRouteStateSync,
    resolveRoute: enrichRouteRecordState,
  })
  route = routeController.route

  function resolve(to: RouteLocationRaw): RouteLocationNormalizedLoaded {
    return resolveWithCodec(to, route.path)
  }

  const navigationResultController = createNavigationResultController({
    afterEachHooks,
    errorHandlers,
    nativeRouter,
    rejectOnError,
  })
  emitObservedNavigationAfterEach = navigationResultController.emitNavigationAfterEach

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

  async function runManagedNavigation<T>(navigation: () => Promise<T>, targetPath?: string): Promise<T> {
    const previousRoutePath = route.fullPath
    if (targetPath) {
      activeManagedRoutePath = targetPath
    }
    managedNavigationCount += 1
    try {
      const result = await navigation()
      if (route.fullPath !== previousRoutePath) {
        pendingManagedRouteSyncPath = route.fullPath
      }
      return result
    }
    finally {
      managedNavigationCount -= 1
      if (managedNavigationCount <= 0) {
        activeManagedRoutePath = undefined
      }
    }
  }

  function resolveManagedRoutePath(to: RouteLocationRaw): string | undefined {
    try {
      return resolveWithCodec(to, route.path).fullPath
    }
    catch {
      return undefined
    }
  }

  async function runInitialNavigation(
    page: Parameters<typeof resolveCurrentRoute>[1],
    query?: LocationQueryRaw,
    isActive: () => boolean = () => true,
  ) {
    return runManagedNavigation(async () => {
      const from = snapshotRouteLocation(route)
      const target = enrichRouteRecordState(resolveCurrentRoute(query, page))
      if (!target.path) {
        return undefined
      }
      if (activeManagedRoutePath === target.fullPath) {
        notifyRouteStateSync({
          route: target,
          source: 'router',
        })
        return undefined
      }
      const result = await navigateWithTarget({
        mode: 'push',
        target,
        from,
        nativeRouter,
        routeResolveCodec,
        namedRouteLookup,
        beforeEachGuards,
        beforeResolveGuards,
        maxRedirects,
        tabBarPathSet,
        resolveWithCodec,
        executeNative: false,
        allowSameLocation: true,
      })
      if (!isActive()) {
        return undefined
      }
      return navigationResultController.settleNavigationResult(result)
    })
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

  const router: RouterNavigation = {
    nativeRouter,
    options: routerOptions,
    currentRoute: route,
    install(app?: unknown): void {
      setActiveRouter(router)
      const globalProperties = (app as { config?: { globalProperties?: Record<string, unknown> } } | undefined)?.config?.globalProperties
      if (globalProperties) {
        globalProperties.$router = router
      }
    },
    resolve,
    isReady(): Promise<void> {
      return readyPromise
    },
    push: to => runManagedNavigation(() => navigationApi.push(to), resolveManagedRoutePath(to)),
    replace: to => runManagedNavigation(() => navigationApi.replace(to), resolveManagedRoutePath(to)),
    back: delta => runManagedNavigation(
      () => navigationApi.back(delta),
      resolveBackNavigationTarget(delta ?? 1, route, resolveWithCodec)?.fullPath,
    ),
    go: delta => runManagedNavigation(
      () => navigationApi.go(delta),
      delta < 0
        ? resolveBackNavigationTarget(Math.abs(delta), route, resolveWithCodec)?.fullPath
        : undefined,
    ),
    forward: () => runManagedNavigation(() => navigationApi.forward()),
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

  setActiveRouter(router)
  registerInitialNavigationRunner(router, runInitialNavigation, initialNavigationTimeout, initialNavigationMode)
  return router
}
