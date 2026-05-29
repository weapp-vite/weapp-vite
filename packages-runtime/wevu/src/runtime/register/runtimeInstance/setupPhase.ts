import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeInstance,
} from '../../types'
import {
  WEVU_ATTRS_KEY,
  WEVU_EFFECT_SCOPE_KEY,
  WEVU_EXPOSED_KEY,
  WEVU_PROP_KEYS_KEY,
} from '@weapp-core/constants'
import { effectScope, isReactive, shallowReactive, toRaw } from '../../../reactivity'
import { hasOwn } from '../../../utils'
import { setCurrentInstance, setCurrentSetupContext } from '../../hooks'
import { hasTrackableSetupBinding } from '../../setupTracking'
import { runSetupFunction } from '../setup'
import {
  createSetupSlotsProxy,
  ensureSetupContextInstance,
  normalizeEmitPayload,
  safeMarkNoSetData,
} from './setupContext'
import { attachRuntimeSetupState, ensureRuntimeProps } from './utils'

type RuntimeSetupFunction<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  | DefineAppOptions<D, C, M>['setup']

function normalizeEmitEventName(eventName: string) {
  return eventName.includes(':') ? eventName.replaceAll(':', '-').toLowerCase() : eventName
}

function isInternalAttrKey(key: string) {
  return key.startsWith('__wv_')
}

export function runRuntimeSetupPhase<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  target: InternalRuntimeState
  runtime: RuntimeInstance<D, C, M>
  runtimeWithDefaults: RuntimeInstance<any, any, any>
  runtimeState: Record<string, any>
  runtimeProxy: Record<string, any>
  setup: RuntimeSetupFunction<D, C, M>
}) {
  const {
    target,
    runtime,
    runtimeWithDefaults,
    runtimeState,
    runtimeProxy,
    setup,
  } = options

  // 从小程序 properties 提取 props 供 setup 使用，并复用 runtime state 上的 props 容器，
  // 避免 computed 首次求值早于 setup 时丢失依赖。
  const mpProperties = ((target as any).properties || {}) as Record<string, any>
  const props = ensureRuntimeProps(target, runtimeState, mpProperties)

  // 与 Vue 3 对齐：attrs = 非 props 的 attributes。
  // 在小程序场景中，attrs 来源于 instance.properties 中“未声明在 props/properties 的字段”。
  const attrs = shallowReactive(Object.create(null)) as Record<string, any>
  const declaredPropKeys = new Set(
    Array.isArray((target as any)[WEVU_PROP_KEYS_KEY])
      ? ((target as any)[WEVU_PROP_KEYS_KEY] as string[])
      : [],
  )
  const hasRuntimeStateKey = (key: string) => {
    return runtimeState != null
      && typeof runtimeState === 'object'
      && hasOwn(runtimeState as Record<string, unknown>, key)
  }
  const syncAttrsFromProperties = () => {
    const next = ((target as any).properties && typeof (target as any).properties === 'object')
      ? ((target as any).properties as Record<string, unknown>)
      : undefined

    for (const existingKey of Object.keys(attrs)) {
      if (
        !next
        || !hasOwn(next, existingKey)
        || isInternalAttrKey(existingKey)
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
      if (isInternalAttrKey(key) || declaredPropKeys.has(key) || hasRuntimeStateKey(key)) {
        continue
      }
      attrs[key] = value
    }
  }
  syncAttrsFromProperties()

  try {
    Object.defineProperty(target, WEVU_ATTRS_KEY, {
      value: attrs,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(target as any)[WEVU_ATTRS_KEY] = attrs
  }

  const setupInstance = ensureSetupContextInstance(target, runtimeWithDefaults)
  const slots = createSetupSlotsProxy(props)
  const setupState = runtimeWithDefaults.setupState ?? Object.create(null)
  attachRuntimeSetupState(runtimeState, setupState)
  try {
    Object.defineProperty(runtimeState, '$slots', {
      value: slots,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(runtimeState as any).$slots = slots
  }

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
      const eventName = normalizeEmitEventName(event)
      setupInstance.triggerEvent(eventName, detail, options)
    },

    // 与 Vue 3 对齐的 expose
    expose: (exposed: Record<string, any>) => {
      target[WEVU_EXPOSED_KEY] = exposed
    },

    // 与 Vue 3 对齐的 attrs（小程序中为非 props 属性集合）
    attrs,

    // 与 Vue 3 对齐的 slots（由编译期传入的 slot 名元数据驱动）
    slots,
  }) as any

  // 仅在同步 setup 执行期间暴露 current instance
  const instanceScope = effectScope(true)
  target[WEVU_EFFECT_SCOPE_KEY] = instanceScope
  setCurrentInstance(target)
  setCurrentSetupContext(context)
  try {
    const result = instanceScope.run(() => runSetupFunction(setup, props, context))
    let methodsChanged = false
    if (result && typeof result === 'object') {
      const runtimeSetupState = (runtime as any).setupState && typeof (runtime as any).setupState === 'object'
        ? (isReactive((runtime as any).setupState) ? toRaw((runtime as any).setupState) : (runtime as any).setupState)
        : Object.create(null)
      Object.keys(result).forEach((key) => {
        const val = (result as any)[key]
        if (typeof val === 'function') {
          ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
          ;(runtime.state as any)[key] = (...args: any[]) => (val as any).apply((runtime as any).proxy, args)
          methodsChanged = true
        }
        else {
          if (hasTrackableSetupBinding(val)) {
            ;(runtime as any).__wevu_trackSetupReactiveKey?.(key)
          }
          ;(runtime.state as any)[key] = val
          ;(runtimeSetupState as any)[key] = val
        }
      })
    }
    if (methodsChanged) {
      ;(runtime as any).__wevu_touchSetupMethodsVersion?.()
    }
  }
  catch (error) {
    instanceScope.stop()
    target[WEVU_EFFECT_SCOPE_KEY] = undefined
    throw error
  }
  finally {
    setCurrentSetupContext(undefined)
    setCurrentInstance(undefined)
  }
}
