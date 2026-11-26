import { A2uiValidationError } from '@a2ui/web_core/errors'

export const A2UI_STATE_MESSAGES = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const

export type A2uiStateMessageType = typeof A2UI_STATE_MESSAGES[number]

type A2uiEnvelopeMessage
  = | { readonly version: '1.0', readonly createSurface: unknown }
    | { readonly version: '1.0', readonly updateComponents: unknown }
    | { readonly version: '1.0', readonly updateDataModel: unknown }
    | { readonly version: '1.0', readonly deleteSurface: unknown }

export interface A2uiEnvelope {
  readonly type: A2uiStateMessageType
  readonly surfaceId: string | undefined
  /** 组件或数据被整体替换，需要重建绑定。 */
  readonly replacesBindings: boolean
  readonly message: A2uiEnvelopeMessage
}

/**
 * 校验外部消息为单个 A2UI 1.0 状态消息。
 *
 * 只接受 `version` 与四种 surface 状态消息之一；RPC、内部操作与批量消息一律拒绝。
 */
export function readA2uiEnvelope(message: unknown): A2uiEnvelope {
  const invalid = () => new A2uiValidationError('Expected one A2UI 1.0 surface state message.')
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    throw invalid()
  }
  const keys = Reflect.ownKeys(message)
  const envelope = message as Record<string, unknown>
  const type = A2UI_STATE_MESSAGES.find(key => keys.includes(key))
  if (keys.length !== 2 || !keys.includes('version') || envelope.version !== '1.0' || !type) {
    throw invalid()
  }
  const payload = envelope[type]
  const surfaceId = typeof payload === 'object' && payload !== null && 'surfaceId' in payload
    && typeof payload.surfaceId === 'string'
    ? payload.surfaceId
    : undefined
  // Core 允许创建空 ID，但后续更新与删除会忽略它。
  if (surfaceId === '') {
    throw new A2uiValidationError('A2UI surfaceId must not be empty.')
  }
  return {
    type,
    surfaceId,
    replacesBindings: type === 'updateComponents' || (type === 'updateDataModel'
      && typeof payload === 'object' && payload !== null && 'value' in payload
      && (payload as Record<string, unknown>).value !== null
      && typeof (payload as Record<string, unknown>).value === 'object'),
    message: { version: '1.0', [type]: payload } as A2uiEnvelopeMessage,
  }
}

/** 展开标准消息数组或 `{ messages }` wrapper，并在应用前完成整批形状校验。 */
export function readA2uiEnvelopes(message: unknown): A2uiEnvelope[] {
  if (Array.isArray(message)) {
    return Array.from(message, item => readA2uiEnvelope(item))
  }
  if (typeof message === 'object' && message !== null) {
    const keys = Reflect.ownKeys(message)
    if (keys.length === 1 && keys[0] === 'messages') {
      const messages = (message as { messages?: unknown }).messages
      if (!Array.isArray(messages)) {
        throw new A2uiValidationError('Expected an array of A2UI 1.0 surface state messages.')
      }
      return Array.from(messages, item => readA2uiEnvelope(item))
    }
  }
  return [readA2uiEnvelope(message)]
}
