import type { VisualWebComponentTag } from './runtime/nativeComponents/registry'
import {
  VISUAL_WEB_COMPONENT_CONSTRUCTORS,
  WEB_VISUAL_COMPONENT_TAGS,
} from './runtime/nativeComponents/registry'
import { ensureNativeComponentStyle, NATIVE_COMPONENT_STYLE } from './runtime/nativeComponents/style'
import { setupRpx } from './runtime/rpx'
import { setupWebViewport } from './runtime/viewport'

export type { VisualWebComponentTag } from './runtime/nativeComponents/registry'
export { ROUTE_COUPLED_WEB_TAGS } from './runtime/nativeComponents/registry'
export type { RpxConfig } from './runtime/rpx'
export type { WebViewportConfig } from './runtime/viewport/types'
export type { NativeComponentWebTag } from './shared/nativeComponents'

/**
 * 注册纯视觉原生组件自定义元素，缺省注册全部视觉标签。
 *
 * 该入口不安装小程序全局对象，也不提供 `wx.*` API、页面栈或模板数据绑定；
 * 宿主框架用标准 DOM 属性配置，用标准 CustomEvent 监听 `detail`。
 */
export function defineElements(tags: readonly VisualWebComponentTag[] = WEB_VISUAL_COMPONENT_TAGS): void {
  if (typeof customElements === 'undefined') {
    return
  }
  for (const tag of tags) {
    if (customElements.get(tag)) {
      continue
    }
    customElements.define(tag, VISUAL_WEB_COMPONENT_CONSTRUCTORS[tag])
  }
}

export {
  ensureNativeComponentStyle,
  NATIVE_COMPONENT_STYLE,
  setupRpx,
  setupWebViewport,
  WEB_VISUAL_COMPONENT_TAGS,
}
