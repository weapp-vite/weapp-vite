import type {
  ComponentPropsOptions,
  CreateAppOptions,
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

export interface EmittedEventMap {
  [eventName: string]: unknown[][]
}

export interface WevuTestWrapper<
  Bindings extends Record<string, any> = Record<string, any>,
  Props extends Record<string, any> = Record<string, any>,
  Data extends Record<string, any> = Record<string, any>,
> {
  readonly vm: Record<string, any> & Bindings
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
