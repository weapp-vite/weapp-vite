import type { MiniProgramPageLike } from '../routerInternal/types'
import type { MiniProgramPageLifetime } from '../runtime/types'
import type { RouteStateSyncPayload } from './routeSync'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded, UseRouteOptions } from './types'
import { WEVU_NATIVE_INSTANCE_KEY } from '@weapp-core/constants'
import { reactive, readonly } from '../reactivity'
import { getCurrentMiniProgramPage } from '../routerInternal/location'
import { cloneLocationQuery, cloneRouteLocationRedirectedFrom, cloneRouteMeta, cloneRouteParams, cloneRouteRecordMatchedList } from '../routerInternal/shared'
import { getCurrentSetupContext, onLoad, onReady, onRouteDone, onShow, onUnload } from '../runtime/hooks'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import { getActiveRouter, resolvePageRouteState } from './instance'
import { resolveRouteLocation } from './resolve'
import { registerRouteStateSyncHandler } from './routeSync'

export interface RouteStateControllerOptions extends UseRouteOptions {
  readLocation?: typeof resolvePageRouteState
  isolated?: boolean
  beforeRouteStateSync?: (
    nextRoute: RouteLocationNormalizedLoaded,
    payload: RouteStateSyncPayload,
  ) => void
}

export interface RouteStateController {
  route: Readonly<RouteLocationNormalizedLoaded>
  /** 传入新位置时直接应用；省略时按当前位置重新读取（脱离原生同步的驱动使用）。 */
  update: (route?: RouteLocationNormalizedLoaded) => void
}

function isPageLikeInstance(instance: Record<string, any>): boolean {
  return typeof instance.route === 'string' || typeof instance.__route__ === 'string'
}

function resolveRouteControllerInstance(instance: Record<string, any>): Record<string, any> {
  const nativeInstance = instance[WEVU_NATIVE_INSTANCE_KEY]
  return nativeInstance && typeof nativeInstance === 'object'
    ? nativeInstance
    : instance
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

  const routeControllerInstance = resolveRouteControllerInstance(instance)
  if (payload?.page) {
    return payload.page === routeControllerInstance
  }

  const pages = getCurrentMiniProgramPages()
  return pages[pages.length - 1] === routeControllerInstance
}

/** 可选派生字段：解析结果缺失时从快照中删除，保持字段形状一致。 */
type OptionalRouteField = 'name' | 'meta' | 'href' | 'matched' | 'redirectedFrom'

/** 写入可选派生字段；值为 undefined 时删除该字段。 */
function applyOptionalRouteField<K extends OptionalRouteField>(
  routeState: RouteLocationNormalizedLoaded,
  key: K,
  value: RouteLocationNormalizedLoaded[K] | undefined,
): void {
  if (value === undefined) {
    Reflect.deleteProperty(routeState, key)
    return
  }
  routeState[key] = value
}

/** 逐字段写入路由状态：派生字段整体替换，缺失字段删除。 */
function applyRouteState(
  routeState: RouteLocationNormalizedLoaded,
  nextRoute: RouteLocationNormalizedLoaded,
) {
  routeState.path = nextRoute.path
  routeState.fullPath = nextRoute.fullPath
  routeState.query = cloneLocationQuery(nextRoute.query)
  routeState.hash = nextRoute.hash
  routeState.params = cloneRouteParams(nextRoute.params)
  applyOptionalRouteField(routeState, 'name', nextRoute.name)
  applyOptionalRouteField(routeState, 'meta', nextRoute.meta === undefined ? undefined : cloneRouteMeta(nextRoute.meta))
  applyOptionalRouteField(routeState, 'href', nextRoute.href)
  applyOptionalRouteField(routeState, 'matched', nextRoute.matched === undefined ? undefined : cloneRouteRecordMatchedList(nextRoute.matched))
  applyOptionalRouteField(routeState, 'redirectedFrom', nextRoute.redirectedFrom === undefined ? undefined : cloneRouteLocationRedirectedFrom(nextRoute.redirectedFrom))
}

