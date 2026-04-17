import { createDefu } from 'defu'

export * from './platforms'
export { default as defu } from 'defu'
export { default as get } from 'get-value'

const SPECIAL_CHARS_RE = /[|\\{}()[\]^$+*?.]/g
const HYPHEN_RE = /-/g
const LAST_EXT_RE = /\.[^/.]+$/
const ALL_EXT_RE = /(\.[^/.]+)+$/

function hasExtension(filename: string) {
  const lastSlashIndex = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'))
  const baseName = lastSlashIndex >= 0 ? filename.slice(lastSlashIndex + 1) : filename
  const lastDotIndex = baseName.lastIndexOf('.')
  return lastDotIndex > 0
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
