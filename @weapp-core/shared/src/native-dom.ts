export interface NativeDomEvent {
  detail?: unknown
  stopPropagation?: () => void
  target?: unknown
  type?: string
}

export interface NativeDomNode {
  addEventListener: (type: string, listener: (event: NativeDomEvent) => void, capture?: boolean) => void
  appendChild: (node: NativeDomNode) => unknown
  insertBefore: (node: NativeDomNode, before: NativeDomNode | null) => unknown
  nodeValue?: string | null
  removeAttribute: (name: string) => void
  removeChild: (node: NativeDomNode) => unknown
  removeEventListener: (type: string, listener: (event: NativeDomEvent) => void, capture?: boolean) => void
  setAttribute: (name: string, value: unknown) => void
}

export interface NativeDomDocument {
  createElement: (type: string) => NativeDomNode
  createNativeComponent: (type: string, options: Record<string, unknown>) => NativeDomNode
  createTextNode: (value: string) => NativeDomNode
  getPageDocumentById: (webviewId: number) => NativeDomNode | undefined
}

export interface TtRuntime {
  appDocument?: NativeDomDocument
  getBuiltInComponents?: () => Set<string> | string[]
  getRenderMode?: () => number
}

export const DEFAULT_BUILT_IN_COMPONENTS = new Set([
  'ad',
  'audio',
  'block',
  'button',
  'camera',
  'canvas',
  'checkbox',
  'checkbox-group',
  'cover-image',
  'cover-view',
  'editor',
  'form',
  'functional-page-navigator',
  'icon',
  'image',
  'input',
  'label',
  'live-player',
  'live-pusher',
  'map',
  'movable-area',
  'movable-view',
  'navigator',
  'official-account',
  'open-data',
  'picker',
  'picker-view',
  'picker-view-column',
  'progress',
  'radio',
  'radio-group',
  'rich-text',
  'scroll-view',
  'slot',
  'slider',
  'swiper',
  'swiper-item',
  'switch',
  'textarea',
  'text',
  'video',
  'view',
  'web-view',
])

export type NativeDomRendererMode = 'legacy' | 'auto' | 'native-dom'

export interface NativeDomSelection {
  appDocument: NativeDomDocument
  container: NativeDomNode
  builtInComponents: Set<string>
}

/** 在开始执行用户 setup 前选择后端；探针失败仅允许 auto 回退。 */
export function selectNativeDom(
  config: { mode: NativeDomRendererMode, platform: string },
  adapter: { __webviewId__?: number },
  owner: string,
): NativeDomSelection | undefined {
  if (config.mode === 'legacy' || (config.mode === 'auto' && config.platform !== 'tt')) {
    return undefined
  }
  if (config.platform !== 'tt') {
    throw new Error(`[${owner}] renderer: 'native-dom' 仅支持 tt 平台，当前目标为 ${config.platform || 'unknown'}`)
  }
  try {
    const runtime = (globalThis as typeof globalThis & { tt?: TtRuntime }).tt
    const appDocument = runtime?.appDocument
    if (runtime?.getRenderMode?.() !== 2 || !appDocument
      || typeof appDocument.createElement !== 'function'
      || typeof appDocument.createNativeComponent !== 'function'
      || typeof appDocument.createTextNode !== 'function'
      || typeof appDocument.getPageDocumentById !== 'function'
      || typeof adapter.__webviewId__ !== 'number') {
      throw new Error('Render Mode V2 API 不可用')
    }
    const container = appDocument.getPageDocumentById(adapter.__webviewId__)
    if (!container) {
      throw new Error('页面文档尚不可用')
    }
    const builtIn = runtime.getBuiltInComponents?.()
    return {
      appDocument,
      container,
      builtInComponents: builtIn instanceof Set ? builtIn : Array.isArray(builtIn) ? new Set(builtIn) : DEFAULT_BUILT_IN_COMPONENTS,
    }
  }
  catch (cause) {
    if (config.mode === 'auto') {
      return undefined
    }
    const error = new Error(`[${owner}] renderer: 'native-dom' 需要抖音 Render Mode V2、tt.appDocument 与当前页面 __webviewId__ (${cause instanceof Error ? cause.message : String(cause)})`)
    ;(error as Error & { cause?: unknown }).cause = cause
    throw error
  }
}

/** 按平台内置组件清单创建节点，其他标签交给原生组件 bridge。 */
export function createNativeDomElement(selection: NativeDomSelection, type: string) {
  return selection.builtInComponents.has(type)
    ? selection.appDocument.createElement(type)
    : selection.appDocument.createNativeComponent(type, { __tt__inner__options__: { name: type } })
}
