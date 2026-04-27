import type { WatchStopHandle } from '../../../reactivity'
import type {
  InternalRuntimeState,
  MiniProgramAdapter,
  MiniProgramIntersectionObserverOptions,
  RuntimeInstance,
  SetupContextNativeInstance,
  TriggerEventOptions,
} from '../../types'
import {
  WEVU_NATIVE_INSTANCE_KEY,
  WEVU_SETUP_CONTEXT_INSTANCE_KEY,
  WEVU_SLOT_NAMES_PROP,
} from '@weapp-core/constants'
import { toRaw } from '../../../reactivity'
import { isNativeBridgeMethod, markNativeBridgeMethod } from '../../nativeBridge'
import { markNoSetData } from '../../noSetData'
import { getCurrentMiniProgramRuntimeCapabilities, getMiniProgramGlobalObject, supportsCurrentMiniProgramRuntimeCapability } from '../../platform'

type AdapterWithSetData = Required<MiniProgramAdapter> & {
  __wevu_enableSetData?: () => void
  __wevu_setVisibility?: (visible: boolean) => void
}

export type SetupInstanceMethodName = 'triggerEvent' | 'createSelectorQuery' | 'createIntersectionObserver' | 'setData' | 'setUpdatePerformanceListener'

export const setupInstanceMethodNames: SetupInstanceMethodName[] = [
  'triggerEvent',
  'createSelectorQuery',
  'createIntersectionObserver',
  'setData',
  'setUpdatePerformanceListener',
]

export function createSetupSlotsFallback() {
  return Object.freeze(Object.create(null)) as Record<string, never>
}

const SLOT_RENDER_FN = () => []

function normalizeSlotNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  }
  if (!value || typeof value !== 'object') {
    return []
  }
  return Object.entries(value as Record<string, unknown>)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name)
}

export function createSetupSlotsProxy(props: Record<string, any>) {
  const resolveNames = () => normalizeSlotNames(props[WEVU_SLOT_NAMES_PROP])
  const isEnabled = (key: PropertyKey) => typeof key === 'string' && resolveNames().includes(key)

  return new Proxy(Object.create(null), {
    get(_target, key) {
      if (isEnabled(key)) {
        return SLOT_RENDER_FN
      }
      return undefined
    },
    has(_target, key) {
      return isEnabled(key)
    },
    ownKeys() {
      return resolveNames()
    },
    getOwnPropertyDescriptor(_target, key) {
      if (!isEnabled(key)) {
        return undefined
      }
      return {
        configurable: true,
        enumerable: true,
        value: SLOT_RENDER_FN,
      }
    },
    set() {
      return false
    },
    deleteProperty() {
      return false
    },
  }) as Record<string, any>
}

export function createNoopWatchStopHandle(): WatchStopHandle {
  const stopHandle = (() => {}) as WatchStopHandle
  stopHandle.stop = () => {}
  stopHandle.pause = () => {}
  stopHandle.resume = () => {}
  return stopHandle
}

export function safeMarkNoSetData<T extends object>(value: T): T {
  try {
    return markNoSetData(value)
  }
  catch {
    return value
  }
}

function isTriggerEventOptions(value: unknown): value is TriggerEventOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return (
    Object.hasOwn(value, 'bubbles')
    || Object.hasOwn(value, 'composed')
    || Object.hasOwn(value, 'capturePhase')
  )
}

export function normalizeEmitPayload(args: any[]): { detail: any, options: TriggerEventOptions | undefined } {
  if (args.length === 0) {
    return {
      detail: undefined,
      options: undefined,
    }
  }

  if (args.length === 1) {
    return {
      detail: args[0],
      options: undefined,
    }
  }

  const maybeOptions = args.at(-1)
  if (isTriggerEventOptions(maybeOptions)) {
    const detailArgs = args.slice(0, -1)
    return {
      detail: detailArgs.length <= 1 ? detailArgs[0] : detailArgs,
      options: maybeOptions,
    }
  }

  return {
    detail: args,
    options: undefined,
  }
}

