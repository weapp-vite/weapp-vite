interface AppStyleConsumer {
  requestUpdate: () => unknown
}

let appStyle = ''
const consumers = new Set<AppStyleConsumer>()

export function getAppStyle() {
  return appStyle
}

export function setAppStyle(style: string) {
  if (style === appStyle) {
    return
  }
  appStyle = style
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
