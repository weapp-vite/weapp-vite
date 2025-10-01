export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}
