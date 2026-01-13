import type { Ref } from '../reactivity/ref'
import type { ModelBinding, ModelBindingOptions, ModelBindingPayload } from './types'
import { customRef } from '../reactivity/ref'
import { capitalize } from '../utils'
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
type BindModelWithHelper<
  DefaultEvent extends string = 'input',
  DefaultValueProp extends string = 'value',
> = (<T = any>(path: string, options?: ModelBindingOptions<T>) => ModelBinding<T>) & {
  model: <T = any, Event extends string = DefaultEvent, ValueProp extends string = DefaultValueProp, Formatted = T>(
    path: string,
    options?: ModelBindingOptions<T, Event, ValueProp, Formatted>,
  ) => ModelBindingPayload<T, Event, ValueProp, Formatted>
  value: <T = any, Event extends string = DefaultEvent, ValueProp extends string = DefaultValueProp, Formatted = T>(
    path: string,
    options?: ModelBindingOptions<T, Event, ValueProp, Formatted>,
  ) => Formatted
  on: <T = any, Event extends string = DefaultEvent, ValueProp extends string = DefaultValueProp, Formatted = T>(
    path: string,
    options?: ModelBindingOptions<T, Event, ValueProp, Formatted>,
  ) => (event: any) => void
}

export function useBindModel<
  DefaultEvent extends string = 'input',
  DefaultValueProp extends string = 'value',
>(defaultOptions?: ModelBindingOptions<any, DefaultEvent, DefaultValueProp, any>) {
  const instance = getCurrentInstance()
  if (!instance?.__wevu || typeof instance.__wevu.bindModel !== 'function') {
    throw new Error('useBindModel() 必须在 setup() 的同步阶段调用')
  }
  const rawBindModel = instance.__wevu.bindModel.bind(instance.__wevu) as <T = any>(
    path: string,
    options?: ModelBindingOptions<T>,
  ) => ModelBinding<T>
  const bindModel: BindModelWithHelper<DefaultEvent, DefaultValueProp> = (<T = any>(path: string, options?: ModelBindingOptions<T>) => {
    if (!defaultOptions) {
      return rawBindModel(path, options)
    }
    const merged = {
      ...(defaultOptions as ModelBindingOptions<T, DefaultEvent, DefaultValueProp, any>),
      ...(options as ModelBindingOptions<T, DefaultEvent, DefaultValueProp, any>),
    } as ModelBindingOptions<T>
    return rawBindModel(path, merged)
  }) as BindModelWithHelper<DefaultEvent, DefaultValueProp>

  bindModel.model = (path, options) => bindModel(path).model(options)
  bindModel.value = (path, options) => {
    const merged = { ...defaultOptions, ...options } as ModelBindingOptions<any>
    const valueProp = merged?.valueProp ?? 'value'
    const payload = bindModel.model(path, options) as Record<string, any>
    return payload[valueProp]
  }
  bindModel.on = (path, options) => {
    const merged = { ...defaultOptions, ...options } as ModelBindingOptions<any>
    const eventName = merged?.event ?? 'input'
    const handlerKey = `on${capitalize(eventName)}`
    const payload = bindModel.model(path, options) as Record<string, any>
    return payload[handlerKey]
  }

  return bindModel
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
