import type { Ref } from '../../reactivity'
import type { RouteLocationNormalizedLoaded, RouterNavigation } from '../types'

export interface ScrollRestorationController {
  /** 当前宿主是否支持带 routeEventId 的自动路由关联。 */
  readonly automatic: boolean
  /** 清除整个会话或指定路由 key 的快照，不注销组件。 */
  clear: (key?: string) => void
  /** 注销宿主监听、组件注册和未完成的恢复，并清空会话。 */
  dispose: () => void
}

export interface ScrollRestorationOptions<TRouteMap extends object = object> {
  router: RouterNavigation<TRouteMap>
  /** 自动捕获或恢复失败时调用；手动 scroll 的错误由调用者处理。 */
  onError?: (error: unknown) => void
}

export interface ScrollRestorationContext {
  readonly route: Readonly<RouteLocationNormalizedLoaded>
  readonly routeEventId?: string
  /** 异步自定义恢复在每次 await 后、写入宿主前必须重新检查。 */
  isActive: () => boolean
}

export interface ScrollRestorationRegistrationOptions {
  controller?: ScrollRestorationController
  /** 默认使用包含 query 的 route.fullPath。 */
  key?: string | ((route: Readonly<RouteLocationNormalizedLoaded>) => string)
  /** 同一页面和路由 key 内的独立容器名，默认为 default。 */
  id?: string
  /** 只捕获，不在原生路由完成后自动恢复。 */
  manual?: boolean
}

export interface UseScrollRestorationOptions<T extends object> extends ScrollRestorationRegistrationOptions {
  /** 同步返回独立快照；不能返回响应式活动对象或 Promise，null 表示清除。 */
  capture: () => (T & { then?: never }) | null
  restore: (snapshot: T | undefined, context: ScrollRestorationContext) => void | Promise<void>
}

export interface ScrollRestorationHandle {
  readonly automatic: boolean
  /** 等待组件就绪及宿主提交后恢复；已离开或失效时返回 false。 */
  scroll: () => Promise<boolean>
  /** 只清除当前 key/id 的快照。 */
  clear: () => void
  /** 停止当前注册；保留已捕获快照。 */
  stop: () => void
}

export interface ScrollViewRestorationHandle extends ScrollRestorationHandle {
  scrollTop: Ref<number>
  scrollLeft: Ref<number>
  /** 绑定 scroll-view 的 scroll 事件，只更新非响应式缓存。 */
  onScroll: (event: { detail: { scrollTop: number, scrollLeft: number } }) => void
}
