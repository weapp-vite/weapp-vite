export const supportsLit = typeof document !== 'undefined'
  && typeof document.createComment === 'function'
  && typeof document.createTreeWalker === 'function'

export const FallbackElement = class {}

export const MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX = 'data-mp-on-'
export const MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-mp-on-flags-'

export const LEGACY_EVENT_ATTRIBUTE_PREFIX = 'data-wx-on-'
export const LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-wx-on-flags-'

export const EVENT_ATTRIBUTE_PREFIXES = [
  MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX,
  LEGACY_EVENT_ATTRIBUTE_PREFIX,
] as const

export const EVENT_FLAG_ATTRIBUTE_PREFIXES = [
  MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX,
  LEGACY_EVENT_FLAG_ATTRIBUTE_PREFIX,
] as const
