import type { Ref as VueRef } from '@vue/reactivity'
import type { Dep } from './core'
import { trackEffects, triggerEffects } from './core'
import { convertToReactive, markRaw } from './reactive'

// 类型对齐 @vue/reactivity.Ref：
// - 用于 Volar 模板自动解包（UnwrapRef 依赖 RefSymbol 品牌标记）。
// - 运行时仍使用 wevu 自己的 ref 实现，不依赖 Vue。
export type Ref<T = any, S = T> = VueRef<T, S>

export function isRef(value: unknown): value is Ref<any> {
  return Boolean(value && typeof value === 'object' && 'value' in (value as any))
}

class RefImpl<T> {
  private _value: T
  private _rawValue: T
  public dep: Dep | undefined
  constructor(value: T) {
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
export interface CustomRefFactory<T> {
  get: () => T
  set: (value: T) => void
}

class CustomRefImpl<T> {
  private _value: T
  private _factory: CustomRefFactory<T>
  public dep: Dep | undefined

  constructor(factory: CustomRefFactory<T>, defaultValue?: T) {
    this._factory = factory
    this._value = defaultValue as T
  }

  get value(): T {
    if (!this.dep) {
      this.dep = new Set()
    }
    trackEffects(this.dep)
    return this._factory.get()
  }

  set value(newValue: T) {
    this._factory.set(newValue)
    if (this.dep) {
      triggerEffects(this.dep)
    }
  }
}

export function customRef<T>(factory: CustomRefFactory<T>, defaultValue?: T): Ref<T> {
  return markRaw(new CustomRefImpl(factory, defaultValue)) as any
}
