import { EVENT_KIND_ALIAS } from '../shared/wxml'

const componentElements = new WeakSet<Element>()
const componentEvents = new WeakSet<Event>()
const handlerNames = new WeakMap<EventListener, string>()

export function registerComponentEventTarget(element: Element) {
  componentElements.add(element)
}

export function markComponentEvent<T extends Event>(event: T): T {
  componentEvents.add(event)
  return event
}

export function nameRuntimeEventHandler(listener: EventListener, name: string) {
  handlerNames.set(listener, name)
  return listener
}

/** 保留 DOM 事件的冒泡行为，仅在框架监听入口区分组件 emit 与浏览器原生事件。 */
export function listenRuntimeEvent(element: Element, name: string, listener: EventListener, capture = false) {
  const logicalName = handlerNames.get(listener) ?? name
  const nativeAlias = EVENT_KIND_ALIAS[logicalName]
  const eventNames = new Set([nativeAlias ?? name, logicalName])
  const dispatch: EventListener = (event) => {
    if (componentEvents.has(event)) {
      if (event.type !== logicalName) {
        return
      }
    }
    else if (componentElements.has(element) && !nativeAlias) {
      return
    }
    listener.call(element, event)
  }
  for (const eventName of eventNames) {
    element.addEventListener(eventName, dispatch, capture)
  }
  return () => {
    for (const eventName of eventNames) {
      element.removeEventListener(eventName, dispatch, capture)
    }
  }
}