function resolveRuntimeNativeMethodOwner(
  runtime: RuntimeInstance<any, any, any>,
  target: InternalRuntimeState,
  methodName: SetupInstanceMethodName,
) {
  const runtimeState = runtime?.state
  const runtimeRawState = runtimeState && typeof runtimeState === 'object'
    ? toRaw(runtimeState as any)
    : undefined
  const runtimeProxy = runtime?.proxy as object | undefined
  const isBridgeMethod = (candidate: object) => {
    const candidateMethod = (candidate as any)[methodName]
    if (typeof candidateMethod !== 'function') {
      return false
    }
    if (isNativeBridgeMethod(candidateMethod)) {
      return true
    }
    const targetMethod = (target as any)[methodName]
    return typeof targetMethod === 'function' && candidateMethod === targetMethod
  }
  const isValidNativeCandidate = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') {
      return false
    }
    if (candidate === target || candidate === runtimeProxy) {
      return false
    }
    if (isBridgeMethod(candidate)) {
      return false
    }
    return typeof (candidate as any)[methodName] === 'function'
  }
  const nativeFromState = runtimeRawState ? (runtimeRawState as any)[WEVU_NATIVE_INSTANCE_KEY] : undefined
  if (isValidNativeCandidate(nativeFromState)) {
    return nativeFromState as InternalRuntimeState
  }

  const runtimeInstance = (runtime as any)?.instance
  if (isValidNativeCandidate(runtimeInstance)) {
    return runtimeInstance as InternalRuntimeState
  }
  return undefined
}