/**
 * 创建路由状态控制器。
 *
 * 控制器持有唯一一份可变的路由状态：页面级订阅者只接收自身页面的广播，
 * 独立逻辑路由状态（`isolated`）不订阅原生广播，由本 router 直接更新。
 */
export function createRouteStateController(options: RouteStateControllerOptions = {}): RouteStateController {
  const setupContext = getCurrentSetupContext<{ instance?: unknown }>()
  const fallbackPage = setupContext?.instance && typeof setupContext.instance === 'object'
    ? setupContext.instance as MiniProgramPageLike & Record<string, unknown>
    : undefined
  const resolveRoute = options.resolveRoute
    ?? ((route: RouteLocationNormalizedLoaded) => getActiveRouter()?.resolve(route) ?? route)
  const readLocation = options.readLocation ?? resolvePageRouteState
  const readCurrentLocation = (query?: LocationQueryRaw) =>
    readLocation(getCurrentMiniProgramPage(fallbackPage), query)
  const currentRoute = resolveRoute(readCurrentLocation())
  // 初始字面量只是占位：位置字段随后由 `applyRouteState` 全量写入，不必在这里重复克隆一次。
  const routeState = reactive<RouteLocationNormalizedLoaded>({
    path: '',
    fullPath: '',
    query: {},
    hash: '',
    params: {},
  })
  applyRouteState(routeState, currentRoute)

  function syncRoute(
    queryOverride?: LocationQueryRaw,
    routeOverride?: RouteLocationNormalizedLoaded,
    payload?: RouteStateSyncPayload,
  ) {
    const nextRoute = routeOverride
      ? resolveRoute(routeOverride)
      : resolveRoute(readCurrentLocation(queryOverride))
    if (payload) {
      options.beforeRouteStateSync?.(nextRoute, payload)
    }
    applyRouteState(routeState, nextRoute)
  }

  const update: RouteStateController['update'] = (next) => {
    if (next) {
      applyRouteState(routeState, resolveRoute(next))
    }
    else {
      syncRoute()
    }
  }

  if (options.isolated) {
    return { route: readonly(routeState), update }
  }

  if (!fallbackPage) {
    const unregisterRouteStateSync = registerRouteStateSyncHandler((payload) => {
      if (payload?.route) {
        syncRoute(undefined, payload.route, payload)
        return
      }
      if (payload?.url) {
        syncRoute(undefined, resolveRouteLocation(payload.url, routeState.path), payload)
        return
      }
      if (payload?.page) {
        syncRoute(undefined, readLocation(payload.page), payload)
        return
      }
      syncRoute(undefined, undefined, payload)
    })
    void unregisterRouteStateSync
    return {
      route: readonly(routeState) as Readonly<RouteLocationNormalizedLoaded>,
      update,
    }
  }

  const pageInstance = fallbackPage
  const initialRouteControllerInstance = resolveRouteControllerInstance(pageInstance)
  const isPageController = isPageLikeInstance(initialRouteControllerInstance)
    || getCurrentMiniProgramPages().includes(initialRouteControllerInstance)

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
    if (!shouldSyncRouteStateForInstance(pageInstance, isPageController, payload)) {
      return
    }
    if (payload?.route) {
      syncRoute(undefined, payload.route, payload)
      return
    }
    if (payload?.url) {
      syncRoute(undefined, resolveRouteLocation(payload.url, routeState.path), payload)
      return
    }
    if (payload?.page) {
      syncRoute(undefined, readLocation(payload.page), payload)
      return
    }
    syncRoute(undefined, undefined, payload)
  })
  onUnload(() => {
    unregisterRouteStateSync()
  })

  return {
    route: readonly(routeState) as Readonly<RouteLocationNormalizedLoaded>,
    update,
  }
}
