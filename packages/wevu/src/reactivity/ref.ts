import type { Dep } from './core'
import { trackEffects, triggerEffects } from './core'
import { convertToReactive, markRaw } from './reactive'

// 保持 wevu 运行时不依赖 Vue，但对齐 Vue 的 Ref 形状，
// 以便工具链（例如 Volar 模板自动解包）能够识别。
export interface Ref<T = any, S = T> {
  get value(): T
  set value(_: S)
  // 兼容 Vue 的带品牌标记 Ref 类型（使用 unique symbol 作为 key）。
  [key: symbol]: any
}

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

class CustomRefImpl<T> implements Ref<T> {
  [key: symbol]: any
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
