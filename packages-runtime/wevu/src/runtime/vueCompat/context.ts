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
  // 小程序场景通过编译期 slot 名元数据恢复可枚举 slots 对象。
  return ctx.slots ?? EMPTY_SETUP_SLOTS
}

export function useNativeInstance(): SetupContextNativeInstance {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx?.instance) {
    throw new Error('useNativeInstance() 必须在 setup() 的同步阶段调用')
  }
  return ctx.instance as SetupContextNativeInstance
}
