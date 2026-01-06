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

export interface SetDataSnapshotOptions {
  /**
   * setData 策略：
   * - diff：全量快照 + diff（默认，兼容性最好）
   * - patch：按变更路径增量产出 payload（性能更好；在共享引用等场景会自动回退 diff）
   */
  strategy?: 'diff' | 'patch'

  /**
   * 仅下发指定的顶层字段（包含 data/setup 返回值与 computed）。
   * 若为空则默认下发所有字段。
   */
  pick?: string[]

  /**
   * 排除指定的顶层字段（包含 data/setup 返回值与 computed）。
   */
  omit?: string[]

  /**
   * 是否将 computed 的结果参与 setData（默认 true）。
   */
  includeComputed?: boolean

  /**
   * patch 模式阈值：当本轮变更路径数量超过该值时，自动回退到 diff。
   * 说明：大量路径变更时，全量快照 diff 往往更快/更小。
   */
  maxPatchKeys?: number

  /**
   * patch 模式阈值：当本轮 payload 估算字节数超过该值时，自动回退到 diff。
   * 说明：该估算基于 `JSON.stringify(payload).length`，仅用于启发式降级。
   */
  maxPayloadBytes?: number

  /**
   * patch 模式优化：当同一父路径下存在多个子路径变更时，合并为父路径整体下发。
   *
   * 例如：`a.b` 与 `a.c` 同时变更，且 `mergeSiblingThreshold = 2` 时，会下发 `a`。
   *
   * 注意：当子路径包含删除（null）时，为避免删除语义不一致，将不会触发合并。
   */
  mergeSiblingThreshold?: number
}

export type MiniProgramComponentBehaviorOptions = WechatMiniprogram.Component.ComponentOptions

type MpComponentOptions = WechatMiniprogram.Component.TrivialOption

export type MiniProgramBehaviorIdentifier = WechatMiniprogram.Behavior.BehaviorIdentifier | string

export interface MiniProgramComponentOptions {
  /**
   * 类似于 mixins/traits 的组件间代码复用机制（behaviors）。
   */
  behaviors?: MiniProgramBehaviorIdentifier[]

  /**
   * 组件接受的外部样式类。
   */
  externalClasses?: MpComponentOptions['externalClasses']

  /**
   * 组件间关系定义。
   */
  relations?: MpComponentOptions['relations']

  /**
   * 组件数据字段监听器，用于监听 properties 和 data 的变化。
   */
  observers?: MpComponentOptions['observers']

  /**
   * 组件生命周期声明对象：
   * `created`/`attached`/`ready`/`moved`/`detached`/`error`。
   *
   * 注意：wevu 会在 `attached/ready/detached/moved/error` 阶段做桥接与包装，
   * 但 `created` 发生在 setup() 之前。
   */
  lifetimes?: MpComponentOptions['lifetimes']

  /**
   * 组件所在页面的生命周期声明对象：`show`/`hide`/`resize`/`routeDone`。
   */
  pageLifetimes?: MpComponentOptions['pageLifetimes']

  /**
   * 组件选项（multipleSlots/styleIsolation/pureDataPattern/virtualHost 等）。
   */
  options?: MpComponentOptions['options']

  /**
   * 定义段过滤器，用于自定义组件扩展。
   */
  definitionFilter?: MpComponentOptions['definitionFilter']

  /**
   * 组件自定义导出：当使用 `behavior: wx://component-export` 时，
   * 可用于指定组件被 selectComponent 调用时的返回值。
   *
   * wevu 默认会将 setup() 中通过 `expose()` 写入的内容作为 export() 返回值，
   * 因此大多数情况下无需手动编写 export()；若同时提供 export()，则会与 expose() 结果浅合并。
   */
  export?: MpComponentOptions['export']

  /**
   * 原生 properties（与 wevu 的 props 不同）。
   *
   * - 推荐：使用 wevu 的 `props` 选项，让运行时规范化为小程序 `properties`。
   * - 兼容：也可以直接传入小程序 `properties`。
   */
  properties?: MpComponentOptions['properties']

  /**
   * 旧式生命周期（基础库 `2.2.3` 起推荐使用 `lifetimes` 字段）。
   * 保留以增强类型提示与兼容性。
   */
  created?: MpComponentOptions['created']
  attached?: MpComponentOptions['attached']
  ready?: MpComponentOptions['ready']
  moved?: MpComponentOptions['moved']
  detached?: MpComponentOptions['detached']
  error?: MpComponentOptions['error']
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

export type MiniProgramAppOptions<T extends Record<string, any> = Record<string, any>>
  = WechatMiniprogram.App.Options<T>

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
  expose: (exposed: Record<string, any>) => void

