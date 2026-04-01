import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeInstance,
} from '../../types'
import { effectScope, isReactive, shallowReactive, toRaw } from '../../../reactivity'
import { setCurrentInstance, setCurrentSetupContext } from '../../hooks'
import { hasTrackableSetupBinding } from '../../setupTracking'
import { runSetupFunction } from '../setup'
import {
  createSetupSlotsFallback,
  ensureSetupContextInstance,
  normalizeEmitPayload,
  safeMarkNoSetData,
} from './setupContext'

type RuntimeSetupFunction<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  | DefineAppOptions<D, C, M>['setup']

export function runRuntimeSetupPhase<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  target: InternalRuntimeState
  runtime: RuntimeInstance<D, C, M>
  runtimeWithDefaults: RuntimeInstance<any, any, any>
  runtimeState: Record<string, any>
  runtimeProxy: Record<string, any>
  setup: RuntimeSetupFunction<D, C, M>
  syncRuntimeProps: (props: Record<string, any>, mpProperties: Record<string, any>) => void
  attachRuntimeProxyProps: (state: Record<string, any>, props: Record<string, any>) => void
}) {
  const {
    target,
    runtime,
    runtimeWithDefaults,
    runtimeState,
    runtimeProxy,
    setup,
    syncRuntimeProps,
    attachRuntimeProxyProps,
  } = options

  // 从小程序 properties 提取 props 供 setup 使用，并复用 runtime state 上的 props 容器，
  // 避免 computed 首次求值早于 setup 时丢失依赖。
  const mpProperties = ((target as any).properties || {}) as Record<string, any>
  const runtimeProps = runtimeState && typeof runtimeState === 'object'
    ? ((runtimeState as any).__wevuProps as Record<string, any> | undefined)
    : undefined
  const props = runtimeProps && typeof runtimeProps === 'object'
    ? runtimeProps
    : shallowReactive({}) as Record<string, any>
  syncRuntimeProps(props, mpProperties)
  if (runtimeState && typeof runtimeState === 'object') {
    attachRuntimeProxyProps(runtimeState as Record<string, any>, props)
  }
  try {
    Object.defineProperty(target, '__wevuProps', {
      value: props,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(target as any).__wevuProps = props
  }

  // 与 Vue 3 对齐：attrs = 非 props 的 attributes。
  // 在小程序场景中，attrs 来源于 instance.properties 中“未声明在 props/properties 的字段”。
  const attrs = shallowReactive(Object.create(null)) as Record<string, any>
  const declaredPropKeys = new Set(
    Array.isArray((target as any).__wevuPropKeys)
      ? ((target as any).__wevuPropKeys as string[])
      : [],
  )
  const hasRuntimeStateKey = (key: string) => {
    return runtimeState != null
      && typeof runtimeState === 'object'
      && Object.hasOwn(runtimeState as Record<string, unknown>, key)
  }
  const syncAttrsFromProperties = () => {
    const next = ((target as any).properties && typeof (target as any).properties === 'object')
      ? ((target as any).properties as Record<string, unknown>)
      : undefined

    for (const existingKey of Object.keys(attrs)) {
      if (
        !next
        || !Object.hasOwn(next, existingKey)
        || declaredPropKeys.has(existingKey)
        || hasRuntimeStateKey(existingKey)
      ) {
        delete attrs[existingKey]
      }
    }

    if (!next) {
      return
    }

    for (const [key, value] of Object.entries(next)) {
      if (declaredPropKeys.has(key) || hasRuntimeStateKey(key)) {
        continue
      }
      attrs[key] = value
    }
  }
  syncAttrsFromProperties()

  try {
    Object.defineProperty(target, '__wevuAttrs', {
      value: attrs,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(target as any).__wevuAttrs = attrs
  }

  const setupInstance = ensureSetupContextInstance(target, runtimeWithDefaults)

  const context = safeMarkNoSetData({
    // 与 Vue 3 对齐的 ctx.props
    props,

    // 现有运行时能力
    runtime: runtimeWithDefaults,
    state: runtimeState,
    proxy: runtimeProxy,
    bindModel: runtime.bindModel.bind(runtimeWithDefaults),
    watch: runtime.watch.bind(runtimeWithDefaults),
    instance: setupInstance,

    // 通过小程序 triggerEvent 派发事件，并兼容 Vue 3 的 emit(event, ...args) 形式。
    emit: (event: string, ...args: any[]) => {
      const { detail, options } = normalizeEmitPayload(args)
      setupInstance.triggerEvent(event, detail, options)
    },

    // 与 Vue 3 对齐的 expose
    expose: (exposed: Record<string, any>) => {
      target.__wevuExposed = exposed
    },

    // 与 Vue 3 对齐的 attrs（小程序中为非 props 属性集合）
    attrs,

    // 与 Vue 3 对齐的 slots（小程序场景不提供可调用 slots 函数，兜底只读空对象）
    slots: createSetupSlotsFallback(),
  }) as any

  // 仅在同步 setup 执行期间暴露 current instance
  const instanceScope = effectScope(true)
  target.__wevuEffectScope = instanceScope
  setCurrentInstance(target)
  setCurrentSetupContext(context)
  try {
    const result = instanceScope.run(() => runSetupFunction(setup, props, context))
    let methodsChanged = false
    if (result && typeof result === 'object') {
      const runtimeRawState = isReactive(runtime.state)
        ? toRaw(runtime.state)
        : runtime.state
      Object.keys(result).forEach((key) => {
        const val = (result as any)[key]
        if (typeof val === 'function') {
          ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
          methodsChanged = true
        }
        else {
          if (hasTrackableSetupBinding(val)) {
            ;(runtime as any).__wevu_trackSetupReactiveKey?.(key)
          }
          if (declaredPropKeys.has(key)) {
            let fallbackValue = val
            try {
              Object.defineProperty(runtimeRawState as Record<string, unknown>, key, {
                configurable: true,
                enumerable: false,
                get() {
                  const propsSource = (runtimeRawState as any).__wevuProps
                  if (propsSource && typeof propsSource === 'object' && Object.hasOwn(propsSource, key)) {
                    return (propsSource as any)[key]
                  }
                  return fallbackValue
                },
                set(next: unknown) {
                  fallbackValue = next
                  const propsSource = (runtimeRawState as any).__wevuProps
                  if (!propsSource || typeof propsSource !== 'object') {
                    return
                  }
                  try {
                    ;(propsSource as any)[key] = next
                  }
                  catch {
                    // 忽略异常
                  }
                },
              })
            }
            catch {
              ;(runtime.state as any)[key] = val
            }
            return
          }
          ;(runtime.state as any)[key] = val
        }
      })
    }
    if (methodsChanged) {
      ;(runtime as any).__wevu_touchSetupMethodsVersion?.()
    }
  }
  catch (error) {
    instanceScope.stop()
    target.__wevuEffectScope = undefined
    throw error
  }
  finally {
    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
  }
}
