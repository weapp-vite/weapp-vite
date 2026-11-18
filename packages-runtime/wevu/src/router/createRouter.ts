import type { WevuNamedRouteMap } from '../router'
import type { RouterHistoryAdapter } from './history'
import type { BackNavigationContext, RouterNavigationContext } from './navigationContext'
import type { NavigationRunResult } from './navigationResult'
import type { RouteStateSyncPayload } from './routeSync'
import type {
  LocationQueryRaw,
  NavigationAfterEach,
  NavigationErrorHandler,
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  RouterNavigation,
  UseRouterOptions,
} from './types'
import { getCurrentMiniProgramPage } from '../routerInternal/location'
import {
  resolveCurrentRoute,
  resolvePageRoute,
  snapshotRouteLocation,
} from '../routerInternal/shared'
import { getCurrentMiniProgramGlobalObject } from '../runtime/platform'
import { runBackNavigationGuards } from './backNavigation'
import { resolveHistory } from './historyDriver'
import { registerInitialNavigationRunner } from './initialNavigation'
import { registerRouterHistory, setActiveRouter } from './instance'
import { createNavigationApi } from './navigationApi'
import { createNavigationFailure, isNavigationFailure } from './navigationCore'
import { createNavigationResultController } from './navigationResult'
import { createNavigationScope } from './navigationScope'
import { navigateWithTarget } from './navigationTarget'
import { createRouterRuntime } from './routerRuntime'
import { createRouteStateController } from './routeStateController'
import { installRouteStateSyncOnNativeRouter, publishRouteState } from './routeSync'
import { NavigationFailureType } from './types'
import { useNativeRouter } from './useRoute'

/**
 * @description 创建高阶路由导航器（对齐 Vue Router 的 createRouter 心智）
 */
