import type { WevuNamedRouteMap } from '../router'
import type { SetupContextRouter } from '../runtime/types/props'
import type { RouteLocationNormalizedLoaded, UseRouteOptions } from './types'
import {
  useNativePageRouter as useNativePageRouterInternal,
  useNativeRouter as useNativeRouterInternal,
} from '../runtime/vueCompat'
import { getActiveRouter } from './instance'
import { createRouteStateController } from './routeStateController'

export type { UseRouteOptions }

/**
 * @description 读取当前路由状态快照
 */
export function useRoute<TRouteMap extends object = WevuNamedRouteMap>(
  options: UseRouteOptions<NoInfer<TRouteMap>> = {},
): Readonly<RouteLocationNormalizedLoaded<TRouteMap>> {
  // 路由表泛型只收窄公开快照；状态同步仍复用同一个运行时控制器。
  const activeRouter = getActiveRouter()
  // 独立逻辑路由状态不订阅原生广播，直接共享该 router 的可变 route 快照。
  if (activeRouter?.options.history?.syncWithNative === false) {
    return activeRouter.currentRoute as unknown as Readonly<RouteLocationNormalizedLoaded<TRouteMap>>
  }
  const runtimeOptions = options as unknown as UseRouteOptions
  const route = createRouteStateController(runtimeOptions).route
  return route as unknown as Readonly<RouteLocationNormalizedLoaded<TRouteMap>>
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
