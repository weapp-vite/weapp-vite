import type { QueryFilter, QueryKey } from './types'

type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | {
  readonly [key: string]: CanonicalValue
}

function unsupported(path: string, value: unknown): never {
  const kind = value === null ? 'null' : typeof value
  throw new TypeError(`查询键 ${path} 包含不支持的 ${kind} 值`)
}

function canonicalize(value: unknown, path: string, ancestors: Set<object>): CanonicalValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return unsupported(path, value)
    }
    return value === 0 ? 0 : value
  }
  if (typeof value !== 'object') {
    return unsupported(path, value)
  }
  if (ancestors.has(value)) {
    throw new TypeError(`查询键 ${path} 包含循环引用`)
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value)
      if (names.length !== value.length + 1 || Object.getOwnPropertySymbols(value).length > 0) {
        throw new TypeError(`查询键 ${path} 必须是稠密且不含额外属性的数组`)
      }
      const result: CanonicalValue[] = []
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          throw new TypeError(`查询键 ${path}[${index}] 必须是普通数组元素`)
        }
        result.push(canonicalize(descriptor.value, `${path}[${index}]`, ancestors))
      }
      return Object.freeze(result)
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`查询键 ${path} 仅支持普通对象`)
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError(`查询键 ${path} 不支持 Symbol 属性`)
    }

    const result: Record<string, CanonicalValue> = {}
    for (const key of Object.getOwnPropertyNames(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        throw new TypeError(`查询键 ${path}.${key} 必须是可枚举数据属性`)
      }
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: canonicalize(descriptor.value, `${path}.${key}`, ancestors),
        writable: true,
      })
    }
    return Object.freeze(result)
  }
  finally {
    ancestors.delete(value)
  }
}

function canonicalizeKey<TKey extends QueryKey>(key: TKey): TKey {
  if (!Array.isArray(key)) {
    throw new TypeError('查询键必须是数组')
  }
  return canonicalize(key, '$', new Set()) as unknown as TKey
}

/** 复制并冻结查询键，避免调用方后续修改影响缓存身份。 */
export function snapshotQueryKey<TKey extends QueryKey>(key: TKey): TKey {
  return canonicalizeKey(key)
}

/** 将查询键转换为稳定且无静默降级的缓存标识。 */
export function hashQueryKey(key: QueryKey): string {
  return JSON.stringify(canonicalizeKey(key))!
}

/** 在一次规范化中同时生成缓存标识和键快照。 */
export function snapshotAndHashQueryKey<TKey extends QueryKey>(key: TKey): { hash: string, key: TKey } {
  const snapshot = canonicalizeKey(key)
  return { hash: JSON.stringify(snapshot)!, key: snapshot }
}

function isSubset(expected: CanonicalValue, actual: CanonicalValue): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.length === actual.length
      && expected.every((value, index) => isSubset(value, actual[index]!))
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      return false
    }
    const expectedObject = expected as Readonly<Record<string, CanonicalValue>>
    const actualObject = actual as Readonly<Record<string, CanonicalValue>>
    return Object.keys(expectedObject).every(key => (
      Object.prototype.hasOwnProperty.call(actualObject, key)
      && isSubset(expectedObject[key]!, actualObject[key]!)
    ))
  }
  return expected === actual
}

/** 预编译查询过滤器，数组根键按前缀匹配，嵌套对象按子集匹配。 */
export function createQueryMatcher(filter: QueryFilter = {}): (key: QueryKey, hash: string) => boolean {
  if (!filter.key) {
    return () => true
  }
  const expected = canonicalizeKey(filter.key) as readonly CanonicalValue[]
  const expectedHash = JSON.stringify(expected)!
  if (filter.exact) {
    return (_key, hash) => hash === expectedHash
  }
  return (key) => {
    const actual = key as readonly CanonicalValue[]
    return expected.length <= actual.length
      && expected.every((value, index) => isSubset(value, actual[index]!))
  }
}
