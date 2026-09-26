import type { ReactiveEffect } from './core'
import type { Ref } from './ref'
import { createComputedEffect, track, trigger } from './core'
import { markRaw } from './reactive'
import { ReactiveFlags } from './reactive/shared'
import { markAsRef } from './ref'

export type ComputedGetter<T> = () => T
export type ComputedSetter<T> = (value: T) => void

declare const computedBrand: unique symbol
declare const writableComputedBrand: unique symbol

const computedRefs = new WeakSet<object>()

/** 识别计算来源，供 Store 将派生值与可持久化 state 分离。 */
export function isComputedRef(value: unknown): value is ComputedRef | WritableComputedRef<any> {
  return typeof value === 'object' && value !== null && computedRefs.has(value)
}

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [key: symbol]: any
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly [computedBrand]: true
  readonly value: T
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  readonly [writableComputedBrand]: true
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
      throw new Error('计算属性是只读的')
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
  markAsRef(obj)
  markRaw(obj)
  computedRefs.add(obj)
  Object.defineProperty(obj, ReactiveFlags.IS_READONLY, { value: onlyGetter })
  runner = createComputedEffect(getter, {
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
