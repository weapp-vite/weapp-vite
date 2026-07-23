import type { MiniProgramPageLike } from '../routerInternal/shared'
import type { RouteLocationNormalizedLoaded } from './types'

export interface RouteStateSyncPayload {
  page?: MiniProgramPageLike
  route?: RouteLocationNormalizedLoaded
  url?: string
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

function createNativeRouteStateSyncPayload(methodName: NativeRouterMethodName, option: unknown): RouteStateSyncPayload | undefined {
  if (methodName === 'navigateBack') {
    return undefined
  }
  if (option && typeof option === 'object') {
    const url = (option as Record<string, unknown>).url
    if (typeof url === 'string') {
      return { url }
    }
  }
  return undefined
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
      let synced = false
      const syncRouteState = () => {
        if (synced) {
          return
        }
        synced = true
        notifyRouteStateSync(createNativeRouteStateSyncPayload(methodName, option))
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
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        ;(result as PromiseLike<unknown>).then(syncRouteState, () => {})
      }
      return result
    }
  }
}
