import { createDefu } from 'defu'

export * from './platforms'
export { default as defu } from 'defu'
export { default as get } from 'get-value'

const SPECIAL_CHARS_RE = /[|\\{}()[\]^$+*?.]/g
const HYPHEN_RE = /-/g
const LAST_EXT_RE = /\.[^/.]+$/
const ALL_EXT_RE = /(\.[^/.]+)+$/
const UTF8_ENCODER = new TextEncoder()
const HASH_SEEDS = [0, 1, 2, 3] as const

function bytesToHex(bytes: Uint8Array) {
  let result = ''
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0')
  }
  return result
}

function stableSerialize(value: unknown, seen = new Map<object, number>()): string {
  if (value === null) {
    return 'null'
  }

  switch (typeof value) {
    case 'undefined':
      return 'undefined'
    case 'string':
      return JSON.stringify(value)
    case 'number':
      if (Number.isNaN(value)) {
        return 'number:NaN'
      }
      if (!Number.isFinite(value)) {
        return `number:${value > 0 ? 'Infinity' : '-Infinity'}`
      }
      if (Object.is(value, -0)) {
        return 'number:-0'
      }
      return `number:${value}`
    case 'bigint':
      return `bigint:${value.toString()}`
    case 'boolean':
      return `boolean:${value}`
    case 'symbol':
      return `symbol:${String(value)}`
    case 'function':
      return `function:${value.toString()}`
  }

  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  if (value instanceof RegExp) {
    return `regexp:${value.toString()}`
  }

  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}:${bytesToHex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))}`
  }

  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer:${bytesToHex(new Uint8Array(value))}`
  }

  if (seen.has(value)) {
    return `circular:${seen.get(value)}`
  }

  seen.set(value, seen.size)

  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item, seen)).join(',')}]`
  }

  if (value instanceof Set) {
    return `Set(${Array.from(value, item => stableSerialize(item, seen)).join(',')})`
  }

  if (value instanceof Map) {
    const entries = Array.from(
      value.entries(),
      ([key, item]) => [stableSerialize(key, seen), stableSerialize(item, seen)] as const,
    )
      .sort(([left], [right]) => left.localeCompare(right))
    return `Map(${entries.map(([key, item]) => `${key}=>${item}`).join(',')})`
  }

  const entries = Reflect.ownKeys(value)
    .sort((left, right) => String(left).localeCompare(String(right)))
    .map((key) => {
      return `${stableSerialize(key, seen)}:${stableSerialize((value as Record<PropertyKey, unknown>)[key], seen)}`
    })
  return `{${entries.join(',')}}`
}

function hasExtension(filename: string) {
  const lastSlashIndex = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'))
  const baseName = lastSlashIndex >= 0 ? filename.slice(lastSlashIndex + 1) : filename
  const lastDotIndex = baseName.lastIndexOf('.')
  return lastDotIndex > 0
}

function xmur3(bytes: Uint8Array, seed: number) {
  let hash = (1779033703 ^ bytes.length ^ seed) >>> 0
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
  return (hash ^ (hash >>> 16)) >>> 0
}

/**
 * @description 转义字符串中的正则特殊字符
 */
export function escapeStringRegexp(str: string) {
  return str
    .replace(SPECIAL_CHARS_RE, '\\$&')
    .replace(HYPHEN_RE, '\\x2d')
}

/**
 * @description 移除文件名的最后一个扩展名
 */
export function removeExtension(file: string) {
  return file.replace(LAST_EXT_RE, '')
}

/**
 * @description 移除文件名的所有扩展名（多重后缀）
 */
export function removeExtensionDeep(file: string) {
  return file.replace(ALL_EXT_RE, '')
}

/**
 * @description 若缺少扩展名则追加（默认 .js）
 */
export function addExtension(filename: string, ext = '.js') {
  let result = `${filename}`
  if (!hasExtension(filename)) {
    result += ext
  }
  return result
}

/**
 * @description 将单个值转换为数组
 */
export function arrify<T>(val: T | readonly T[]): T[] {
  if (Array.isArray(val)) {
    return [...val]
  }
  return [val as T]
}

export { default as set } from 'set-value'

/**
 * @description defu 合并策略：当目标/来源为数组时直接覆盖
 */
export const defuOverrideArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = value
    return true
  }
})

/**
 * @description 判断是否为非 null 的对象
 */
export function isObject(x: unknown): x is Record<string | symbol | number, unknown> {
  return typeof x === 'object' && x !== null
}

/**
 * @description 判断对象是否为空对象
 */
export function isEmptyObject(obj: unknown) {
  if (isObject(obj)) {
    let name: string
    // eslint-disable-next-line no-unreachable-loop
    for (name in obj) {
      return false
    }
    return true
  }
  return false
}

/**
 * @description 生成稳定对象哈希，避免依赖已被禁用的 object-hash 包
 */
export function objectHash(value: unknown) {
  const bytes = UTF8_ENCODER.encode(stableSerialize(value))
  return HASH_SEEDS
    .map(seed => xmur3(bytes, seed).toString(16).padStart(8, '0'))
    .join('')
}
