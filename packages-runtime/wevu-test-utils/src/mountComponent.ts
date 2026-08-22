import type { InternalRuntimeState, RuntimeApp } from 'wevu'
import type {
  ComponentBindingsOf,
  ComponentMountOptions,
  ComponentPropsOf,
  EmittedEventMap,
  WevuTestWrapper,
} from './types'
import { nextTick } from 'wevu'
import {
  callHookList,
  createIsolatedWevuComponentDefinition,
  createWevuComponentDefinition,
  getWevuComponentLifecycleDefinition,
} from 'wevu/internal-runtime'
import { applyDataPayload, applyGlobalOptions, createEmitted } from './mountHelpers'

interface ComponentDefinitionLike {
  __wevu_runtime: RuntimeApp<any, any, any>
  __wevu_options: {
    data: (() => Record<string, any>) | undefined
    computed: Record<string, any>
    methods: Record<string, any>
    setData: unknown
    watch: Record<string, any> | undefined
    setup: ((props: any, ctx: any) => any) | undefined
    mpOptions: Record<string, any>
  }
}

function isComponentDefinition(value: unknown): value is ComponentDefinitionLike {
  return Boolean(
    value
    && (typeof value === 'object' || typeof value === 'function')
    && (value as any).__wevu_runtime
    && (value as any).__wevu_options,
  )
}

export function isComponentSubject(value: unknown): value is Record<string, any> {
  if (isComponentDefinition(value)) {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  if (record.__wevu_isPage === true || record.__wevu_isPage === false) {
    return true
  }
  return [
    'props',
    'properties',
    'data',
    'computed',
    'methods',
    'watch',
    'lifetimes',
    'pageLifetimes',
    'observers',
    'beforeCreate',
    'created',
    'mounted',
    'unmounted',
  ].some(key => key in record)
}

function resolveComponentDefinition(component: unknown): ComponentDefinitionLike {
  if (isComponentDefinition(component)) {
    return createIsolatedWevuComponentDefinition(component) as ComponentDefinitionLike
  }
  if (!component || typeof component !== 'object') {
    throw new TypeError('mountComponent() 需要接收编译后的 Vue SFC、组件选项或 Wevu 组件定义')
  }
  return createWevuComponentDefinition(component as any) as ComponentDefinitionLike
}

function cloneMountValue(value: unknown, cache = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }
  if (cache.has(value as object)) {
    return cache.get(value as object)
  }
  if (Array.isArray(value)) {
    const next: unknown[] = []
    cache.set(value, next)
    value.forEach(item => next.push(cloneMountValue(item, cache)))
    return next
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }
  const next: Record<string, unknown> = {}
  cache.set(value as object, next)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneMountValue(child, cache)
  }
  return next
}

function resolveInitialProperties(definition: Record<string, any>, input: Record<string, any>) {
  const properties: Record<string, any> = {}
  for (const [key, option] of Object.entries(definition.properties ?? {})) {
    if (option && typeof option === 'object' && 'value' in option) {
      properties[key] = cloneMountValue(option.value)
    }
  }
  Object.assign(properties, input)
  return properties
}

/**
 * 挂载不渲染模板的 Wevu 组件逻辑层。
 *
 * @param component 编译后的 SFC 默认导出、组件选项或 Wevu 组件定义
 * @param options 挂载选项
 */
export function mountComponent<
  Component extends object,
  Props extends Record<string, any> = ComponentPropsOf<Component>,
  Data extends Record<string, any> = Record<string, any>,
>(
  component: Component,
  options: ComponentMountOptions<Props> = {},
): WevuTestWrapper<ComponentBindingsOf<Component>, Props, Data> {
  const definition = resolveComponentDefinition(component)
  const lifecycleDefinition = getWevuComponentLifecycleDefinition(definition)
  if (!lifecycleDefinition) {
    throw new TypeError('mountComponent() 无法解析 Wevu 组件生命周期定义')
  }
  if (lifecycleDefinition.__wevu_isPage === true) {
    throw new Error('mountComponent() 不支持 app.vue 或页面组件，请改用 @mpcore/test')
  }

  const componentOptions = definition.__wevu_options
  const runtimeApp = definition.__wevu_runtime
  const props = resolveInitialProperties(lifecycleDefinition, (options.props ?? {}) as Record<string, any>) as Props
  const emissions: EmittedEventMap = Object.create(null)
  const setDataCalls: Record<string, any>[] = []
  let unmounted = false
  const nativeData = typeof componentOptions.data === 'function'
    ? componentOptions.data()
    : {}
  const host = {
    data: { ...(nativeData ?? {}) },
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

  applyGlobalOptions(runtimeApp, options)

  const lifetimes = lifecycleDefinition.lifetimes ?? {}
  lifetimes.created?.call(host)
  lifetimes.attached?.call(host)
  lifetimes.ready?.call(host)

  const wrapper: WevuTestWrapper<ComponentBindingsOf<Component>, Props, Data> = {
    get vm() {
      return host.__wevu?.proxy as Record<string, any> & ComponentBindingsOf<Component> & { $props: Props }
    },
    get instance() {
      return host.__wevu as any
    },
    host,
    setDataCalls,
    get isUnmounted() {
      return unmounted
    },
    async setProps(nextProps) {
      if (unmounted) {
        throw new Error('不能在已卸载的 wrapper 上调用 setProps()')
      }
      const oldProps = { ...(host.properties ?? {}) }
      Object.assign(host.properties ?? {}, nextProps)
      const observers = lifecycleDefinition.observers ?? {}
      for (const [key, value] of Object.entries(nextProps as Record<string, unknown>)) {
        if (Object.is(oldProps[key], value)) {
          continue
        }
        const observer = observers[key]
        if (typeof observer === 'function') {
          observer.call(host, value, oldProps[key])
        }
      }
      if (typeof observers['**'] === 'function') {
        observers['**'].call(host, host.properties, oldProps)
      }
      await nextTick()
    },
    async setData(data) {
      if (unmounted) {
        throw new Error('不能在已卸载的 wrapper 上调用 setData()')
      }
      Object.assign(host.data, data)
      Object.assign((host.__wevu?.state ?? {}) as Record<string, any>, data)
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
      try {
        lifetimes.detached?.call(host)
      }
      finally {
        runtimeApp.unmount()
      }
    },
  }
  return wrapper
}
