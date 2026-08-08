export type UniEventHandler = (...args: any[]) => void

interface EventListenerRecord {
  handler: UniEventHandler
  original: UniEventHandler
}

const listeners = new Map<string, Set<EventListenerRecord>>()

export function $on(eventName: string, handler: UniEventHandler): void {
  if (typeof eventName !== 'string' || typeof handler !== 'function') {
    return
  }
  const eventListeners = listeners.get(eventName) ?? new Set<EventListenerRecord>()
  eventListeners.add({ handler, original: handler })
  listeners.set(eventName, eventListeners)
}

export function $off(eventName?: string, handler?: UniEventHandler): void {
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
    if (record.original === handler || record.handler === handler) {
      eventListeners.delete(record)
    }
  }
  if (eventListeners.size === 0) {
    listeners.delete(eventName)
  }
}

export function $once(eventName: string, handler: UniEventHandler): void {
  if (typeof eventName !== 'string' || typeof handler !== 'function') {
    return
  }
  const onceHandler: UniEventHandler = (...args) => {
    $off(eventName, handler)
    handler(...args)
  }
  const eventListeners = listeners.get(eventName) ?? new Set<EventListenerRecord>()
  eventListeners.add({ handler: onceHandler, original: handler })
  listeners.set(eventName, eventListeners)
}

export function $emit(eventName: string, ...args: any[]): void {
  const eventListeners = listeners.get(eventName)
  if (!eventListeners) {
    return
  }
  for (const { handler } of [...eventListeners]) {
    handler(...args)
  }
}
