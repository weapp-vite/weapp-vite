/**
 * @file 字符串与版本处理工具。
 */
const trimPatternCache = new Map<string, RegExp>()

function getTrimPattern(chars: string) {
  const existing = trimPatternCache.get(chars)
  if (existing) {
    return existing
  }

  const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g')
  trimPatternCache.set(chars, pattern)
  return pattern
}

/** startWith 的方法封装。 */
export function startWith(value: string, prefix: string) {
  return value.startsWith(prefix)
}

/** endWith 的方法封装。 */
export function endWith(value: string, suffix: string) {
  return value.endsWith(suffix)
}

/** trim 的方法封装。 */
export function trim(value: string, chars?: string) {
  if (!chars) {
    return value.trim()
  }

  return value.replace(getTrimPattern(chars), '')
}

/** cmpVersion 的方法封装。 */
export function cmpVersion(versionA: string, versionB: string) {
  const left = versionA.split('.')
  const right = versionB.split('.')
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const currentLeft = Number.parseInt(left[index] || '0', 10)
    const currentRight = Number.parseInt(right[index] || '0', 10)
    if (currentLeft > currentRight) {
      return 1
    }
    if (currentLeft < currentRight) {
      return -1
    }
  }

  return 0
}

/** toStr 的方法封装。 */
export function toStr(value: unknown) {
  return value == null ? '' : String(value)
}
