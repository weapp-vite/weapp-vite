import type { HmrRuntimeFallbackReason } from '../../runtime/hmrRuntimeCapabilities'
import type { WeappReactConfig } from '../../types'
import { compileStaticReactPage, hasNativeComponentBridge, ReactNativeBridgeStaticError } from './staticTemplate'
import { ReactStaticTemplateUnsupportedError } from './staticTemplate/types'

export interface ReactTemplateHmrCapability {
  renderMode: 'static' | 'dynamic'
  fallback: HmrRuntimeFallbackReason
}

/** React 模板模块的归属独立于 auto 最终选中的渲染方式。 */
export function isReactHmrTemplateSource(value: boolean | WeappReactConfig | undefined, id: string): boolean {
  return Boolean(value && /\.(?:jsx|tsx)(?:\?.*)?$/.test(id) && !id.replaceAll('\\', '/').includes('/node_modules/'))
}

/** 复用实际编译器辨别注册方式；两种模板目前均没有经真实宿主验证的状态保留能力。 */
export function resolveReactTemplateHmrCapability(
  value: boolean | WeappReactConfig | undefined,
  id: string,
  source: string,
): ReactTemplateHmrCapability | undefined {
  if (!isReactHmrTemplateSource(value, id)) {
    return undefined
  }
  const requested = typeof value === 'object' ? value.renderMode ?? 'auto' : 'auto'
  let renderMode: ReactTemplateHmrCapability['renderMode'] = 'dynamic'
  if (requested === 'dynamic') {
    if (hasNativeComponentBridge(source)) {
      throw new Error(`[react] ${id} 使用了原生组件 bridge，renderMode: 'dynamic' 不支持自定义组件`)
    }
  }
  else {
    try {
      compileStaticReactPage(source, id)
      renderMode = 'static'
    }
    catch (error) {
      if (!(error instanceof ReactStaticTemplateUnsupportedError) || error instanceof ReactNativeBridgeStaticError || requested === 'static') {
        throw error
      }
    }
  }
  return {
    renderMode,
    fallback: {
      code: 'patch-shape',
      message: `React ${renderMode} 模板更新缺少已验证的运行时状态保留能力，需要 classic 重新建立页面与组件。`,
      files: [id],
    },
  }
}
