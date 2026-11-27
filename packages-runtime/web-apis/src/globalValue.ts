import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'

/** 使用计算属性读取宿主，避免被消费者的 Rolldown inject 改写回自身绑定模块。 */
export function resolveGlobalValue<T>(key: string): T | undefined {
  const value: unknown = Reflect.get(globalThis, key)
  return value as T | undefined
}

/** 宿主写入的占位实现；安装器与原生桥接共用这一判定，避免两套可用性规则分叉。 */
export function isPlaceholderRequestGlobal(value: unknown) {
  return Boolean(value && (typeof value === 'function' || typeof value === 'object')
    && (value as Record<string, unknown>)[REQUEST_GLOBAL_PLACEHOLDER_KEY] === true)
}

/**
 * 宿主只给出缺失或占位实现时才需要写入；真实宿主实现与用户运行期覆盖都保留。
 * 原生模式的全局桥接直接调用该判定，与安装器共享同一份占位规则。
 */
export function shouldInstallWebRuntimeGlobal(current: unknown) {
  return current == null || isPlaceholderRequestGlobal(current)
}
