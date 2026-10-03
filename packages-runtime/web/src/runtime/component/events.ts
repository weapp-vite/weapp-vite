import type { ComponentPublicInstance } from './types'
import { listenRuntimeEvent, nameRuntimeEventHandler } from '../componentEvents'
import { invokeMiniProgramEventHandler } from '../inputHandlerResult'
import {
  decodeEventAttributeName,
  EVENT_ATTRIBUTE_PREFIXES,
  EVENT_FLAG_ATTRIBUTE_PREFIXES,
} from './constants'

interface RuntimeEventFlags {
  catch: boolean
  capture: boolean
}

function parseEventFlags(value: string | null): RuntimeEventFlags {
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

interface RuntimeEventBinding {
  encodedEventName: string
  flagAttributeValue: string | null
  handler: (event: unknown) => unknown
  instance: ComponentPublicInstance
  dispose: () => void
}

const runtimeEventBindings = new WeakMap<HTMLElement, Map<string, RuntimeEventBinding>>()

function getEventFlagAttributeValue(element: HTMLElement, encodedEventName: string) {
  for (const prefix of EVENT_FLAG_ATTRIBUTE_PREFIXES) {
    const value = element.getAttribute(`${prefix}${encodedEventName}`)
    if (value !== null) {
      return value
    }
  }
  return null
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
    let bindings = runtimeEventBindings.get(element)
    if (bindings) {
      for (const [attribute, binding] of bindings) {
        const handlerName = element.getAttribute(attribute)
        if (
          handlerName
          && methods[handlerName] === binding.handler
          && instance === binding.instance
          && getEventFlagAttributeValue(element, binding.encodedEventName) === binding.flagAttributeValue
        ) {
          continue
        }
        binding.dispose()
        bindings.delete(attribute)
      }
    }
    for (const attribute of element.getAttributeNames()) {
      if (bindings?.has(attribute)) {
        continue
      }
      const matchedPrefix = EVENT_ATTRIBUTE_PREFIXES.find(prefix => attribute.startsWith(prefix))
      if (!matchedPrefix || EVENT_FLAG_ATTRIBUTE_PREFIXES.some(prefix => attribute.startsWith(prefix))) {
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
      const encodedEventName = attribute.slice(matchedPrefix.length)
      const eventName = decodeEventAttributeName(encodedEventName)
      const flagAttributeValue = getEventFlagAttributeValue(element, encodedEventName)
      const flags = parseEventFlags(flagAttributeValue)
      const listener = nameRuntimeEventHandler((nativeEvent) => {
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
        invokeMiniProgramEventHandler(handler, instance, syntheticEvent, nativeEvent)
      }, eventName)
      const dispose = listenRuntimeEvent(element, eventName, listener, flags.capture)
      if (!bindings) {
        bindings = new Map()
        runtimeEventBindings.set(element, bindings)
      }
      bindings.set(attribute, { encodedEventName, flagAttributeValue, handler, instance, dispose })
    }
    if (bindings?.size === 0) {
      runtimeEventBindings.delete(element)
    }
  }
}
