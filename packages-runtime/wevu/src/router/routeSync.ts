import type { MiniProgramPageLike } from '../routerInternal/shared'
import type { RouteLocationNormalizedLoaded } from './types'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import { isThenable } from '../utils'
import { resetPageLocation } from './instance'

export interface RouteStateSyncPayload {
  page?: MiniProgramPageLike
  route?: RouteLocationNormalizedLoaded
  url?: string
  source?: 'native' | 'page' | 'router'
  method?: NativeRouterMethodName
}

type RouteStateSyncHandler = (payload?: RouteStateSyncPayload) => void
type NativeRouterMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'

const ROUTE_SYNC_NATIVE_METHODS: readonly NativeRouterMethodName[] = ['switchTab', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack']
const routeStateSyncHandlers = new Set<RouteStateSyncHandler>()
const patchedNativeRouters = new WeakSet<Record<string, any>>()

export function registerRouteStateSyncHandler(handler: RouteStateSyncHandler): () => void {
  routeStateSyncHandlers.add(handler)
  return () => {
    routeStateSyncHandlers.delete(handler)
  }
}

export function notifyRouteStateSync(payload?: RouteStateSyncPayload) {
  for (const handler of routeStateSyncHandlers) {
    try {
      handler(payload)
    }
    catch {
      // 忽略单个 route 订阅者异常，避免阻塞原生导航成功回调。
    }
  }
}

/**
 * 位置发布策略。
 *
 * 与原生同步的驱动走全局广播，页面与组件订阅者都能收到；
 * 独立逻辑路由状态的驱动只更新本 router 的快照，不污染原生广播。
 */
export function publishRouteState(options: {
  /** 是否与原生同步。 */
  syncWithNative: boolean
  /** 更新本 router 的路由状态快照。 */
  updateRoute: (route?: RouteLocationNormalizedLoaded) => void
  /** 目标位置；省略时由订阅者按当前位置重读。 */
  route?: RouteLocationNormalizedLoaded
}): void {
  if (!options.syncWithNative) {
    options.updateRoute(options.route)
    return
  }
  notifyRouteStateSync(options.route ? { route: options.route, source: 'router' } : undefined)
}

function createNativeRouteStateSyncPayload(
  methodName: NativeRouterMethodName,
  option: unknown,
  sourcePage: MiniProgramPageLike | undefined,
): RouteStateSyncPayload | undefined {
  if (methodName === 'navigateBack') {
    return {
      method: methodName,
      source: 'native',
    }
  }
  if (option && typeof option === 'object') {
    const url = (option as Record<string, unknown>).url
    if (typeof url === 'string') {
      return {
        method: methodName,
        page: sourcePage,
        source: 'native',
        url,
      }
    }
  }
  return {
    method: methodName,
    page: sourcePage,
    source: 'native',
  }
}

export function installRouteStateSyncOnNativeRouter(nativeRouter: unknown) {
  if (!nativeRouter || typeof nativeRouter !== 'object') {
    return
  }
  const router = nativeRouter as Record<string, any>
  if (patchedNativeRouters.has(router)) {
    return
  }
  patchedNativeRouters.add(router)

  for (const methodName of ROUTE_SYNC_NATIVE_METHODS) {
    const original = router[methodName]
    if (typeof original !== 'function') {
      continue
    }

    router[methodName] = function routeStateSyncNativeRouterMethod(this: unknown, option?: unknown, ...args: any[]) {
      const pages = getCurrentMiniProgramPages() as MiniProgramPageLike[]
      const sourcePage = pages[pages.length - 1]
      let synced = false
      const syncRouteState = () => {
        if (synced) {
          return
        }
        synced = true
        if (methodName !== 'navigateBack') {
          const currentPages = getCurrentMiniProgramPages()
          resetPageLocation(currentPages[currentPages.length - 1])
        }
        notifyRouteStateSync(createNativeRouteStateSyncPayload(methodName, option, sourcePage))
      }

      const nextOption = option && typeof option === 'object'
        ? {
            ...(option as Record<string, any>),
            success: (...successArgs: any[]) => {
              syncRouteState()
              const originalSuccess = (option as Record<string, any>).success
              return typeof originalSuccess === 'function'
                ? originalSuccess(...successArgs)
                : undefined
            },
          }
        : option

      const result = original.call(this, nextOption, ...args)
      if (isThenable(result)) {
        result.then(syncRouteState, () => {})
      }
      return result
    }
  }
}
