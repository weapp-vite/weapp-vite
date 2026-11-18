import type { MiniProgramPageLike } from '../routerInternal/types'
import type { SetupContextRouter } from '../runtime/types/props'
import type { LocationQueryRaw, NavigationFailure, NavigationGuardResult, RouteLocationNormalizedLoaded, RouteLocationRaw, RouteQueryStringifier } from './types'

/** 历史驱动可读取的宿主页面实例。 */
export type RouterHistoryPage = MiniProgramPageLike

/** 前后退计划；规划阶段不得修改位置，只有守卫放行后才执行 go。 */
export interface RouterHistoryTraversal {
  target?: RouteLocationNormalizedLoaded
  failure?: NavigationFailure
  noop?: boolean
}

type HistoryWrite = (to: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded) => void | NavigationFailure | Promise<void | NavigationFailure>

/**
 * 位置校验结果。
 *
 * 与守卫结果共用同一套契约：驱动级拦截与守卫级拦截对「放行 / 中止 / 改道」的判断必须一致，
 * 否则同一个返回值在两处含义不同，业务侧无法统一处理。
 *
 * - `undefined`：放行，继续执行后续校验与提交；
 * - `true`：放行，与 `undefined` 等价；
 * - `false`：中止本次导航，产出失败，不提交、不发布目标位置；
 * - `Error`：以该错误中止（对齐 Vue Router，`message` 保留在失败原因里）；
 * - `NavigationFailure`：中止本次导航，产出失败，不提交、不发布目标位置；
 * - 原始位置（字符串或位置对象）：改道到该位置，框架按守卫重定向的同一套机制重新走一遍导航流水线；
 * - `NavigationRedirect`（`{ to, replace }`）：改道到指定位置，并显式声明替换或压栈。
 *
 * 改道目标的原始位置由框架解析，解析基准与守卫重定向一致。
 */
export type RouterHistoryCheckResult = NavigationGuardResult

/**
 * 位置校验；允许返回 Promise（异步校验时使用）。
 *
 * 这是驱动自己的位置校验落点：`to` / `from` 是框架解析出的位置，驱动可按自己的
 * 位置语义替换平台校验或改道。通用业务拦截（登录、二次确认）用守卫——守卫的
 * `to` / `from` 会带上应用自定义位置表示（如外置 query），无需在驱动里再实现一套。
 */
export type RouterHistoryCheck = (
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  allowSameLocation: boolean,
) => RouterHistoryCheckResult | Promise<RouterHistoryCheckResult>

/** 历史驱动实例；低层覆盖完整接管，省略的方法继承默认行为。 */
export interface RouterHistoryAdapter {
  /** 位置校验；驱动可在此拦截导航，返回 `false` 或 failure 中止、返回位置或 `NavigationRedirect` 改道。 */
  check: RouterHistoryCheck
  push: HistoryWrite
  replace: HistoryWrite
  resolveGo: (delta: number, from: RouteLocationNormalizedLoaded) => RouterHistoryTraversal
  go: (delta: number, to: RouteLocationNormalizedLoaded | undefined, from: RouteLocationNormalizedLoaded) => void | NavigationFailure | Promise<void | NavigationFailure>
  /** 从宿主或自定义存储读取位置，供生命周期同步及返回目标解析使用。 */
  readLocation: (page: RouterHistoryPage | undefined, query?: LocationQueryRaw) => RouteLocationNormalizedLoaded
  /** 把自定义位置表示应用到已解析位置，供守卫读取 to/from 与解析改道目标。 */
  readResolvedLocation: (location: RouteLocationNormalizedLoaded) => RouteLocationNormalizedLoaded
  /** 原生非返回导航成功后，释放目标页面的自定义位置。 */
  resetLocation: (page: RouterHistoryPage | undefined) => void
}

/** 历史驱动初始化上下文的基础部分，由 createRouter 提供。 */
export interface RouterHistoryContextBase {
  readonly nativeRouter: SetupContextRouter
  readonly tabBarPaths: ReadonlySet<string>
  readonly stringifyQuery: RouteQueryStringifier
  readonly resolve: (to: RouteLocationRaw) => RouteLocationNormalizedLoaded
  readonly getCurrentPage: () => RouterHistoryPage | undefined
  /** 自定义位置在导航方法之外变化后通知路由订阅者。 */
  readonly notifyLocationChange: (to?: RouteLocationRaw) => void
}

/** 历史驱动初始化上下文；每个路由器仅初始化一次。 */
export interface RouterHistoryContext extends RouterHistoryContextBase {
  /** 默认适配器：把导航委托给小程序原生页面栈。 */
  readonly defaultHistory: RouterHistoryAdapter
}

/**
 * 应用实现的钩子；省略的方法沿用默认行为。
 *
 * 语义与 Vue Router 的 history 一致：位置由驱动持有，
 * 应用覆盖 `push` / `replace` 即接管提交，覆盖 `readLocation` 即接管读取。
 */
export interface RouterHistoryHooks {
  /**
   * 返回当前位置；undefined 表示沿用标准位置。
   * 应用用 `context.resolve` 解析自有位置表示（路径投影、外置 query 等），
   * 框架直接采用结果，不再二次合并。
   */
  readLocation?: (location: RouteLocationNormalizedLoaded) => RouteLocationNormalizedLoaded | undefined
  /**
   * 位置校验与业务拦截落点；省略时沿用平台规则。
   *
   * - 返回 `undefined`：放行；
   * - 返回 `false` / `Error`：中止本次导航；
   * - 返回 `NavigationFailure`：中止本次导航；
   * - 返回原始位置：改道到该位置，框架按重定向的同一套机制重跑导航流水线；
   * - 返回 `NavigationRedirect`（`{ to, replace }`）：改道并显式声明替换或压栈。
   */
  check?: RouterHistoryAdapter['check']
  /** 提交一次压栈导航；返回 failure 表示拒绝本次导航。 */
  push?: RouterHistoryAdapter['push']
  /** 提交一次替换导航；返回 failure 表示拒绝本次导航。 */
  replace?: RouterHistoryAdapter['replace']
  /** 规划前后退目标。 */
  resolveGo?: RouterHistoryAdapter['resolveGo']
  /** 执行前后退。 */
  go?: RouterHistoryAdapter['go']
  /** 释放目标页面的自定义位置。 */
  resetLocation?: RouterHistoryAdapter['resetLocation']
}

/** 可由应用实现的历史工厂；原生同步以外的驱动拥有独立逻辑路由状态。 */
export interface RouterHistory {
  readonly syncWithNative?: boolean
  create: (context: RouterHistoryContext) => RouterHistoryHooks
}
