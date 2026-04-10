const NON_ALNUM_RE = /[^a-z0-9]+/gi
const LEADING_TRAILING_DASH_RE = /^-+|-+$/g

export const INLINE_DATASET_KEY = 'wi'
export const INLINE_HANDLER_KEY = 'wh'
export const INLINE_EVENT_DETAIL_KEY = 'wd'

export function normalizeEventDatasetSuffix(eventName: string): string {
  const normalized = eventName
    .trim()
    .replace(NON_ALNUM_RE, '-')
    .replace(LEADING_TRAILING_DASH_RE, '')
    .toLowerCase()
  return normalized || 'event'
}

export function createInlineExpressionId(seed: number) {
  return `i${seed.toString(36)}`
}
