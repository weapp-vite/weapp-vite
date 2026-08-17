import type { InternalRuntimeState, RuntimeApp } from 'wevu'
import type {
  EmittedEventMap,
  MountOptions,
  TestSetupFunction,
  WevuTestWrapper,
} from './types'
import {
  WEVU_COMPONENT_NAME_KEY,
  WEVU_PROP_KEYS_KEY,
  WEVU_PROPS_KEY,
} from '@weapp-core/constants'
import { nextTick } from 'wevu'
import {
  callHookList,
  createApp,
  INTERNAL_DEFAULTS_SCOPE_KEY,
  mountRuntimeInstance,
  teardownRuntimeInstance,
} from 'wevu/internal-runtime'
import { isComponentSubject, mountComponent } from './mountComponent'
import { applyDataPayload, applyGlobalOptions, createEmitted } from './mountHelpers'

type MountSubject<Bindings extends Record<string, any>, Props extends Record<string, any>>
  = | TestSetupFunction<Bindings, Props>
    | { setup?: TestSetupFunction<Bindings, Props> }

function resolveData<Data extends Record<string, any>>(data: MountOptions<any, Data>['data']): Data {
  if (typeof data === 'function') {
    return data()
  }
  return (data ?? {}) as Data
}

function resolveSetup<Bindings extends Record<string, any>, Props extends Record<string, any>>(
  subject: MountSubject<Bindings, Props>,
): TestSetupFunction<Bindings, Props> {
  const setup = typeof subject === 'function' ? subject : subject.setup
  if (typeof setup !== 'function') {
    throw new TypeError('mount() 需要接收 setup 函数，或包含 setup 函数的对象')
  }
  return setup
}

export function mount<
  Bindings extends Record<string, any> = Record<string, any>,
  Props extends Record<string, any> = Record<string, any>,
  Data extends Record<string, any> = Record<string, any>,
>(
  subject: MountSubject<Bindings, Props> | Record<string, any>,
  options: MountOptions<Props, Data> = {},
): WevuTestWrapper<Bindings, Props, Data> {
  if (isComponentSubject(subject)) {
    return mountComponent(subject as any, options as any) as WevuTestWrapper<Bindings, Props, Data>
  }
  const setup = resolveSetup(subject)
  const props = { ...(options.props ?? {}) } as Props
  const initialData = resolveData(options.data)
  const setDataCalls: Record<string, any>[] = []
  const emissions: EmittedEventMap = Object.create(null)
  let unmounted = false

  const host = {
    data: { ...initialData },
    properties: props,
    route: options.route,
    is: options.componentName,
    setData(payload: Record<string, any>, callback?: () => void) {
      setDataCalls.push({ ...payload })
      applyDataPayload(host.data, payload)
      const result = options.adapter?.setData?.(payload)
      if (result && typeof (result as Promise<void>).then === 'function') {
        return (result as Promise<void>).then(() => callback?.())
      }
      callback?.()
      return result
    },
    triggerEvent(eventName: string, detail?: unknown, eventOptions?: unknown) {
      const entries = emissions[eventName] ?? (emissions[eventName] = [])
      entries.push([detail])
      void eventOptions
    },
  } as unknown as InternalRuntimeState

  Object.defineProperty(host, WEVU_PROP_KEYS_KEY, {
    configurable: true,
    enumerable: false,
    value: Object.keys(props),
    writable: true,
  })

  if (options.componentName) {
    Object.defineProperty(host, WEVU_COMPONENT_NAME_KEY, {
      configurable: true,
      enumerable: false,
      value: options.componentName,
      writable: true,
    })
  }

  const runtimeApp = createApp({
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
    data: initialData,
    computed: options.computed,
    methods: options.methods,
    setData: options.setData,
    setup: setup as any,
    watch: options.watch,
  } as any) as RuntimeApp<any, any, any>

  applyGlobalOptions(runtimeApp, options)

  const runtime = mountRuntimeInstance(host, runtimeApp, options.watch, setup as any)
  callHookList(host, 'onAttached')
  callHookList(host, 'onReady')

  const updateProps = (nextProps: Record<string, unknown>) => {
    const runtimeProps = runtime.state[WEVU_PROPS_KEY] as Record<string, unknown> | undefined
    Object.assign(host.properties ?? {}, nextProps)
    if (runtimeProps) {
      Object.assign(runtimeProps, nextProps)
    }
  }

  const wrapper: WevuTestWrapper<Bindings, Props, Data> = {
    get vm() {
      return runtime.proxy as Record<string, any> & Bindings & { $props: Props }
    },
    instance: runtime as WevuTestWrapper<Bindings, Props, Data>['instance'],
    host,
    setDataCalls,
    get isUnmounted() {
      return unmounted
    },
    async setProps(nextProps) {
      if (unmounted) {
        throw new Error('不能在已卸载的 wrapper 上调用 setProps()')
      }
      updateProps(nextProps as Record<string, unknown>)
      await nextTick()
    },
    async setData(data) {
      if (unmounted) {
        throw new Error('不能在已卸载的 wrapper 上调用 setData()')
      }
      Object.assign(runtime.state, data)
      await nextTick()
    },
    emitted: createEmitted(emissions),
    async triggerHook(name, ...args) {
      if (unmounted) {
        throw new Error('不能在已卸载的 wrapper 上调用 triggerHook()')
      }
      callHookList(host, name, args)
      await nextTick()
    },
    nextTick: () => nextTick(),
    unmount() {
      if (unmounted) {
        return
      }
      unmounted = true
      teardownRuntimeInstance(host)
      runtimeApp.unmount()
    },
  }
  return wrapper
}

export function mountComposable<
  Bindings extends Record<string, any> = Record<string, any>,
  Props extends Record<string, any> = Record<string, any>,
  Data extends Record<string, any> = Record<string, any>,
>(
  setup: TestSetupFunction<Bindings, Props>,
  options?: MountOptions<Props, Data>,
) {
  return mount(setup, options)
}

export { mountComponent }
