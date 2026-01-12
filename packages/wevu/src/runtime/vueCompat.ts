import type { Ref } from '../reactivity/ref'
import type { ModelBinding, ModelBindingOptions } from './types'
import { customRef } from '../reactivity/ref'
import { getCurrentInstance, getCurrentSetupContext } from './hooks'

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
  return ctx.slots ?? Object.create(null)
}

export function useModel<T = any>(props: Record<string, any>, name: string): Ref<T> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useModel() 必须在 setup() 的同步阶段调用')
  }

  const emit: ((event: string, detail?: any, options?: any) => void) | undefined = ctx.emit
  const eventName = `update:${name}`

  return customRef<T>({
    get: () => (props as any)?.[name] as T,
    set: (value: T) => {
      emit?.(eventName, value)
    },
  })
}

/**
 * useBindModel 返回绑定到当前运行时实例的 bindModel。
 * 该方法必须在 setup() 的同步阶段调用。
 */
export function useBindModel() {
  const instance = getCurrentInstance()
  if (!instance?.__wevu || typeof instance.__wevu.bindModel !== 'function') {
    throw new Error('useBindModel() 必须在 setup() 的同步阶段调用')
  }
  return instance.__wevu.bindModel.bind(instance.__wevu) as <T = any>(
    path: string,
    options?: ModelBindingOptions<T>,
  ) => ModelBinding<T>
}

export function mergeModels<T>(a: T, b: T): T {
  if (a == null) {
    return b
  }
  if (b == null) {
    return a
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return Array.from(new Set([...a, ...b])) as any
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return { ...(a as any), ...(b as any) }
  }
  return b
}