export function createRouter<TRouteMap extends object = WevuNamedRouteMap>(
  optionsInput: UseRouterOptions<NoInfer<TRouteMap>> = {},
): RouterNavigation<TRouteMap> {
  // 路由表泛型只约束公开类型；运行时继续使用同一套名称无关的导航引擎。
  const options = optionsInput as unknown as UseRouterOptions
  const runtime = createRouterRuntime(options)
  const {
    history,
    syncWithNative,
    maxRedirects,
    initialNavigationMode,
    initialNavigationTimeout,
    rejectOnError,
    routeResolveCodec,
    tabBarPaths,
    namedRouteLookup,
    routeRegistry,
    enrich: enrichRouteRecordState,
    resolveWithCodec: resolveWithCodecBase,
  } = runtime
  installRouteStateSyncOnNativeRouter(getCurrentMiniProgramGlobalObject())
  const nativeRouter = useNativeRouter()
  const beforeEachGuards = new Set<NavigationGuard>()
  const beforeResolveGuards = new Set<NavigationGuard>()
  const afterEachHooks = new Set<NavigationAfterEach>()
  const errorHandlers = new Set<NavigationErrorHandler>()
  const readyPromise = Promise.resolve()
  // 受管导航与外部同步的判定集中在这里，装配代码不再维护散落的可变标记。
  const navigationScope = createNavigationScope()
  const routerOptions = Object.freeze({ ...runtime.snapshot, history })

  let route: Readonly<RouteLocationNormalizedLoaded>
  let emitObservedNavigationAfterEach: ((result: NavigationRunResult) => Promise<void>) | undefined
  let locationHistory: RouterHistoryAdapter | undefined
  const explicitQueryTargets = new WeakSet<RouteLocationNormalizedLoaded>()

  /** 原始位置显式带 query 时以调用方为准；未带 query 才读回自定义存储。 */
  function resolveWithCodec(to: RouteLocationRaw, currentPath: string): RouteLocationNormalizedLoaded {
    const resolved = resolveWithCodecBase(to, currentPath)
    if (typeof to === 'string' ? to.includes('?') : to.query !== undefined) {
      explicitQueryTargets.add(resolved)
    }
    return resolved
  }

  function readGuardTarget(location: RouteLocationNormalizedLoaded): RouteLocationNormalizedLoaded {
    return explicitQueryTargets.has(location)
      ? location
      : locationHistory?.readResolvedLocation(location) ?? location
  }

  /** 返回导航守卫链所需的最小依赖。 */
  const backGuardContext: BackNavigationContext = {
    nativeRouter,
    beforeEachGuards,
    beforeResolveGuards,
    resolveWithCodec,
    readGuardTarget,
  }

  /**
   * 宿主 / 页面触发的外部同步：不属于本 router 主动发起的导航，重新走一次返回守卫。
   */
  function beforeRouteStateSync(
    nextRoute: RouteLocationNormalizedLoaded,
    payload: RouteStateSyncPayload,
  ) {
    if (!navigationScope.acceptExternalSync(nextRoute, payload, route.fullPath)) {
      return
    }
    const from = snapshotRouteLocation(route)
    void runBackNavigationGuards(backGuardContext, {
      target: nextRoute,
      from,
    }).then((result) => {
      return emitObservedNavigationAfterEach?.(result)
    }).finally(() => {
      navigationScope.completeExternalSync()
    })
  }

  const routeController = createRouteStateController({
    readLocation: (page, query) => locationHistory?.readLocation(page, query) ?? resolvePageRoute(page, query),
    isolated: !syncWithNative,
    beforeRouteStateSync,
    resolveRoute: enrichRouteRecordState,
  })
  route = routeController.route

  // 公开解析与历史钩子沿用原始解析，避免自定义 readLocation 在自身内部递归。
  const resolve = (to: RouteLocationRaw): RouteLocationNormalizedLoaded =>
    resolveWithCodecBase(to, route.path)

  // 位置发布策略集中在这里：与原生同步时广播，独立逻辑路由状态时只更新本 router 快照。
  const publishRoute = (next?: RouteLocationNormalizedLoaded) => {
    publishRouteState({ syncWithNative, updateRoute: routeController.update, route: next })
  }

  const historyContext = {
    nativeRouter,
    tabBarPaths,
    stringifyQuery: routeResolveCodec.stringifyQuery,
    resolve,
    getCurrentPage: getCurrentMiniProgramPage,
    notifyLocationChange: (to?: RouteLocationRaw) => {
      publishRoute(to === undefined ? undefined : resolve(to))
    },
  }
  const historyAdapter = resolveHistory(history, historyContext)
  locationHistory = historyAdapter
  routeController.update(historyAdapter.readLocation(getCurrentMiniProgramPage()))

  // 导航内核共享依赖：守卫、解析器与历史驱动在一次 createRouter 中固定。
  const navigationContext: RouterNavigationContext = {
    history: historyAdapter,
    nativeRouter,
    namedRouteLookup,
    beforeEachGuards,
    beforeResolveGuards,
    maxRedirects,
    resolveWithCodec,
    readGuardTarget,
  }

  const navigationResultController = createNavigationResultController({
    afterEachHooks,
    errorHandlers,
    nativeRouter,
    rejectOnError,
    publish: publishRoute,
  })
  emitObservedNavigationAfterEach = navigationResultController.emitNavigationAfterEach

  const navigationApi = createNavigationApi({
    context: navigationContext,
    getRoute: () => route,
    onTarget: (target) => { navigationScope.setActiveTarget(target?.fullPath) },
    settleNavigationResult: navigationResultController.settleNavigationResult,
  })

  async function runManagedNavigation<T>(navigation: () => Promise<T>): Promise<T> {
    const previousRoutePath = route.fullPath
    navigationScope.beginManaged()
    try {
      const result = await navigation()
      if (route.fullPath !== previousRoutePath) {
        navigationScope.markManagedEcho(route.fullPath)
      }
      return result
    }
    finally {
      navigationScope.endManaged()
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
      if (navigationScope.activeTargetPath === target.fullPath) {
        publishRoute(target)
        return undefined
      }
      const result = await navigateWithTarget(navigationContext, {
        mode: 'push',
        target,
        from,
        executeNative: false,
        allowSameLocation: true,
      })
      if (!isActive()) {
        return undefined
      }
      if (initialNavigationMode === 'blocking' && result.to && result.to.fullPath !== target.fullPath) {
        const redirectedTarget = result.to
        const nativeResult = await historyAdapter.replace(redirectedTarget, from)
        if (isNavigationFailure(nativeResult)) {
          return nativeResult
        }
        publishRoute(redirectedTarget)
        return createNavigationFailure(NavigationFailureType.cancelled, redirectedTarget, from)
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
    push: to => runManagedNavigation(() => navigationApi.push(to)),
    replace: to => runManagedNavigation(() => navigationApi.replace(to)),
    back: delta => runManagedNavigation(() => navigationApi.back(delta)),
    go: delta => runManagedNavigation(() => navigationApi.go(delta)),
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

  registerRouterHistory(router, historyAdapter)
  setActiveRouter(router)
  if (syncWithNative) {
    registerInitialNavigationRunner(router, runInitialNavigation, initialNavigationTimeout, initialNavigationMode)
  }
  const typedRouter = router as unknown as RouterNavigation<TRouteMap>
  return typedRouter
}
