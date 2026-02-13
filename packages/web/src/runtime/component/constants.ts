export const supportsLit = typeof document !== 'undefined'
  && typeof document.createComment === 'function'
  && typeof document.createTreeWalker === 'function'

export const FallbackElement = class {}

export const EVENT_FLAG_ATTRIBUTE_PREFIX = 'data-wx-on-flags-'
