import { injectStyle, removeStyle } from './style'

interface AppStyleConsumer {
  requestUpdate: () => unknown
}

const styleId = 'weapp-web-app-style'
const consumers = new Set<AppStyleConsumer>()
let appStyle = ''

export function getAppStyle() {
  return appStyle
}

/** 应用样式是页面及非隔离组件的共享输入；主题变量通过 document 自然继承。 */
export function setAppStyle(style: string) {
  if (style === appStyle) {
    return
  }
  appStyle = style
  if (style) {
    injectStyle(style, styleId)
  }
  else {
    removeStyle(styleId)
  }
  for (const consumer of consumers) {
    consumer.requestUpdate()
  }
}

export function trackAppStyle(consumer: AppStyleConsumer, enabled: boolean) {
  if (enabled) {
    consumers.add(consumer)
  }
  else {
    consumers.delete(consumer)
  }
}
