import type { ReactiveEffect } from './core'
import { effect, track, trigger } from './core'

export type ComputedGetter<T> = () => T
export type ComputedSetter<T> = (value: T) => void

export interface ComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T> {
  value: T
}

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRef<T> | WritableComputedRef<T> {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  const onlyGetter = typeof getterOrOptions === 'function'
  if (onlyGetter) {
    getter = getterOrOptions as ComputedGetter<T>
    setter = () => {
      throw new Error('Computed value is readonly')
    }
  }
  else {
    getter = (getterOrOptions as WritableComputedOptions<T>).get
    setter = (getterOrOptions as WritableComputedOptions<T>).set
  }
  let value: T
  let dirty = true
  let runner: ReactiveEffect<T>
  const obj: any = {
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      track(obj, 'value')
      return value
    },
    set value(newValue: T) {
      setter(newValue)
    },
  }
  runner = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    },
  })
  return (onlyGetter ? obj as ComputedRef<T> : obj as WritableComputedRef<T>)
}
