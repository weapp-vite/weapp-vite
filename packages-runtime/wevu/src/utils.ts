export function capitalize(str: string): string {
  if (!str) {
    return ''
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const HYPHENATE_RE = /\B([A-Z])/g

export function hyphenate(str: string): string {
  if (!str) {
    return str
  }
  return str.replace(HYPHENATE_RE, '-$1').toLowerCase()
}

export function toPathSegments(path: string): string[] {
  if (!path) {
    return []
  }
  return path
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

export function hasOwn(source: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

/**
 * 判断值是否为可等待对象（thenable）。
 *
 * 同步路径用它区分「立即可得」与「需要等待」：只有可等待对象才引入微任务边界，
 * 同步结果保持同栈执行，不打乱调用方的时序假设。
 */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value !== 'object' && typeof value !== 'function') {
    return false
  }
  return 'then' in value && typeof value.then === 'function'
}
