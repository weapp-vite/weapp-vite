import type { MiniProgramPageLike } from '../routerInternal/types'
import type { RouterHistoryAdapter } from './history'
import type { LocationQueryRaw, RouteLocationNormalizedLoaded, RouterNavigation } from './types'
import { resolvePageRoute } from '../routerInternal/shared'
import { injectGlobal, provideGlobal } from '../runtime/provide'

const ROUTER_INSTANCE_KEY = Symbol('wevu.router.instance')

let activeRouter: RouterNavigation | undefined
const routerHistories = new WeakMap<RouterNavigation, RouterHistoryAdapter>()

export function setActiveRouter(router: RouterNavigation) {
  activeRouter = router
  provideGlobal(ROUTER_INSTANCE_KEY, router)
}

export function clearActiveRouter() {
  activeRouter = undefined
  provideGlobal(ROUTER_INSTANCE_KEY, undefined)
}

export function getActiveRouter() {
  return activeRouter ?? injectGlobal<RouterNavigation | undefined>(ROUTER_INSTANCE_KEY, undefined)
}

/** 关联路由器与位置提供者；核心不持有自定义页面状态。 */
export function registerRouterHistory(router: RouterNavigation, history: RouterHistoryAdapter) {
  routerHistories.set(router, history)
}

/** 无 router 上下文的读取（useRoute / 原生同步）只能取当前活动路由器的驱动。 */
function activeHistory() {
  const router = getActiveRouter()
  return router && routerHistories.get(router)
}

/** 释放目标页面的自定义位置。 */
export function resetPageLocation(page: MiniProgramPageLike | undefined) {
  activeHistory()?.resetLocation(page)
}

/** 读取当前位置：优先使用活动路由器的驱动，其次回落到宿主页面位置。 */
export function resolvePageRouteState(page: MiniProgramPageLike | undefined, query?: LocationQueryRaw): RouteLocationNormalizedLoaded {
  return activeHistory()?.readLocation(page, query) ?? resolvePageRoute(page, query)
}
