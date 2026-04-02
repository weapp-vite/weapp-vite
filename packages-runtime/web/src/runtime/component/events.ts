import type { ComponentPublicInstance } from './types'
import { EVENT_FLAG_ATTRIBUTE_PREFIX } from './constants'

function parseEventFlags(value: string | null) {
  if (!value) {
    return { catch: false, capture: false }
  }
  const tokens = value.split(',').map(token => token.trim()).filter(Boolean)
  const tokenSet = new Set(tokens)
  return {
    catch: tokenSet.has('catch'),
    capture: tokenSet.has('capture'),
  }
}

export function bindRuntimeEvents(
  root: HTMLElement | ShadowRoot,
  methods: Record<string, (event: any) => any>,
  instance: ComponentPublicInstance,
) {
  if (typeof document === 'undefined') {
    return
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const element = walker.currentNode as HTMLElement
    for (const attribute of element.getAttributeNames()) {
      if (!attribute.startsWith('data-wx-on-') || attribute.startsWith(EVENT_FLAG_ATTRIBUTE_PREFIX)) {
        continue
      }
      const handlerName = element.getAttribute(attribute)
      if (!handlerName) {
        continue
      }
      const handler = methods[handlerName]
      if (!handler) {
        continue
      }
      const eventName = attribute.slice('data-wx-on-'.length)
      const flags = parseEventFlags(element.getAttribute(`${EVENT_FLAG_ATTRIBUTE_PREFIX}${eventName}`))
      element.addEventListener(eventName, (nativeEvent) => {
        if (flags.catch) {
          nativeEvent.stopPropagation()
        }
        const dataset = { ...element.dataset }
        const syntheticEvent = {
          type: eventName,
          timeStamp: nativeEvent.timeStamp,
          detail: (nativeEvent as CustomEvent).detail ?? (nativeEvent as InputEvent).data ?? undefined,
          target: {
            dataset,
          },
          currentTarget: {
            dataset,
          },
          originalEvent: nativeEvent,
        }
        handler.call(instance, syntheticEvent)
      }, flags.capture)
    }
  }
}
