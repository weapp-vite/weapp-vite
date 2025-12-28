import type { Ref } from './ref'
import { customRef } from './ref'

/**
 * 创建一个“浅层” ref：它只在 .value 被整体替换时触发依赖，不会对内部对象做深层响应式处理。
 *
 * @param value 初始值
 * @param defaultValue 传递给 customRef 的默认值，可用于兜底
 * @returns 仅跟踪自身 .value 变更的浅层 ref
 *
 * @example
 * ```ts
 * const state = shallowRef({ count: 0 })
 * state.value = { count: 1 } // 会触发依赖
 * state.value.count++ // 不会触发依赖（内部属性未被深度代理）
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
 * 判断传入值是否为浅层 ref。
 *
 * @param r 待判断的值
 * @returns 若为浅层 ref 则返回 true
 */
export function isShallowRef(r: any): r is Ref<any> {
  // 目前凡是用 customRef 创建的 ref 都视为“浅层”，因为不会递归包装内部属性
  return r && typeof r === 'object' && 'value' in r && typeof r.value !== 'function'
}

/**
 * 主动触发一次浅层 ref 的更新（无需深度比较）。
 *
 * @param ref 需要触发的 ref
 */
export function triggerRef<T>(ref: Ref<T>) {
  // 若未来有专用 trigger 机制可替换，此处作为兼容 API 的占位实现
  if (ref && typeof ref === 'object' && 'value' in ref) {
    // 通过重新赋值自身触发依赖
    const value = ref.value
    ref.value = value as any
  }
}
