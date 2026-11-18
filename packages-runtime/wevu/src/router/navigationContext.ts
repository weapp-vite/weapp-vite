import type { NamedRouteLookup } from '../routerInternal/shared'
import type { SetupContextRouter } from '../runtime/types/props'
import type { RouterHistoryAdapter } from './history'
import type {
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'

/**
 * 导航内核共享的依赖集合。
 *
 * 守卫集合、目标解析器与历史驱动在一次 `createRouter` 中固定，导航链各层只接收本上下文，
 * 避免同一组依赖在「导航 API → 目标流水线 → 返回守卫」之间被逐层重复列举。
 */
export interface RouterNavigationContext {
  /** 已编译的历史驱动：负责分类校验与提交。 */
  readonly history: RouterHistoryAdapter
  /** 宿主原生路由对象。 */
  readonly nativeRouter: SetupContextRouter
  /** 命名路由索引。 */
  readonly namedRouteLookup: NamedRouteLookup
  /** 全局前置守卫。 */
  readonly beforeEachGuards: ReadonlySet<NavigationGuard>
  /** 全局解析前置守卫。 */
  readonly beforeResolveGuards: ReadonlySet<NavigationGuard>
  /** 单次导航允许的最大重定向次数。 */
  readonly maxRedirects: number
  /** 目标解析：把原始位置解析为标准化位置。 */
  readonly resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
  /** 守卫可见的位置：应用自定义存储未显式覆盖时读回存储 query；提交仍用原始位置。 */
  readonly readGuardTarget: (location: RouteLocationNormalizedLoaded) => RouteLocationNormalizedLoaded
}

/**
 * 返回导航守卫链所需的最小依赖。
 * 返回路径不触碰历史驱动，因此只声明真正用到的部分。
 */
export type BackNavigationContext = Pick<
  RouterNavigationContext,
  'nativeRouter' | 'beforeEachGuards' | 'beforeResolveGuards' | 'resolveWithCodec' | 'readGuardTarget'
>
