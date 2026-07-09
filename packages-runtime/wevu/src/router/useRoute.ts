import type { MiniProgramPageLifetime } from '../runtime/types'
import type { SetupContextRouter } from '../runtime/types/props'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded } from './types'
import { reactive, readonly } from '../reactivity'
import { cloneLocationQuery, cloneRouteLocationRedirectedFrom, cloneRouteMeta, cloneRouteParams, cloneRouteRecordMatchedList, resolveCurrentRoute } from '../routerInternal/shared'
import { getCurrentSetupContext, onLoad, onReady, onRouteDone, onShow, onUnload } from '../runtime/hooks'
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

export interface RouteStateController {
  route: Readonly<RouteLocationNormalizedLoaded>
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

export function createRouteStateController(options: UseRouteOptions = {}): RouteStateController {
  const setupContext = getCurrentSetupContext()
  if (!setupContext) {
    throw new Error('useRoute() 必须在 setup() 的同步阶段调用')
  }

  const fallbackPage = setupContext.instance
  const resolveRoute = options.resolveRoute
    ?? ((route: RouteLocationNormalizedLoaded) => getActiveRouter()?.resolve(route) ?? route)
  const currentRoute = resolveRoute(resolveCurrentRoute(undefined, fallbackPage))
  const routeState = reactive<RouteLocationNormalizedLoaded>({
    path: currentRoute.path,
    fullPath: currentRoute.fullPath,
    query: cloneLocationQuery(currentRoute.query),
    hash: currentRoute.hash,
    params: cloneRouteParams(currentRoute.params),
  })
  applyRouteState(routeState, currentRoute)

  function syncRoute(queryOverride?: LocationQueryRaw, routeOverride?: RouteLocationNormalizedLoaded) {
    const nextRoute = routeOverride
      ? resolveRoute(routeOverride)
      : resolveRoute(resolveCurrentRoute(queryOverride, fallbackPage))
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
    if (payload?.route) {
      syncRoute(undefined, payload.route)
      return
    }
    if (payload?.url) {
      syncRoute(undefined, resolveRouteLocation(payload.url, routeState.path))
      return
    }
    syncRoute()
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
