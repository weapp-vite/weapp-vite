import type { Ref as VueRef, ShallowRef as VueShallowRef } from '../vue-types'
import type { Dep } from './core'
import { trackEffects, triggerEffects } from './core'
import { convertToReactive, markRaw } from './reactive'

// 类型对齐 @vue/reactivity.Ref：
// - 用于 Volar 模板自动解包（UnwrapRef 依赖 RefSymbol 品牌标记）。
// - 运行时仍使用 wevu 自己的 ref 实现，不依赖 Vue。
export type Ref<T = any, S = T> = VueRef<T, S>
export type ShallowRef<T = any> = VueShallowRef<T>

export const RefFlag = '__v_isRef' as const

export function markAsRef<T extends object>(target: T): T {
  try {
    Object.defineProperty(target, RefFlag, {
      value: true,
      configurable: true,
    })
  }
  catch {
    ;(target as any)[RefFlag] = true
  }
  return target
}

export function isRef(value: unknown): value is Ref<any> {
  return Boolean(value && typeof value === 'object' && (value as any)[RefFlag] === true)
}

class RefImpl<T> {
  private _value: T
  private _rawValue: T
  public dep: Dep | undefined
  constructor(value: T) {
    markAsRef(this)
    this._rawValue = value
    this._value = convertToReactive(value)
  }

  get value(): T {
    if (!this.dep) {
      this.dep = new Set()
    }
    trackEffects(this.dep)
    return this._value
  }

  set value(newValue: T) {
    if (!Object.is(newValue, this._rawValue)) {
      this._rawValue = newValue
      this._value = convertToReactive(newValue)
      if (this.dep) {
        triggerEffects(this.dep)
      }
    }
  }
}

export function ref<T>(value: T): Ref<T> {
  if (isRef(value)) {
    return value
  }
  return markRaw(new RefImpl(value)) as any
}

export function unref<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value
}

/**
 * 自定义 ref 工厂：用于创建可显式控制 track/trigger 的自定义 ref
 */
export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void,
) => {
  get: () => T
  set: (value: T) => void
}

export interface CustomRefOptions<T> {
  get: () => T
  set: (value: T) => void
}

export type CustomRefSource<T> = CustomRefFactory<T> | CustomRefOptions<T>

class CustomRefImpl<T> {
  private _getValue: () => T
  private _setValue: (value: T) => void
  public dep: Dep | undefined

  constructor(factory: CustomRefSource<T>, defaultValue?: T) {
    markAsRef(this)
    const fallbackValue = defaultValue
    const track = () => {
      if (!this.dep) {
        this.dep = new Set()
      }
      trackEffects(this.dep)
    }
    const trigger = () => {
      if (this.dep) {
        triggerEffects(this.dep)
      }
    }

    const withFallback = (value: T) => (value === undefined && fallbackValue !== undefined ? fallbackValue as T : value)

    if (typeof factory === 'function') {
      const handlers = factory(track, trigger)
      this._getValue = () => withFallback(handlers.get())
      this._setValue = value => handlers.set(value)
      return
    }

    const handlers = factory
    this._getValue = () => {
      track()
      return withFallback(handlers.get())
    }
    this._setValue = (value: T) => {
      handlers.set(value)
      trigger()
    }
  }

  get value(): T {
    return this._getValue()
  }

  set value(newValue: T) {
    this._setValue(newValue)
  }
}

export function customRef<T>(factory: CustomRefSource<T>, defaultValue?: T): Ref<T> {
  return markRaw(new CustomRefImpl(factory, defaultValue)) as any
}
