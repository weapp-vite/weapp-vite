import type { ComponentBehaviorOptions } from './component/types'
import { injectStyle, removeStyle } from './style'

const styleId = 'weapp-web-app-style'
const subscribers = new Set<() => void>()
let appStyle = ''

/** 应用样式是页面及非隔离组件的共享输入；主题变量通过 document 自然继承。 */
export function setAppStyle(style: string) {
  appStyle = style
  if (style) {
    injectStyle(style, styleId)
  }
  else {
    removeStyle(styleId)
  }
  for (const update of subscribers) {
    update()
  }
}

export function getComponentAppStyle(options?: ComponentBehaviorOptions) {
  const isolation = options?.styleIsolation ?? (options?.addGlobalClass ? 'apply-shared' : 'isolated')
  return isolation === 'isolated' ? '' : appStyle
}

export function subscribeAppStyle(update: () => void) {
  subscribers.add(update)
  return () => {
    subscribers.delete(update)
  }
}
