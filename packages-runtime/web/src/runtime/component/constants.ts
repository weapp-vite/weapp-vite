export const supportsLit = typeof document !== 'undefined'
  && typeof document.createComment === 'function'
  && typeof document.createTreeWalker === 'function'

export const FallbackElement = class {}

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
