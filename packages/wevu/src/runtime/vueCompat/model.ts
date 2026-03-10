import type { Ref } from '../../reactivity'
import type {
  ModelBinding,
  ModelBindingOptions,
  ModelBindingPayload,
} from '../types'
import { customRef } from '../../reactivity/ref'
import { capitalize } from '../../utils'
import { getCurrentInstance, getCurrentSetupContext } from '../hooks'

export type ModelModifiers<M extends PropertyKey = string> = Record<M, true | undefined>
export type ModelRef<T, M extends PropertyKey = string, G = T, S = T> = Ref<G, S> & [ModelRef<T, M, G, S>, ModelModifiers<M>]

export interface UseModelOptions<T, M extends PropertyKey = string, G = T, S = T> {
  get?: (value: T, modifiers: ModelModifiers<M>) => G
  set?: (value: S, modifiers: ModelModifiers<M>) => T
}

const EMPTY_MODEL_MODIFIERS = Object.freeze(Object.create(null)) as ModelModifiers<any>

function resolveModelModifiers<M extends PropertyKey = string>(
  props: Record<string, any>,
  name: string,
): ModelModifiers<M> {
  const key = name === 'modelValue' ? 'modelModifiers' : `${name}Modifiers`
  const modifiers = props?.[key]
  if (!modifiers || typeof modifiers !== 'object') {
    return EMPTY_MODEL_MODIFIERS as ModelModifiers<M>
  }
  return modifiers as ModelModifiers<M>
}

function attachModelTuple<T, M extends PropertyKey = string, G = T, S = T>(
  model: Ref<G, S>,
  getModifiers: () => ModelModifiers<M>,
): ModelRef<T, M, G, S> {
  const tupleModel = model as ModelRef<T, M, G, S>
  try {
    Object.defineProperty(tupleModel, Symbol.iterator, {
      configurable: true,
      value: () => {
        let index = 0
        return {
          next: () => {
            if (index === 0) {
              index += 1
              return { value: tupleModel, done: false }
            }
            if (index === 1) {
              index += 1
              return { value: getModifiers(), done: false }
            }
            return { value: undefined, done: true }
          },
        }
      },
    })
  }
  catch {
    // 忽略 defineProperty 失败场景，降级为普通 Ref 返回
  }
  return tupleModel
}

export function useModel<T = any, M extends PropertyKey = string>(
  props: Record<string, any>,
  name: string,
): ModelRef<T, M, T, T>
export function useModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  props: Record<string, any>,
  name: string,
  options: UseModelOptions<T, M, G, S>,
): ModelRef<T, M, G, S>
export function useModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  props: Record<string, any>,
  name: string,
  options: UseModelOptions<T, M, G, S> = {},
): ModelRef<T, M, G, S> {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx) {
    throw new Error('useModel() 必须在 setup() 的同步阶段调用')
  }

  const emit: ((event: string, ...args: any[]) => void) | undefined = ctx.emit
  const eventName = `update:${name}`
  const getModifiers = () => resolveModelModifiers<M>(props, name)
  const model = customRef<G>({
    get: () => {
      const rawValue = (props as any)?.[name] as T
      if (!options.get) {
        return rawValue as unknown as G
      }
      return options.get(rawValue, getModifiers())
    },
    set: (value: G) => {
      const nextValue = options.set
        ? options.set(value as unknown as S, getModifiers())
        : (value as unknown as T)
      emit?.(eventName, nextValue)
    },
  })
  return attachModelTuple<T, M, G, S>(model, getModifiers)
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
    return [...new Set([...a, ...b])] as any
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return { ...(a as any), ...(b as any) }
  }
  return b
}
