import type { QueryStore } from './externalQueryHistory'
import type {
  NavigationFailure,
  RouteLocationNormalizedLoaded,
  RouterHistory,
  RouterHistoryContext,
} from '@/router'
import { createNavigationFailure, NavigationFailureType } from '@/router'
import { createExternalQueryHistory } from './externalQueryHistory'

/** 保留 tabBar 页 query 的驱动与通知入口。 */
export interface SwitchTabQueryHistory {
  /** 交给 createRouter 的历史驱动。 */
  readonly history: RouterHistory
  /** 业务侧改写存储后通知路由刷新快照。 */
  readonly notify: () => void
}

function toAbsolutePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof Reflect.get(value, 'then') === 'function'
}

/**
 * 显式调用 switchTab，并沿用框架的失败语义：success / Promise resolve 视为成功，
 * fail / Promise reject / throw 产出普通原生失败。
 */
function commitSwitchTab(
  method: RouterHistoryContext['nativeRouter']['switchTab'],
  url: string,
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
): Promise<void | NavigationFailure> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (failure?: NavigationFailure) => {
      if (settled) {
        return
      }
      settled = true
      resolve(failure)
    }
    const fail = (error: unknown) => {
      settle(createNavigationFailure(NavigationFailureType.unknown, to, from, error))
    }

    try {
      const result = method({
        url,
        success: () => settle(),
        fail,
      })
      if (isThenable(result)) {
        result.then(() => settle(), fail)
      }
    }
    catch (error) {
      fail(error)
    }
  })
}

/**
 * 业务侧用例：tabBar 页的 push / replace 都显式走 switchTab，query 按 path 外置。
 *
 * 复用外置 query 驱动的读取与通知，只改写两处：
 * 1. tab 目标自己调用 `switchTab`，URL 收敛成 path，业务 query 不进原生 URL；
 * 2. tab 目标跳过默认校验（同页 query 变更、tab 携带 query 必须放行），非 tab 目标仍委托默认校验。
 */
export function createSwitchTabQueryHistory(store: QueryStore): SwitchTabQueryHistory {
  const external = createExternalQueryHistory(store)
  const history: RouterHistory = {
    create(context) {
      const { nativeRouter, tabBarPaths, defaultHistory } = context
      const baseHooks = external.history.create(context)

      const commitTab = async (
        to: RouteLocationNormalizedLoaded,
        from: RouteLocationNormalizedLoaded,
      ) => {
        const failure = await commitSwitchTab(nativeRouter.switchTab, toAbsolutePath(to.path), to, from)
        if (!failure) {
          store.set(to.path, to.query)
        }
        return failure
      }
      const write = (mode: 'push' | 'replace') => (
        to: RouteLocationNormalizedLoaded,
        from: RouteLocationNormalizedLoaded,
      ) => tabBarPaths.has(to.path)
        // tab 目标一律显式 switchTab，包括同 path 的 query 变更：这里刻意不像
        // createExternalQueryHistory 那样按 to.path === from.path 短路，因为用例要求
        // push / replace 到 tabBar 都走 switchTab 这一条原生路径。
        ? commitTab(to, from)
        : defaultHistory[mode](to, from)

      return {
        ...baseHooks,
        check: (to, from, allowSameLocation) => tabBarPaths.has(to.path)
          ? undefined
          : defaultHistory.check(to, from, allowSameLocation),
        push: write('push'),
        replace: write('replace'),
      }
    },
  }
  return {
    history,
    // 依赖 history.create 里对 external.history.create 的调用：那次调用会绑定 external 的 notify 到本 router 的 context。
    notify: external.notify,
  }
}
