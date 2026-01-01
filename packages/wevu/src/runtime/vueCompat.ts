import type { Ref } from '../reactivity/ref'
import { customRef } from '../reactivity/ref'
import { getCurrentSetupContext } from './hooks'

export function useAttrs(): Record<string, any> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useAttrs() must be called synchronously inside setup()')
  }
  return ctx.attrs ?? {}
}

export function useSlots(): Record<string, any> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useSlots() must be called synchronously inside setup()')
  }
  return ctx.slots ?? Object.create(null)
}

export function useModel<T = any>(props: Record<string, any>, name: string): Ref<T> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useModel() must be called synchronously inside setup()')
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
