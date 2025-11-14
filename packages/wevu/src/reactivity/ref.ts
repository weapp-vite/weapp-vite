import type { Dep } from './core'
import { trackEffects, triggerEffects } from './core'
import { convertToReactive } from './reactive'

export interface Ref<T = any> {
  value: T
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
  return new RefImpl(value)
}

export function unref<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value
}
