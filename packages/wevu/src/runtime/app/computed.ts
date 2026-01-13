import type { ComputedRef } from '../../reactivity'
import { effect } from '../../reactivity'
import { track, trigger } from '../../reactivity/core'
import { markAsRef } from '../../reactivity/ref'

interface ComputedOptions {
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
}

export function createComputedAccessors(options: ComputedOptions) {
  const computedRefs: Record<string, ComputedRef<any>> = Object.create(null)
  const computedSetters: Record<string, (value: any) => void> = Object.create(null)
  const dirtyComputedKeys = new Set<string>()

  const createTrackedComputed = <T>(
    key: string,
    getter: () => T,
    setter?: (value: T) => void,
  ): ComputedRef<T> => {
    let value: T
    let dirty = true
    let runner!: () => T
    const obj: any = {
      get value() {
        if (dirty) {
          value = runner()
          dirty = false
        }
        track(obj, 'value')
        return value
      },
      set value(nextValue: T) {
        if (!setter) {
          throw new Error('计算属性是只读的')
        }
        setter(nextValue)
      },
    }
    markAsRef(obj)
    runner = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!dirty) {
          dirty = true
          if (options.setDataStrategy === 'patch' && options.includeComputed) {
            dirtyComputedKeys.add(key)
          }
          trigger(obj, 'value')
        }
      },
    })
    return obj as ComputedRef<T>
  }

  const computedProxy = new Proxy(
    {},
    {
      get(_target, key: string | symbol) {
        if (typeof key === 'string' && computedRefs[key]) {
          return computedRefs[key].value
        }
        return undefined
      },
      has(_target, key: string | symbol) {
        return typeof key === 'string' && Boolean(computedRefs[key])
      },
      ownKeys() {
        return Object.keys(computedRefs)
      },
      getOwnPropertyDescriptor(_target, key: string | symbol) {
        if (typeof key === 'string' && computedRefs[key]) {
          return {
            configurable: true,
            enumerable: true,
            value: computedRefs[key].value,
          }
        }
        return undefined
      },
    },
  )

  return {
    computedRefs,
    computedSetters,
    dirtyComputedKeys,
    createTrackedComputed,
    computedProxy,
  }
}
