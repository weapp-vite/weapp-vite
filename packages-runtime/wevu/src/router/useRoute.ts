import type { MiniProgramPageLifetime } from '../runtime/types'
import type { SetupContextRouter } from '../runtime/types/props'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded } from './types'
import { reactive, readonly } from '../reactivity'
import { resolveCurrentRoute } from '../routerInternal/shared'
import { getCurrentSetupContext, onLoad, onReady, onRouteDone, onShow } from '../runtime/hooks'
import {
  useNativePageRouter as useNativePageRouterInternal,
  useNativeRouter as useNativeRouterInternal,
} from '../runtime/vueCompat'

export function useRoute(): Readonly<RouteLocationNormalizedLoaded> {
  const setupContext = getCurrentSetupContext()
  if (!setupContext) {
    throw new Error('useRoute() 必须在 setup() 的同步阶段调用')
  }

  const fallbackPage = setupContext.instance
  const currentRoute = resolveCurrentRoute(undefined, fallbackPage)
  const routeState = reactive<RouteLocationNormalizedLoaded>({
    path: currentRoute.path,
    fullPath: currentRoute.fullPath,
    query: currentRoute.query,
    hash: currentRoute.hash,
    params: currentRoute.params,
    name: currentRoute.name,
  })
  if (currentRoute.meta !== undefined) {
    routeState.meta = currentRoute.meta
  }

  function syncRoute(queryOverride?: LocationQueryRaw) {
    const nextRoute = resolveCurrentRoute(queryOverride, fallbackPage)
    routeState.path = nextRoute.path
    routeState.fullPath = nextRoute.fullPath
    routeState.query = nextRoute.query
    routeState.hash = nextRoute.hash
    if (nextRoute.meta === undefined) {
      delete (routeState as Partial<RouteLocationNormalizedLoaded>).meta
    }
    else {
      routeState.meta = nextRoute.meta
    }
    routeState.params = nextRoute.params
    routeState.name = nextRoute.name
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

  return readonly(routeState) as Readonly<RouteLocationNormalizedLoaded>
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
