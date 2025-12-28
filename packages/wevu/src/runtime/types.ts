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

export type PropType<T> = { new (...args: any[]): T & object } | { (): T } | PropConstructor<T>
export type PropConstructor<T = any> = { new (...args: any[]): T } | { (): T }
export type ComponentPropsOptions = Record<string, PropOptions<any> | PropType<any> | null>

export interface PropOptions<T = any> {
  type?: PropType<T> | PropType<T>[]
  /**
   * Default value (mirrors Vue `default`; will be assigned to mini-program property `value`)
   */
  default?: T | (() => T)
  /**
   * Alias for mini-program `value`
   */
  value?: T | (() => T)
  required?: boolean
}

export type InferPropType<O>
  = O extends null ? any
    : O extends { type?: infer T } ? InferPropConstructor<T>
      : O extends PropType<infer V> ? V
        : any

type InferPropConstructor<T>
  = T extends readonly any[] ? InferPropConstructor<T[number]>
    : T extends PropConstructor<infer V> ? V
      : any

export type InferProps<P extends ComponentPropsOptions = ComponentPropsOptions> = {
  [K in keyof P]?: InferPropType<P[K]>
}

export type SetupFunction<
  P extends ComponentPropsOptions,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
>
  = | ((ctx: SetupContext<D, C, M, P>) => Record<string, any> | void)
    | ((props: InferProps<P>, ctx: SetupContext<D, C, M, P>) => Record<string, any> | void)

export interface SetupContext<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
  P extends ComponentPropsOptions = ComponentPropsOptions,
> {
  /**
   * Component props (from mini-program properties)
   */
  props: InferProps<P>

  /**
   * Runtime instance
   */
  runtime: RuntimeInstance<D, C, M>

  /**
   * Reactive state
   */
  state: D

  /**
   * Public instance proxy
   */
  proxy: ComponentPublicInstance<D, C, M>

  /**
   * Model binding helper
   */
  bindModel: RuntimeInstance<D, C, M>['bindModel']

  /**
   * Watch helper
   */
  watch: RuntimeInstance<D, C, M>['watch']

  /**
   * Internal mini-program instance
   */
  instance: InternalRuntimeState

  /**
   * Vue 3 compatible: emit events
   */
  emit: (event: string, ...args: any[]) => void

  /**
   * Vue 3 compatible: expose public properties
   */
  expose?: (exposed: Record<string, any>) => void

  /**
   * Vue 3 compatible: attrs (fallback to empty object for mini-programs)
   */
  attrs?: Record<string, any>
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
   * Vue-like props definition (will be normalized to mini-program `properties`)
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
