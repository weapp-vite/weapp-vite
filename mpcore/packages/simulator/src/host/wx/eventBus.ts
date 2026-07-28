export type HeadlessUniEventHandler = (...args: any[]) => void

interface HeadlessUniEventListener {
  handler: HeadlessUniEventHandler
  original: HeadlessUniEventHandler
}

export interface HeadlessUniEventBus {
  $emit: (eventName: string, ...args: any[]) => void
  $off: (eventName?: string, handler?: HeadlessUniEventHandler) => void
  $on: (eventName: string, handler: HeadlessUniEventHandler) => void
  $once: (eventName: string, handler: HeadlessUniEventHandler) => void
}

export function createHeadlessUniEventBus(): HeadlessUniEventBus {
  const listeners = new Map<string, Set<HeadlessUniEventListener>>()

  const $off: HeadlessUniEventBus['$off'] = (eventName, handler) => {
    if (eventName === undefined) {
      listeners.clear()
      return
    }
    if (typeof eventName !== 'string') {
      return
    }
    if (typeof handler !== 'function') {
      listeners.delete(eventName)
      return
    }
    const eventListeners = listeners.get(eventName)
    if (!eventListeners) {
      return
    }
    for (const record of eventListeners) {
      if (record.handler === handler || record.original === handler) {
        eventListeners.delete(record)
      }
    }
    if (eventListeners.size === 0) {
      listeners.delete(eventName)
    }
  }

  return {
    $emit(eventName, ...args) {
      const eventListeners = listeners.get(eventName)
      if (!eventListeners) {
        return
      }
      for (const record of [...eventListeners]) {
        record.handler(...args)
      }
    },
    $off,
    $on(eventName, handler) {
      if (typeof eventName !== 'string' || typeof handler !== 'function') {
        return
      }
      const eventListeners = listeners.get(eventName) ?? new Set<HeadlessUniEventListener>()
      eventListeners.add({ handler, original: handler })
      listeners.set(eventName, eventListeners)
    },
    $once(eventName, handler) {
      if (typeof eventName !== 'string' || typeof handler !== 'function') {
        return
      }
      const onceHandler: HeadlessUniEventHandler = (...args) => {
        $off(eventName, handler)
        handler(...args)
      }
      const eventListeners = listeners.get(eventName) ?? new Set<HeadlessUniEventListener>()
      eventListeners.add({ handler: onceHandler, original: handler })
      listeners.set(eventName, eventListeners)
    },
  }
}
