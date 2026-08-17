import type {
  ComponentPropsOptions,
  CreateAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MiniProgramAdapter,
  RuntimeInstance,
  SetDataSnapshotOptions,
  SetupContext,
  WevuPlugin,
} from 'wevu'

export type TestSetupContext = SetupContext<any, any, any, ComponentPropsOptions>

export type TestSetupFunction<Bindings extends Record<string, any> = Record<string, any>, Props extends Record<string, any> = Record<string, any>> = (
  props: Props,
  context: TestSetupContext,
) => Bindings | void

export type TestPlugin = WevuPlugin | readonly [WevuPlugin, ...any[]]

export interface TestGlobalMountOptions {
  plugins?: TestPlugin[]
  provide?: Map<any, unknown> | Record<PropertyKey, unknown>
  mocks?: Record<string, unknown>
  config?: {
    globalProperties?: Record<string, unknown>
  }
}

export interface MountOptions<
  Props extends Record<string, any> = Record<string, any>,
  Data extends Record<string, any> = Record<string, any>,
> {
  props?: Props
  data?: Data | (() => Data)
  computed?: CreateAppOptions['computed']
  methods?: CreateAppOptions['methods']
  watch?: CreateAppOptions['watch']
  setData?: SetDataSnapshotOptions
  global?: TestGlobalMountOptions
  route?: string
  componentName?: string
  adapter?: Pick<MiniProgramAdapter, 'setData'>
}

export interface ComponentMountOptions<Props extends Record<string, any> = Record<string, any>>
  extends Omit<MountOptions<Props>, 'props' | 'data' | 'computed' | 'methods' | 'watch' | 'setData'> {
  props?: Partial<Props>
  componentName?: string
}

export type WevuComponentInput<
  Props extends Record<string, any> = Record<string, any>,
> = DefineComponentOptions<ComponentPropsOptions, any, any, any, any>
  | (new () => { $props: Props } & Record<string, any>)
  | Record<string, any>

type ComponentInstance<Component> = Component extends abstract new (...args: any[]) => infer Instance
  ? Instance
  : Record<string, any>

export type ComponentPropsOf<Component> = ComponentInstance<Component> extends { $props: infer Props }
  ? Props extends Record<string, any> ? Props : Record<string, any>
  : Component extends { props: infer Props }
    ? Props extends ComponentPropsOptions ? import('wevu').InferProps<Props> : Record<string, any>
    : Record<string, any>

export type ComponentBindingsOf<Component> = ComponentInstance<Component> extends infer Instance
  ? Instance extends Record<string, any> ? Omit<Instance, '$props'> : Record<string, any>
  : Record<string, any>

export interface EmittedEventMap {
  [eventName: string]: unknown[][]
}

export interface WevuTestWrapper<
  Bindings extends Record<string, any> = Record<string, any>,
  Props extends Record<string, any> = Record<string, any>,
  Data extends Record<string, any> = Record<string, any>,
> {
  readonly vm: Record<string, any> & Bindings & { $props: Props }
  readonly instance: RuntimeInstance<Data, any, any>
  readonly host: InternalRuntimeState
  readonly setDataCalls: readonly Record<string, any>[]
  readonly isUnmounted: boolean
  setProps: (props: Partial<Props>) => Promise<void>
  setData: (data: Partial<Data> & Record<string, any>) => Promise<void>
  emitted: (() => EmittedEventMap) & ((eventName: string) => unknown[][] | undefined)
  triggerHook: (name: string, ...args: any[]) => Promise<void>
  nextTick: () => Promise<void>
  unmount: () => void
}
