import { hyphenate } from './utils/text'

const NON_ALNUM_RE = /[^a-z0-9]+/gi
const LEADING_TRAILING_DASH_RE = /^-+|-+$/g

export const INLINE_DATASET_KEY = 'wi'
export const INLINE_HANDLER_KEY = 'wh'
export const INLINE_EVENT_DETAIL_KEY = 'wd'

export function normalizeMiniProgramEventName(eventName: string): string {
  return eventName.includes(':')
    ? eventName.replaceAll(':', '-').toLowerCase()
    : hyphenate(eventName)
}

export function normalizeEventDatasetSuffix(eventName: string): string {
  const normalized = normalizeMiniProgramEventName(eventName.trim())
    .replace(NON_ALNUM_RE, '-')
    .replace(LEADING_TRAILING_DASH_RE, '')
  return normalized || 'event'
}

export function createInlineExpressionId(seed: number) {
  return `i${seed.toString(36)}`
}
