import type {
  InternalRuntimeState,
  MiniProgramAdapter,
  RuntimeInstance,
  SetupContextNativeInstance,
} from '../../types'
import { isNativeBridgeMethod } from '../../nativeBridge'

export type AdapterWithSetData = Required<MiniProgramAdapter> & {
  __wevu_enableSetData?: () => void
  __wevu_setVisibility?: (visible: boolean) => void
}

export type NativeSetData = (payload: Record<string, any>) => void | Promise<void> | undefined

const SETUP_CONTEXT_INSTANCE_KEY = '__wevuSetupContextInstance'

export function attachRuntimeProxyProps(state: Record<string, any>, props: Record<string, any>) {
  try {
    Object.defineProperty(state, '__wevuProps', {
      value: props,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(state as any).__wevuProps = props
  }
}

export function attachNativeInstanceRef(state: Record<string, any>, instance: InternalRuntimeState) {
  try {
    Object.defineProperty(state, '__wevuNativeInstance', {
      value: instance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(state as any).__wevuNativeInstance = instance
  }
}

export function attachRuntimeRef(state: Record<string, any>, runtime: RuntimeInstance<any, any, any>) {
  try {
    Object.defineProperty(state, '__wevuRuntime', {
      value: runtime,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    ;(state as any).__wevuRuntime = runtime
  }
}

export function attachRuntimeInstance(runtime: RuntimeInstance<any, any, any>, instance: InternalRuntimeState) {
  try {
    Object.defineProperty(runtime as Record<string, any>, 'instance', {
      value: instance,
      configurable: true,
      enumerable: false,
      writable: true,
    })
  }
  catch {
    try {
      ;(runtime as Record<string, any>).instance = instance
    }
    catch {
      // 忽略冻结对象写入失败
    }
  }
}

export function resolveNativeSetData(instance: InternalRuntimeState) {
  const setupInstance = (instance as any)[SETUP_CONTEXT_INSTANCE_KEY] as SetupContextNativeInstance | undefined
  const setupOverride = setupInstance && typeof setupInstance.setData === 'function'
    ? setupInstance.setData
    : undefined
  if (typeof setupOverride === 'function' && !isNativeBridgeMethod(setupOverride)) {
    return setupOverride as NativeSetData
  }

  const candidate = (instance as any).setData
  if (typeof candidate !== 'function') {
    return undefined
  }
  if (isNativeBridgeMethod(candidate)) {
    return undefined
  }
  return candidate as NativeSetData
}

function getRuntimeOwnerLabel(instance: InternalRuntimeState) {
  const route = (instance as any).route
  if (typeof route === 'string' && route) {
    return route
  }
  const is = (instance as any).is
  if (typeof is === 'string' && is) {
    return is
  }
  return 'unknown'
}

export function callNativeSetData(
  instance: InternalRuntimeState,
  setData: NativeSetData,
  payload: Record<string, any>,
) {
  try {
    return setData.call(instance, payload)
  }
  catch (error) {
    const owner = getRuntimeOwnerLabel(instance)
    throw new Error(`[wevu] setData failed (${owner}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function syncRuntimeProps(props: Record<string, any>, mpProperties: Record<string, any>) {
  const currentKeys = Object.keys(props)
  for (const key of currentKeys) {
    if (!Object.hasOwn(mpProperties, key)) {
      try {
        delete props[key]
      }
      catch {
        // 忽略异常
      }
    }
  }
  for (const [key, value] of Object.entries(mpProperties)) {
    props[key] = value
  }
}
