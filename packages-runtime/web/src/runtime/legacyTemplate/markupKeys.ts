import type { LegacyDatasetValues } from './dataset'
import { WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX } from '@weapp-core/constants'

const tokenKeys = new WeakMap<object, { key: string, fragment: boolean, attributes?: ReadonlyMap<string, string> }>()
const renderValues = new WeakMap<object, LegacyDatasetValues>()
const sourceIds = new WeakMap<object, number>()
const scopePaths = new WeakMap<object, string>()
let sourceSequence = 0

function sourceId(source: object) {
  let id = sourceIds.get(source)
  if (id === undefined) {
    id = ++sourceSequence
    sourceIds.set(source, id)
  }
  return id
}

export function recordLegacyLoopScope(scope: object, parent: object, source: object, key: unknown, index: number) {
  const identity = typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean'
    ? `${typeof key}:${key}`
    : `index:${index}`
  scopePaths.set(scope, `${scopePaths.get(parent) ?? ''}/${sourceId(source)}:${JSON.stringify(identity)}`)
}

export function recordLegacyElementKey(token: object, source: object, scope: object, fragment = false, attributes?: ReadonlyMap<string, string>) {
  tokenKeys.set(token, { key: `${scopePaths.get(scope) ?? ''}/${sourceId(source)}`, fragment, attributes })
}

export function hasLegacyElementKey(token: object) {
  return tokenKeys.has(token)
}

export function recordLegacyMarkupKeys(context: object, values: LegacyDatasetValues) {
  renderValues.set(context, values)
}

export function resetLegacyMarkupKeys(context: object) {
  renderValues.delete(context)
}

export function resolveLegacyMarkupKeySignature(context: object) {
  return JSON.stringify(renderValues.get(context)?.map((token) => {
    const info = tokenKeys.get(token)
    return info && [info.key, info.fragment]
  }))
}

export function resolveLegacyMarkupKey(context: object, comment: string) {
  if (!comment.startsWith(WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX)) {
    return undefined
  }
  const index = comment.slice(WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX.length)
  const token = /^\d+$/.test(index) ? renderValues.get(context)?.[Number(index)] : undefined
  return token && tokenKeys.get(token)
}
