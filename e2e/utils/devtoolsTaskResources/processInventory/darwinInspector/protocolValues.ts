const MAX_UINT64 = (1n << 64n) - 1n

export function invalid(message: string): never {
  throw new Error(`Darwin inspector protocol: ${message}.`)
}

export function record(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !(key in value))) {
    return invalid('unexpected object shape')
  }
  return value as Record<string, unknown>
}

export function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return invalid('invalid integer')
  }
  return value
}

export function decimal(value: unknown, maximum = MAX_UINT64) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value) || value.length > 20 || BigInt(value) > maximum) {
    return invalid('invalid precise integer')
  }
  return value
}

/** 扩展必须整组出现；旧传输不合成新证据，额外字段仍被拒绝。 */
export function extendedRecord(value: unknown, keys: string[], extensionKeys: string[]) {
  const extended = value !== null && typeof value === 'object' && extensionKeys.some(key => key in value)
  return { raw: record(value, extended ? [...keys, ...extensionKeys] : keys), extended }
}
