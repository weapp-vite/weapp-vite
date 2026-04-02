import type { ComputedDefinitions, MethodDefinitions } from '../core'
import type { TriggerEventOptions } from '../miniprogram'
import type { InternalRuntimeState, RuntimeInstance } from '../runtime'
import type { ComponentPropsOptions, InferProps } from './propTypes'
import type { SetupContextRouter } from './router'

export type SetupFunction<
  P extends ComponentPropsOptions,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
  R extends Record<string, any> | void = Record<string, any> | void,
> = (
  props: InferProps<P>,
  ctx: SetupContext<D, C, M, P>,
) => R

export type SetupContextNativeInstance = InternalRuntimeState & {
  /**
   * 派发组件事件（页面/应用场景下不可用时会安全降级为 no-op）
   */
  triggerEvent: (eventName: string, detail?: any, options?: TriggerEventOptions) => void

  /**
   * 创建选择器查询对象（不可用时返回 undefined）
   */
  createSelectorQuery: () => WechatMiniprogram.SelectorQuery | undefined

  /**
   * 创建交叉观察器（不可用时返回 undefined）
   */
  createIntersectionObserver: (
    options?: WechatMiniprogram.CreateIntersectionObserverOption,
  ) => WechatMiniprogram.IntersectionObserver | undefined

  /**
   * 提交视图层更新
   */
  setData: (payload: Record<string, any>, callback?: () => void) => void | Promise<void> | undefined

  /**
   * 监听组件更新性能统计（不可用时返回 undefined）
   */
  setUpdatePerformanceListener: (
    listener?: ((result: Record<string, any>) => void),
  ) => void | undefined

  /**
   * 相对于当前组件路径的 Router（基础库 2.16.1+）。
   * 低版本基础库可能不存在，建议优先使用 `useNativeRouter()` 获取带降级能力的路由对象。
   */
  router?: SetupContextRouter

  /**
   * 相对于当前页面路径的 Router（基础库 2.16.1+）。
   * 低版本基础库可能不存在，建议优先使用 `useNativePageRouter()` 获取带降级能力的路由对象。
   */
  pageRouter?: SetupContextRouter
}

export interface SetupContext<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
  P extends ComponentPropsOptions = ComponentPropsOptions,
> {
  /**
   * 组件 props（来自小程序 properties）
   */
  props: InferProps<P>

  /**
   * 运行时实例
   */
  runtime: RuntimeInstance<D, C, M>

  /**
   * 响应式状态
   */
  state: D

  /**
   * 公开实例代理
   */
  proxy: RuntimeInstance<D, C, M>['proxy']

  /**
   * 双向绑定辅助方法
   */
  bindModel: RuntimeInstance<D, C, M>['bindModel']

  /**
   * watch 辅助方法
   */
  watch: RuntimeInstance<D, C, M>['watch']

  /**
   * 小程序内部实例
   */
  instance: SetupContextNativeInstance

  /**
   * 通过小程序 `triggerEvent(eventName, detail?, options?)` 派发事件。
   *
   * 为兼容 Vue 3 的 `emit(event, ...args)`：
   * - `emit(name)` -> `detail = undefined`
   * - `emit(name, payload)` -> `detail = payload`
   * - `emit(name, payload, options)`（当最后一个参数是事件选项）-> `detail = payload`
   * - `emit(name, a, b, c)` -> `detail = [a, b, c]`
   */
  emit: (event: string, ...args: any[]) => void

  /**
   * Vue 3 对齐：expose 公共属性
   */
  expose: (exposed: Record<string, any>) => void

  /**
   * Vue 3 对齐：attrs（小程序场景为非 props 属性集合）
   */
  attrs: Record<string, any>

  /**
   * Vue 3 对齐：slots（小程序场景为只读空对象兜底，不提供可调用 slot 函数）
   */
  slots: Record<string, any>
}