  /**
   * Vue 3 对齐：attrs（小程序场景兜底为空对象）
   */
  attrs: Record<string, any>

  /**
   * Vue 3 对齐：slots（小程序场景兜底为空对象）
   */
  slots: Record<string, any>
}

export type TriggerEventOptions = WechatMiniprogram.Component.TriggerEventOption

export interface InternalRuntimeStateFields {
  __wevu?: RuntimeInstance<any, any, any>
  __wevuWatchStops?: WatchStopHandle[]
  $wevu?: RuntimeInstance<any, any, any>
  __wevuHooks?: Record<string, any>
  __wevuExposed?: Record<string, any>
}

export type MiniProgramInstance
  = | WechatMiniprogram.Component.TrivialInstance
    | WechatMiniprogram.Page.TrivialInstance
    | WechatMiniprogram.App.TrivialInstance

export type InternalRuntimeState = InternalRuntimeStateFields & Partial<MiniProgramInstance>

export type MiniProgramPageLifetimes = Partial<WechatMiniprogram.Page.ILifetime>

export type MiniProgramComponentRawOptions
  = Omit<WechatMiniprogram.Component.TrivialOption, 'behaviors'>
    & { behaviors?: MiniProgramBehaviorIdentifier[] }
    & MiniProgramPageLifetimes
    & Record<string, any>

export interface DefineComponentOptions<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends MiniProgramComponentOptions, MiniProgramPageLifetimes {
  /**
   * 页面特性开关（用于按需注入 Page 事件处理函数）。
   *
   * 说明：小程序的部分页面事件/菜单项具有“按需派发/按需展示”特性，
   * 只有定义了对应的 `onXXX` 方法才会触发/展示（如 `onPageScroll`、`onShareTimeline`）。
   * 因此 wevu 需要在注册阶段（Component()）就决定是否注入这些 onXXX。
   *
   * - 若你在 options 中显式定义了原生 `onXXX`，wevu 会自动桥接对应 hook（无需 features）。
   * - 若你只想在 `setup()` 里使用 wevu hook（不额外写原生 `onXXX`），则通过 `features` 显式开启注入。
   */
  features?: PageFeatures

  /**
   * 类 Vue 的 props 定义（会被规范化为小程序 `properties`）
   */
  props?: P
  watch?: Record<string, any>
  setup?: SetupFunction<P, D, C, M>

  /**
   * 组件 data（建议使用函数返回初始值）。
   */
  data?: () => D

  /**
   * 组件 computed（会参与快照 diff）。
   */
  computed?: C

  /**
   * setData 快照控制选项（用于优化性能与 payload）。
   */
  setData?: SetDataSnapshotOptions

  /**
   * 组件 methods（会绑定到 public instance 上）。
   */
  methods?: M

  /**
   * 透传/扩展字段：允许携带其他小程序原生 Component 选项或自定义字段。
   * 说明：为保持兼容性保留 index signature，但仍会对已知字段提供智能提示。
   */
  [key: string]: any
}

export interface DefineAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends MiniProgramAppOptions {
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface CreateAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends MiniProgramAppOptions {
  data?: () => D
  computed?: C
  methods?: M
  setData?: SetDataSnapshotOptions
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface PageFeatures {
  /**
   * 启用页面滚动事件（注入 `onPageScroll`）。
   */
  enableOnPageScroll?: boolean
  /**
   * 启用下拉刷新事件（注入 `onPullDownRefresh`；仍需在页面配置开启 enablePullDownRefresh）。
   */
  enableOnPullDownRefresh?: boolean
  /**
   * 启用触底事件（注入 `onReachBottom`）。
   */
  enableOnReachBottom?: boolean
  /**
   * 启用路由动画完成事件（注入 `onRouteDone`）。
   */
  enableOnRouteDone?: boolean
  /**
   * 启用 Tab 点击事件（注入 `onTabItemTap`）。
   */
  enableOnTabItemTap?: boolean
  /**
   * 启用窗口尺寸变化事件（注入 `onResize`）。
   */
  enableOnResize?: boolean

  /**
   * 启用“转发/分享给朋友”（注入 `onShareAppMessage`，使右上角菜单显示“转发”）。
   */
  enableOnShareAppMessage?: boolean
  /**
   * 启用“分享到朋友圈”（注入 `onShareTimeline`，使右上角菜单显示“分享到朋友圈”）。
   */
  enableOnShareTimeline?: boolean
  /**
   * 启用“收藏”（注入 `onAddToFavorites`）。
   */
  enableOnAddToFavorites?: boolean
  /**
   * 启用“退出状态保存”（注入 `onSaveExitState`）。
   */
  enableOnSaveExitState?: boolean
}