function defineSetupInstanceMethod(
  target: Record<string, any>,
  methodName: SetupInstanceMethodName,
  handler: (...args: any[]) => any,
) {
  markNativeBridgeMethod(handler)
  try {
    Object.defineProperty(target, methodName, {
      value: handler,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(target as any)[methodName] = handler
  }
}

export function ensureSetupContextInstance(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
) {
  const maybeCached = (target as any)[WEVU_SETUP_CONTEXT_INSTANCE_KEY]
  if (maybeCached && typeof maybeCached === 'object') {
    return maybeCached as SetupContextNativeInstance
  }

  const setupInstanceBridge: Record<string, any> = Object.create(null)
  const resolveSetupBridgeOwner = (methodName: SetupInstanceMethodName) => {
    const owner = resolveRuntimeNativeMethodOwner(runtime, target, methodName)
    if (owner) {
      return owner
    }
    const fallbackMethod = (target as any)[methodName]
    if (typeof fallbackMethod === 'function' && !isNativeBridgeMethod(fallbackMethod)) {
      return target
    }
    return undefined
  }

  defineSetupInstanceMethod(setupInstanceBridge, 'triggerEvent', (...args: [string, any?, TriggerEventOptions?]) => {
    const [eventName, detail, options] = args
    const nativeOwner = resolveSetupBridgeOwner('triggerEvent')
    if (nativeOwner && typeof (nativeOwner as any).triggerEvent === 'function') {
      if (args.length >= 3) {
        ;(nativeOwner as any).triggerEvent(eventName, detail, options)
      }
      else {
        ;(nativeOwner as any).triggerEvent(eventName, detail)
      }
    }
  })

  defineSetupInstanceMethod(setupInstanceBridge, 'createSelectorQuery', () => {
    const nativeOwner = resolveSetupBridgeOwner('createSelectorQuery')
    if (nativeOwner && typeof (nativeOwner as any).createSelectorQuery === 'function') {
      return (nativeOwner as any).createSelectorQuery()
    }

    const miniProgramGlobal = getMiniProgramGlobalObject()
    if (
      !supportsCurrentMiniProgramRuntimeCapability('globalCreateSelectorQuery')
      || !miniProgramGlobal
      || typeof miniProgramGlobal.createSelectorQuery !== 'function'
    ) {
      return undefined
    }

    const query = miniProgramGlobal.createSelectorQuery()
    if (!query) {
      return query
    }
    if (
      !getCurrentMiniProgramRuntimeCapabilities().selectorQueryScopeByIn
      || typeof query.in !== 'function'
    ) {
      return query
    }

    const scopedOwner = resolveRuntimeNativeMethodOwner(runtime, target, 'setData') ?? target
    return query.in(scopedOwner as any)
  })

  defineSetupInstanceMethod(
    setupInstanceBridge,
    'createIntersectionObserver',
    (options?: MiniProgramIntersectionObserverOptions) => {
      const nativeOwner = resolveSetupBridgeOwner('createIntersectionObserver')
      if (nativeOwner && typeof (nativeOwner as any).createIntersectionObserver === 'function') {
        return (nativeOwner as any).createIntersectionObserver(options ?? {})
      }

      const miniProgramGlobal = getMiniProgramGlobalObject()
      if (
        !supportsCurrentMiniProgramRuntimeCapability('globalCreateIntersectionObserver')
        || !miniProgramGlobal
        || typeof miniProgramGlobal.createIntersectionObserver !== 'function'
      ) {
        return undefined
      }

      const scopedOwner = resolveRuntimeNativeMethodOwner(runtime, target, 'setData') ?? target
      if (getCurrentMiniProgramRuntimeCapabilities().intersectionObserverScopeByParameter) {
        return miniProgramGlobal.createIntersectionObserver(scopedOwner as any, options ?? {})
      }
      return miniProgramGlobal.createIntersectionObserver(options ?? {})
    },
  )

  defineSetupInstanceMethod(setupInstanceBridge, 'setData', (payload: Record<string, any>, callback?: () => void) => {
    const nativeOwner = resolveSetupBridgeOwner('setData')
    if (nativeOwner && typeof (nativeOwner as any).setData === 'function') {
      return (nativeOwner as any).setData(payload, callback)
    }

    const adapter = runtime?.adapter as AdapterWithSetData | undefined
    const result = typeof adapter?.setData === 'function'
      ? adapter.setData(payload)
      : undefined
    if (typeof callback === 'function') {
      callback()
    }
    return result
  })

  defineSetupInstanceMethod(
    setupInstanceBridge,
    'setUpdatePerformanceListener',
    (listener?: ((result: Record<string, any>) => void)) => {
      const nativeOwner = resolveSetupBridgeOwner('setUpdatePerformanceListener')
      if (nativeOwner && typeof (nativeOwner as any).setUpdatePerformanceListener === 'function') {
        return (nativeOwner as any).setUpdatePerformanceListener(listener)
      }
      return undefined
    },
  )

  const setupInstance = safeMarkNoSetData(new Proxy(setupInstanceBridge, {
    get(bridgeTarget, key, receiver) {
      if (Reflect.has(bridgeTarget, key)) {
        return Reflect.get(bridgeTarget, key, receiver)
      }
      const value = (target as any)[key as any]
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    },
    has(bridgeTarget, key) {
      return Reflect.has(bridgeTarget, key) || key in (target as any)
    },
    set(bridgeTarget, key, value) {
      if (Reflect.has(bridgeTarget, key)) {
        // 仅覆写 setup 暴露的 bridge 方法，避免回写原生实例引发递归调用。
        ;(bridgeTarget as any)[key as any] = value
        return true
      }
      ;(target as any)[key as any] = value
      return true
    },
  }) as SetupContextNativeInstance)

  try {
    Object.defineProperty(target as Record<string, any>, WEVU_SETUP_CONTEXT_INSTANCE_KEY, {
      value: setupInstance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(target as any)[WEVU_SETUP_CONTEXT_INSTANCE_KEY] = setupInstance
  }

  return setupInstance
}
