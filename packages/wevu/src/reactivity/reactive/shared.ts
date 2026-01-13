export enum ReactiveFlags {
  IS_REACTIVE = '__r_isReactive',
  RAW = '__r_raw',
  SKIP = '__r_skip', // 标记此对象无需转换为响应式（用于 markRaw）
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

// 版本键（VERSION_KEY）表示“任意字段发生变化”，用于订阅整体版本避免深度遍历跟踪
export const VERSION_KEY: unique symbol = Symbol('wevu.version')

export function isArrayIndexKey(key: string) {
  if (!key) {
    return false
  }
  const code0 = key.charCodeAt(0)
  if (code0 < 48 || code0 > 57) {
    return false
  }
  const n = Number(key)
  return Number.isInteger(n) && n >= 0 && String(n) === key
}

export function toRaw<T>(observed: T): T {
  return ((observed as any)?.[ReactiveFlags.RAW] ?? observed) as T
}
