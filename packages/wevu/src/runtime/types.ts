import type {
  ComputedGetter,
  WatchOptions,
  WatchStopHandle,
  WritableComputedOptions,
} from '../reactivity'

export type ComputedDefinitions = Record<string, ComputedGetter<any> | WritableComputedOptions<any>>
export type MethodDefinitions = Record<string, (...args: any[]) => any>

export type ExtractComputed<C extends ComputedDefinitions> = {
  [K in keyof C]: C[K] extends ComputedGetter<infer R> ? R
    : C[K] extends WritableComputedOptions<infer R> ? R : never
}

export type ExtractMethods<M extends MethodDefinitions> = {
  [K in keyof M]: M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never
}

export type ComponentPublicInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>
  = D & ExtractComputed<C> & ExtractMethods<M>

export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

export interface ModelBindingOptions<T = any> {
  event?: string
  valueProp?: string
  parser?: (payload: any) => T
  formatter?: (value: T) => any
}

export interface ModelBinding<T = any> {
  value: T
  update: (value: T) => void
  model: (options?: ModelBindingOptions<T>) => Record<string, any>
}

export interface AppConfig {
  globalProperties: Record<string, any>
}

export type WevuPlugin = ((app: RuntimeApp<any, any, any>, ...options: any[]) => any) | {
  install: (app: RuntimeApp<any, any, any>, ...options: any[]) => any
}

export interface RuntimeApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  mount: (adapter?: MiniProgramAdapter) => RuntimeInstance<D, C, M>
  use: (plugin: WevuPlugin, ...options: any[]) => RuntimeApp<D, C, M>
  config: AppConfig
}

export interface RuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions> {
  readonly state: D
  readonly proxy: ComponentPublicInstance<D, C, M>
  readonly methods: ExtractMethods<M>
  readonly computed: Readonly<ExtractComputed<C>>
  readonly adapter?: MiniProgramAdapter
  bindModel: <T = any>(path: string, options?: ModelBindingOptions<T>) => ModelBinding<T>
  watch: <T>(
    source: (() => T) | Record<string, any>,
    cb: (value: T, oldValue: T) => void,
    options?: WatchOptions,
  ) => WatchStopHandle
  snapshot: () => Record<string, any>
  unmount: () => void
}

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

export type SetupFunction<
  P extends ComponentPropsOptions,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = (
  props: InferProps<P>,
  ctx: SetupContext<D, C, M, P>,
) => Record<string, any> | void

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
  proxy: ComponentPublicInstance<D, C, M>

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
   * 注意：不同于 Vue 3 的 `emit(event, ...args)`，小程序事件只携带一个 `detail` 载荷；
   * `options` 用于控制事件传播行为（`bubbles`/`composed`/`capturePhase`）。
   */
  emit: (event: string, detail?: any, options?: TriggerEventOptions) => void

  /**
   * Vue 3 对齐：expose 公共属性
   */
  expose?: (exposed: Record<string, any>) => void

  /**
   * Vue 3 对齐：attrs（小程序场景兜底为空对象）
   */
  attrs?: Record<string, any>
}

export interface TriggerEventOptions {
  /**
   * 事件是否冒泡
   * @default false
   */
  bubbles?: boolean

  /**
   * 事件是否可以穿越组件边界。
   * 为 false 时，事件将只能在引用组件的节点树上触发，不进入其他任何组件内部。
   * @default false
   */
  composed?: boolean

  /**
   * 事件是否拥有捕获阶段
   * @default false
   */
  capturePhase?: boolean
}

export interface InternalRuntimeState {
  __wevu?: RuntimeInstance<any, any, any>
  __wevuWatchStops?: WatchStopHandle[]
  $wevu?: RuntimeInstance<any, any, any>
  __wevuHooks?: Record<string, any>
  __wevuExposed?: Record<string, any>
}

export interface DefineComponentOptions<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends Omit<CreateAppOptions<D, C, M>, 'setup'> {
  /**
   * 仅页面生效的特性开关（例如 scroll/share 钩子）。
   * 仅对页面入口生效。
   */
  features?: PageFeatures

  /**
   * 类 Vue 的 props 定义（会被规范化为小程序 `properties`）
   */
  props?: P
  watch?: Record<string, any>
  setup?: SetupFunction<P, D, C, M>
  [key: string]: any
}

export interface DefineAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> {
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface CreateAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> {
  data?: () => D
  computed?: C
  methods?: M
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface PageFeatures {
  listenPageScroll?: boolean
  enableShareAppMessage?: boolean
  enableShareTimeline?: boolean
  enableAddToFavorites?: boolean
}
