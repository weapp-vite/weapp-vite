import type {
  RolldownWatcher,
  RolldownWatcherEvent,
  RolldownWatcherWatcherEventMap,
} from 'rolldown'

type WatcherEventName = keyof RolldownWatcherWatcherEventMap
type WatcherListener<E extends WatcherEventName> = (
  ...args: RolldownWatcherWatcherEventMap[E]
) => void | Promise<void>

export interface DevBuildWatcherController {
  watcher: RolldownWatcher
  emitEvent: (event: RolldownWatcherEvent) => void
}

/**
 * 为 provider 驱动的一次性构建提供 Rolldown watcher 兼容事件接口。
 */
export function createDevBuildWatcher(): DevBuildWatcherController {
  const listeners = new Map<WatcherEventName, Set<(...args: any[]) => void | Promise<void>>>()
  const pendingEvents: RolldownWatcherEvent[] = []
  let closed = false

  const watcher: RolldownWatcher = {
    on(event, listener) {
      let eventListeners = listeners.get(event)
      if (!eventListeners) {
        eventListeners = new Set()
        listeners.set(event, eventListeners)
      }
      eventListeners.add(listener)
      if (event === 'event' && pendingEvents.length) {
        const queuedEvents = pendingEvents.splice(0)
        for (const queuedEvent of queuedEvents) {
          void Promise.resolve((listener as WatcherListener<'event'>)(queuedEvent)).catch(() => {})
        }
      }
      return watcher
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener)
      return watcher
    },
    clear(event) {
      listeners.delete(event)
    },
    async close() {
      if (closed) {
        return
      }
      closed = true
      const closeListeners = Array.from(listeners.get('close') ?? [])
      listeners.clear()
      await Promise.all(closeListeners.map(listener => listener()))
    },
  }

  function emit<E extends WatcherEventName>(
    event: E,
    ...args: RolldownWatcherWatcherEventMap[E]
  ) {
    if (closed) {
      return
    }
    for (const listener of listeners.get(event) ?? []) {
      void Promise.resolve((listener as WatcherListener<E>)(...args)).catch(() => {})
    }
  }

  return {
    watcher,
    emitEvent(event) {
      if (!listeners.get('event')?.size) {
        pendingEvents.push(event)
        return
      }
      emit('event', event)
    },
  }
}
