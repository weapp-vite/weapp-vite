import { WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY } from '@weapp-core/constants'

export type SubscribeMessageDecision = 'accept' | 'reject' | 'ban' | 'filter'

export function normalizeSubscribeDecision(value: unknown): SubscribeMessageDecision {
  if (value === 'accept' || value === 'reject' || value === 'ban' || value === 'filter') {
    return value
  }
  return 'accept'
}

export function normalizeSubscribeTemplateIds(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

export function resolveSubscribeDecisionMap(tmplIds: string[]) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal[WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY]
  const presetValue = typeof preset === 'function'
    ? (preset as (ids: string[]) => unknown)(tmplIds)
    : preset
  if (presetValue && typeof presetValue === 'object') {
    const output: Record<string, SubscribeMessageDecision> = {}
    const source = presetValue as Record<string, unknown>
    for (const tmplId of tmplIds) {
      output[tmplId] = normalizeSubscribeDecision(source[tmplId])
    }
    return output
  }
  const sharedDecision = normalizeSubscribeDecision(presetValue)
  return tmplIds.reduce<Record<string, SubscribeMessageDecision>>((result, tmplId) => {
    result[tmplId] = sharedDecision
    return result
  }, {})
}
