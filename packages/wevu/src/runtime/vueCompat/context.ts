import type { SetupContextNativeInstance } from '../types'
import { getCurrentSetupContext } from '../hooks'

const EMPTY_SETUP_SLOTS = Object.freeze(Object.create(null)) as Record<string, never>

export function useAttrs(): Record<string, any> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useAttrs() 必须在 setup() 的同步阶段调用')
  }
  return ctx.attrs ?? {}
}

export function useSlots(): Record<string, any> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useSlots() 必须在 setup() 的同步阶段调用')
  }
  // 小程序场景没有 Web Vue 那样的运行时 slots 函数映射，返回空对象兜底。
  return ctx.slots ?? EMPTY_SETUP_SLOTS
}

export function useNativeInstance(): SetupContextNativeInstance {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx?.instance) {
    throw new Error('useNativeInstance() 必须在 setup() 的同步阶段调用')
  }
  return ctx.instance as SetupContextNativeInstance
}
