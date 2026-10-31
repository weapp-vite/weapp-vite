import { EVENT_KIND_ALIAS } from '../shared/wxml'
import { acceptsRuntimeTouchEvent, isRuntimeTouchEvent, isRuntimeTouchName, registerRuntimeTouchTarget } from './touchEvents'

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

export function resolveRuntimeEventName(name: string, listener: EventListener) {
  return handlerNames.get(listener) ?? name
}

/** 保留 DOM 事件的冒泡行为，仅在框架监听入口区分组件 emit 与浏览器原生事件。 */
export function listenRuntimeEvent(element: Element, name: string, listener: EventListener, capture = false) {
  const logicalName = resolveRuntimeEventName(name, listener)
  const nativeAlias = EVENT_KIND_ALIAS[logicalName]
  const eventNames = new Set([nativeAlias ?? name, logicalName])
  const dispatch: EventListener = (event) => {
    if (componentEvents.has(event)) {
      if (event.type !== logicalName) {
        return
      }
    }
    else if (componentElements.has(element) && !nativeAlias && !isRuntimeTouchEvent(event)) {
      return
    }
    if (isRuntimeTouchEvent(event) && !acceptsRuntimeTouchEvent(element, event)) {
      return
    }
    listener.call(element, event)
  }
  for (const eventName of eventNames) {
    element.addEventListener(eventName, dispatch, isRuntimeTouchName(eventName) ? { capture, passive: false } : capture)
  }
  const releaseTouch = isRuntimeTouchName(logicalName) ? registerRuntimeTouchTarget(element) : undefined
  let active = true
  return () => {
    if (!active) {
      return
    }
    active = false
    releaseTouch?.()
    for (const eventName of eventNames) {
      element.removeEventListener(eventName, dispatch, capture)
    }
  }
}
