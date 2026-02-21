import type { ComputedDefinitions, MethodDefinitions } from './core'
import type { InternalRuntimeState, RuntimeInstance } from './runtime'

type PropMethod<T, TConstructor = any> = [T] extends
  | [((...args: any) => any) | undefined]
  ? { new (): TConstructor, (): T, readonly prototype: TConstructor }
  : never

export type PropConstructor<T = any>
  = | { new (...args: any[]): T & object }
    | { (): T }
    | PropMethod<T>
export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]
export type ComponentPropsOptions = Record<string, PropOptions<any> | PropType<any> | null>

export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  /**
   * 默认值（对齐 Vue 的 `default`；会被赋给小程序 property 的 `value`）
   */
  default?: T | (() => T)
  /**
   * 小程序 `value` 的别名
   */
  value?: T | (() => T)
  required?: boolean
}

type HasDefault<T>
  = T extends { default: infer D }
    ? D extends (() => undefined) | undefined
      ? false
      : true
    : T extends { value: infer V }
      ? V extends (() => undefined) | undefined
        ? false
        : true
      : false

type IsBooleanProp<T>
  = T extends { type?: infer U }
    ? IsBooleanProp<U>
    : T extends readonly any[]
      ? true extends IsBooleanProp<T[number]> ? true : false
      : T extends BooleanConstructor ? true : false

type RequiredKeys<T> = {
  [K in keyof T]:
  T[K] extends { required: true }
    ? K
    : HasDefault<T[K]> extends true
      ? K
      : IsBooleanProp<T[K]> extends true
        ? K
        : never
}[keyof T]

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>
type DefaultKeys<T> = {
  [K in keyof T]:
  HasDefault<T[K]> extends true
    ? K
    : IsBooleanProp<T[K]> extends true
      ? K
      : never
}[keyof T]

export type InferPropType<O>
  = O extends null ? any
    : O extends { type?: infer T } ? InferPropConstructor<T>
      : O extends PropType<infer V> ? V
        : InferPropConstructor<O>

type InferPropConstructor<T>
  = T extends readonly any[] ? InferPropConstructor<T[number]>
    : T extends undefined ? any
      : T extends null ? any
        : T extends BooleanConstructor ? boolean
          : T extends NumberConstructor ? number
            : T extends StringConstructor ? string
              : T extends DateConstructor ? Date
                : T extends ArrayConstructor ? any[]
                  : T extends ObjectConstructor ? Record<string, any>
                    : T extends PropConstructor<infer V> ? V
                      : any

export type InferProps<P extends ComponentPropsOptions = ComponentPropsOptions> = {
  [K in keyof Pick<P, RequiredKeys<P>>]:
  HasDefault<P[K]> extends true
    ? Exclude<InferPropType<P[K]>, undefined>
    : InferPropType<P[K]>
} & {
  [K in keyof Pick<P, OptionalKeys<P>>]?: InferPropType<P[K]>
}

export type ExtractPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = InferProps<P>
export type ExtractPublicPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = InferProps<P>
export type ExtractDefaultPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = {
  [K in keyof Pick<P, DefaultKeys<P>>]: InferPropType<P[K]>
}

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
  instance: InternalRuntimeState

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
