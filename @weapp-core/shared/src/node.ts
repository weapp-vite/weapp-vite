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
 * @description 生成稳定对象哈希，避免依赖已被禁用的 object-hash 包。
 */
export function objectHash(value: unknown) {
  const bytes = UTF8_ENCODER.encode(stableSerialize(value))
  return HASH_SEEDS
    .map(seed => xmur3(bytes, seed).toString(16).padStart(8, '0'))
    .join('')
}
