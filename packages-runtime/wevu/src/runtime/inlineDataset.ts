const AMP_RE = /&amp;/g
const QUOT_RE = /&quot;/g
const NUM_QUOT_RE = /&#34;/g
const APOS_RE = /&apos;/g
const NUM_APOS_RE = /&#39;/g
const LT_RE = /&lt;/g
const GT_RE = /&gt;/g

const DATASET_ARRAY_INDEX_RE = /^(?:0|[1-9]\d*)$/
const NON_ALNUM_RE = /[^a-z0-9]+/gi
const LEADING_TRAILING_DASH_RE = /^-+|-+$/g
const DASH_ALNUM_RE = /-([a-z0-9])/g
const DATASET_KEY_SEPARATOR_RE = /[-_]/g

function normalizeDatasetIndex(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    return DATASET_ARRAY_INDEX_RE.test(trimmed) ? Number(trimmed) : trimmed
  }
  return undefined
}

function normalizeEventToken(value: string): string {
  return value
    .trim()
    .replace(NON_ALNUM_RE, '-')
    .replace(LEADING_TRAILING_DASH_RE, '')
    .toLowerCase()
}

function resolveNormalizedDatasetValue(dataset: Record<string, unknown>, key: string): unknown {
  const normalizedKey = key.replace(DATASET_KEY_SEPARATOR_RE, '').toLowerCase()
  for (const [datasetKey, value] of Object.entries(dataset)) {
    if (datasetKey.replace(DATASET_KEY_SEPARATOR_RE, '').toLowerCase() === normalizedKey) {
      return value
    }
  }
  return undefined
}

function resolveEventDatasetKey(baseKey: string, event: unknown): string | undefined {
  const eventType = event && typeof event === 'object' && 'type' in event && typeof event.type === 'string'
    ? event.type
    : ''
  const token = normalizeEventToken(eventType)
  if (!token) {
    return undefined
  }
  const camelToken = token.replace(DASH_ALNUM_RE, (_, character: string) => character.toUpperCase())
  if (!camelToken) {
    return undefined
  }
  return `${baseKey}${camelToken[0].toUpperCase()}${camelToken.slice(1)}`
}

const DATASET_KEY_ALIASES: Record<string, string[]> = {
  wvEventDetail: ['wd', 'wvEventDetail'],
  wvHandler: ['wh', 'wvHandler'],
  wvInlineId: ['wi', 'wvInlineId'],
}

/**
 * 解码 WXML 数据集传递时可能保留的实体。
 */
export function decodeWxmlEntities(value: string): string {
  return value
    .replace(AMP_RE, '&')
    .replace(QUOT_RE, '"')
    .replace(NUM_QUOT_RE, '"')
    .replace(APOS_RE, '\'')
    .replace(NUM_APOS_RE, '\'')
    .replace(LT_RE, '<')
    .replace(GT_RE, '>')
}

/**
 * 解析模板事件数据集键，兼容平台的大小写和事件后缀归一化。
 */
export function resolveDatasetEventValue(
  dataset: Record<string, unknown>,
  baseKey: string,
  event: unknown,
): unknown {
  const aliasKeys = DATASET_KEY_ALIASES[baseKey] ?? [baseKey]
  for (const aliasKey of aliasKeys) {
    const specificKey = resolveEventDatasetKey(aliasKey, event)
    if (specificKey && dataset[specificKey] !== undefined) {
      return dataset[specificKey]
    }
    if (specificKey) {
      const normalizedValue = resolveNormalizedDatasetValue(dataset, specificKey)
      if (normalizedValue !== undefined) {
        return normalizedValue
      }
    }
  }
  for (const aliasKey of aliasKeys) {
    if (dataset[aliasKey] !== undefined) {
      return dataset[aliasKey]
    }
    const normalizedValue = resolveNormalizedDatasetValue(dataset, aliasKey)
    if (normalizedValue !== undefined) {
      return normalizedValue
    }
  }
  return undefined
}

/**
 * 将模板循环索引转换为稳定的数字或字符串键。
 */
export function resolveDatasetIndex(value: unknown): number | string | undefined {
  return normalizeDatasetIndex(value)
}
