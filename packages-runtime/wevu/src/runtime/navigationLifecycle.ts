import type { LocationQueryRaw } from '../router/types'
import type { MiniProgramPageLike } from '../routerInternal/types'

export interface InitialNavigationLifecycle {
  ensure: (
    instance: MiniProgramPageLike,
    query?: LocationQueryRaw,
    options?: { start?: boolean, onComplete?: (shouldMount: boolean) => void },
  ) => Promise<boolean> | undefined
  cancel: (instance: MiniProgramPageLike) => void
}

let initialNavigationLifecycle: InitialNavigationLifecycle | undefined

/**
 * 路由器注册首航任务时接入生命周期，基础组件不直接依赖导航状态机。
 */
export function registerInitialNavigationLifecycle(lifecycle: InitialNavigationLifecycle): void {
  initialNavigationLifecycle = lifecycle
}

/**
 * 没有路由器时保留同步挂载，注册后实时转发到同一份首航状态机。
 */
export function ensureInitialNavigation(...args: Parameters<InitialNavigationLifecycle['ensure']>) {
  return initialNavigationLifecycle?.ensure(...args)
}

/**
 * 转发页面卸载，确保正在等待的首航守卫不会在卸载后继续挂载。
 */
export function cancelInitialNavigation(instance: MiniProgramPageLike): void {
  initialNavigationLifecycle?.cancel(instance)
}
