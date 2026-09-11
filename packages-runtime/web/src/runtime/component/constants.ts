export const supportsLit = typeof document !== 'undefined'
  && typeof document.createComment === 'function'
  && typeof document.createTreeWalker === 'function'

export const FallbackElement = class {}

// HTML 会折叠属性名大小写，因此用小写安全后缀保存自定义事件名。
const EVENT_ATTRIBUTE_NAME_ESCAPE_RE = /[A-Z_]/g
const EVENT_ATTRIBUTE_NAME_UNESCAPE_RE = /_([a-z_])/g

export function encodeEventAttributeName(eventName: string) {
  return eventName.replace(
    EVENT_ATTRIBUTE_NAME_ESCAPE_RE,
    character => character === '_' ? '__' : `_${character.toLowerCase()}`,
  )
}

export function decodeEventAttributeName(attributeName: string) {
  return attributeName.replace(
    EVENT_ATTRIBUTE_NAME_UNESCAPE_RE,
    (_match, character: string) => character === '_' ? '_' : character.toUpperCase(),
  )
}

export const MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX = 'data-mp-on-'
export const MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-mp-on-flags-'

export const WECHAT_LEGACY_EVENT_ATTRIBUTE_PREFIX = 'data-wx-on-'
export const WECHAT_LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-wx-on-flags-'

export const LEGACY_EVENT_ATTRIBUTE_PREFIX = WECHAT_LEGACY_EVENT_ATTRIBUTE_PREFIX
export const LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX = WECHAT_LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX

export const EVENT_ATTRIBUTE_PREFIXES = [
  MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX,
  WECHAT_LEGACY_EVENT_ATTRIBUTE_PREFIX,
] as const

export const EVENT_FLAG_ATTRIBUTE_PREFIXES = [
  MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX,
  WECHAT_LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX,
] as const
