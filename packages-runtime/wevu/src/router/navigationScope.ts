import type { RouteStateSyncPayload } from './routeSync'
import type { RouteLocationNormalizedLoaded } from './types'

/**
 * 导航作用域：区分「本 router 主动发起的受管导航」与「宿主 / 页面触发的外部同步」。
 *
 * 判定规则集中在这里，避免散落在路由装配代码中的可变标记：
 * - 受管导航进行中产生的同步是自身回声，一律忽略；
 * - 受管导航刚完成时，路径一致的同步是宿主对自身导航的确认，同样忽略；
 * - 其余「返回 / 页面切换」类外部同步需要重新走一次返回守卫。
 */
export interface NavigationScope {
  /** 当前受管导航的目标路径；用于识别宿主对自身导航的确认。 */
  readonly activeTargetPath: string | undefined
  /** 开始一次受管导航。 */
  beginManaged: () => void
  /** 结束一次受管导航。 */
  endManaged: () => void
  /** 记录即将执行的位置（受管导航目标或返回计划目标）。 */
  setActiveTarget: (targetPath: string | undefined) => void
  /** 记录受管导航完成后的路径，用于抑制随后的自身回声。 */
  markManagedEcho: (path: string) => void
  /**
   * 判断一次外部同步是否需要按返回处理。
   * 返回 `true` 表示调用方已接管本次同步，处理结束后需调用 `completeExternalSync`。
   */
  acceptExternalSync: (
    nextRoute: RouteLocationNormalizedLoaded,
    payload: RouteStateSyncPayload,
    currentPath: string,
  ) => boolean
  /** 结束一次外部同步处理。 */
  completeExternalSync: () => void
}

/** 外部同步判定：页面切换与原生返回都属于宿主侧行为。 */
function isExternalBackSync(payload: RouteStateSyncPayload): boolean {
  return payload.source === 'page'
    || (payload.source === 'native' && payload.method === 'navigateBack')
}

/** 创建导航作用域状态机。 */
export function createNavigationScope(): NavigationScope {
  let managedDepth = 0
  let activeTargetPath: string | undefined
  let pendingManagedEchoPath: string | undefined
  let pendingExternalPath: string | undefined

  return {
    get activeTargetPath() {
      return activeTargetPath
    },
    beginManaged() {
      managedDepth += 1
    },
    endManaged() {
      managedDepth -= 1
      if (managedDepth <= 0) {
        managedDepth = 0
        activeTargetPath = undefined
      }
    },
    setActiveTarget(targetPath) {
      activeTargetPath = targetPath
    },
    markManagedEcho(path) {
      pendingManagedEchoPath = path
    },
    acceptExternalSync(nextRoute, payload, currentPath) {
      if (managedDepth > 0) {
        return false
      }
      if (!isExternalBackSync(payload)) {
        return false
      }
      if (pendingExternalPath !== undefined) {
        return false
      }
      if (pendingManagedEchoPath !== undefined) {
        const expectedPath = pendingManagedEchoPath
        pendingManagedEchoPath = undefined
        if (nextRoute.fullPath === expectedPath) {
          return false
        }
      }
      if (nextRoute.fullPath === currentPath) {
        return false
      }
      pendingExternalPath = nextRoute.fullPath
      return true
    },
    completeExternalSync() {
      pendingExternalPath = undefined
    },
  }
}
