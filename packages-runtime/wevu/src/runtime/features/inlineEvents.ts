import type { RuntimeCapabilityRegistry } from '../capabilities'
import type { InlineExpressionMap } from '../register/inline'
import type { InternalRuntimeState } from '../types'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { registerRuntimeCapability } from '../capabilities'
import { runInlineExpression } from '../register/inline'

const inlineEventHooks: NonNullable<RuntimeCapabilityRegistry['inlineEvents']> = {
  handler(this: InternalRuntimeState, event: unknown) {
    const runtime = this.__wevu
    const context = runtime?.proxy ?? this
    const inlineMap = runtime?.methods?.[WEVU_INLINE_MAP_KEY] as unknown
    return runInlineExpression(
      context,
      undefined,
      event,
      inlineMap && typeof inlineMap === 'object' && !Array.isArray(inlineMap)
        ? inlineMap as InlineExpressionMap
        : undefined,
    )
  },
  run: runInlineExpression,
}

/**
 * 安装模板内联事件能力。
 */
export function installInlineEvents(): void {
  registerRuntimeCapability('inlineEvents', inlineEventHooks)
}
