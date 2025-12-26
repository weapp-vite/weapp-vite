import type { Ref } from './ref'
import { customRef } from './ref'

/**
 * Creates a ref that tracks its own .value mutation but doesn't make its value reactive.
 *
 * @param value - The initial value
 * @param defaultValue - Optional default value for customRef
 * @returns A shallow ref
 *
 * @example
 * ```ts
 * const state = shallowRef({ count: 0 })
 *
 * state.value = { count: 1 } // triggers effect
 * state.value.count++ // does NOT trigger effect
 * ```
 */
export function shallowRef<T>(value: T): Ref<T>
export function shallowRef<T>(value: T, defaultValue: T): Ref<T>
export function shallowRef<T>(value: T, defaultValue?: T): Ref<T> {
  return customRef<T>(
    (track, trigger) => ({
      get() {
        track()
        return value
      },
      set(newValue: T) {
        if (Object.is(value, newValue)) {
          return
        }
        value = newValue
        trigger()
      },
    }),
    defaultValue,
  ) as Ref<T>
}

/**
 * Checks if a value is a shallow ref
 *
 * @param r - The value to check
 * @returns True if the value is a shallow ref
 */
export function isShallowRef(r: any): r is Ref<any> {
  // For now, all refs created with customRef are considered "shallow"
  // since they don't automatically deep-reactify their values
  return r && typeof r === 'object' && 'value' in r && typeof r.value !== 'function'
}

/**
 * Force trigger a shallow ref (bypassing deep reactivity)
 *
 * @param ref - The ref to trigger
 */
export function triggerRef<T>(ref: Ref<T>) {
  // This would need to be implemented with the ref system's trigger mechanism
  // For now, this is a placeholder for API compatibility
  if (ref && typeof ref === 'object' && 'value' in ref) {
    // Trigger reactivity by reassigning the value
    const value = ref.value
    ref.value = value as any
  }
}
