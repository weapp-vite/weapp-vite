import type { MiniProgramPageLifetime } from '../runtime/types'
import type { SetupContextRouter } from '../runtime/types/props'
import type { RouteStateSyncPayload } from './routeSync'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded } from './types'
import { reactive, readonly } from '../reactivity'
import { cloneLocationQuery, cloneRouteLocationRedirectedFrom, cloneRouteMeta, cloneRouteParams, cloneRouteRecordMatchedList, resolveCurrentRoute, resolvePageRoute } from '../routerInternal/shared'
import { getCurrentSetupContext, onLoad, onReady, onRouteDone, onShow, onUnload } from '../runtime/hooks'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import {
  useNativePageRouter as useNativePageRouterInternal,
  useNativeRouter as useNativeRouterInternal,
} from '../runtime/vueCompat'
import { getActiveRouter } from './instance'
import { resolveRouteLocation } from './resolve'
import { registerRouteStateSyncHandler } from './routeSync'

export interface UseRouteOptions {
  resolveRoute?: (route: RouteLocationNormalizedLoaded) => RouteLocationNormalizedLoaded
}

interface RouteStateControllerOptions extends UseRouteOptions {
  beforeRouteStateSync?: (
    nextRoute: RouteLocationNormalizedLoaded,
    payload: RouteStateSyncPayload,
  ) => void
}

export interface RouteStateController {
  route: Readonly<RouteLocationNormalizedLoaded>
}

function isPageLikeInstance(instance: Record<string, any>): boolean {
  return typeof instance.route === 'string' || typeof instance.__route__ === 'string'
}

function shouldSyncRouteStateForInstance(
  instance: Record<string, any>,
  isPageController: boolean,
  payload: RouteStateSyncPayload | undefined,
): boolean {
  if (payload?.source === 'router') {
    return true
  }

  // 页面级 route controller 只处理当前页面的广播，避免 DevTools 在 onUnload/onShow
  // 交错时让隐藏页面重复执行导航守卫。组件级 controller 仍接收全局同步。
  if (!isPageController) {
    return true
  }

  if (payload?.page) {
    return payload.page === instance
  }

  const pages = getCurrentMiniProgramPages()
  return pages[pages.length - 1] === instance
}

function applyRouteState(
  routeState: RouteLocationNormalizedLoaded,
  nextRoute: RouteLocationNormalizedLoaded,
) {
  routeState.path = nextRoute.path
  routeState.fullPath = nextRoute.fullPath
  routeState.query = cloneLocationQuery(nextRoute.query)
  routeState.hash = nextRoute.hash
  routeState.params = cloneRouteParams(nextRoute.params)
  if (nextRoute.name === undefined) {
    delete (routeState as Partial<RouteLocationNormalizedLoaded>).name
  }
  else {
    routeState.name = nextRoute.name
  }
  if (nextRoute.meta === undefined) {
    delete (routeState as Partial<RouteLocationNormalizedLoaded>).meta
  }
  else {
    routeState.meta = cloneRouteMeta(nextRoute.meta)
  }
  if (nextRoute.href === undefined) {
    delete (routeState as Partial<RouteLocationNormalizedLoaded>).href
  }
  else {
    routeState.href = nextRoute.href
  }
  if (nextRoute.matched === undefined) {
    delete (routeState as Partial<RouteLocationNormalizedLoaded>).matched
  }
  else {
    routeState.matched = cloneRouteRecordMatchedList(nextRoute.matched)
  }
  if (nextRoute.redirectedFrom === undefined) {
    delete (routeState as Partial<RouteLocationNormalizedLoaded>).redirectedFrom
  }
  else {
    routeState.redirectedFrom = cloneRouteLocationRedirectedFrom(nextRoute.redirectedFrom)
  }
}

export function createRouteStateController(options: RouteStateControllerOptions = {}): RouteStateController {
  const setupContext = getCurrentSetupContext()
  if (!setupContext) {
    throw new Error('useRoute() 必须在 setup() 的同步阶段调用')
  }

  const fallbackPage = setupContext.instance
  const resolveRoute = options.resolveRoute
    ?? ((route: RouteLocationNormalizedLoaded) => getActiveRouter()?.resolve(route) ?? route)
  const currentRoute = resolveRoute(resolveCurrentRoute(undefined, fallbackPage))
  const isPageController = isPageLikeInstance(fallbackPage)
    || getCurrentMiniProgramPages().includes(fallbackPage)
  const routeState = reactive<RouteLocationNormalizedLoaded>({
    path: currentRoute.path,
    fullPath: currentRoute.fullPath,
    query: cloneLocationQuery(currentRoute.query),
    hash: currentRoute.hash,
    params: cloneRouteParams(currentRoute.params),
  })
  applyRouteState(routeState, currentRoute)

  function syncRoute(
    queryOverride?: LocationQueryRaw,
    routeOverride?: RouteLocationNormalizedLoaded,
    payload?: RouteStateSyncPayload,
  ) {
    const nextRoute = routeOverride
      ? resolveRoute(routeOverride)
      : resolveRoute(resolveCurrentRoute(queryOverride, fallbackPage))
    if (payload) {
      options.beforeRouteStateSync?.(nextRoute, payload)
    }
    applyRouteState(routeState, nextRoute)
  }

  onLoad((query: Parameters<NonNullable<MiniProgramPageLifetime['onLoad']>>[0]) => {
    syncRoute(query as unknown as LocationQueryRaw)
  })
  onReady(() => {
    syncRoute()
  })
  onShow(() => {
    syncRoute()
  })
  onRouteDone(() => {
    syncRoute()
  })
  const unregisterRouteStateSync = registerRouteStateSyncHandler((payload) => {
    if (!shouldSyncRouteStateForInstance(fallbackPage, isPageController, payload)) {
      return
    }
    if (payload?.route) {
      syncRoute(undefined, payload.route, payload)
      return
    }
    if (payload?.page) {
      syncRoute(undefined, resolvePageRoute(payload.page), payload)
      return
    }
    if (payload?.url) {
      syncRoute(undefined, resolveRouteLocation(payload.url, routeState.path), payload)
      return
    }
    syncRoute(undefined, undefined, payload)
  })
  onUnload(() => {
    unregisterRouteStateSync()
  })

  return {
    route: readonly(routeState) as Readonly<RouteLocationNormalizedLoaded>,
  }
}

export function useRoute(options: UseRouteOptions = {}): Readonly<RouteLocationNormalizedLoaded> {
  return createRouteStateController(options).route
}

/**
 * @description 获取当前组件路径语义的原生 Router
 */
export function useNativeRouter(): SetupContextRouter {
  return useNativeRouterInternal()
}

/**
 * @description 获取当前页面路径语义的原生 Page Router
 */
export function useNativePageRouter(): SetupContextRouter {
  return useNativePageRouterInternal()
}
