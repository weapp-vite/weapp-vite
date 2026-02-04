/**
 * @description 统一为数组
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * @description 判断是否为 Promise-like
 */
export function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}
