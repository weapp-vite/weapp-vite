import type { MiniProgramEventListener, RenderComponentOptions } from '../types'

/** 将事件订阅映射到宿主声明绑定，不拦截组件 triggerEvent。 */
export function createComponentEvents(options: RenderComponentOptions = {}) {
  const subscriptions = new Map<string, Map<symbol, MiniProgramEventListener | undefined>>()
  const log = new Map<string, unknown[]>()
  let changed = () => {}

  function normalizeEventName(eventName: string) {
    if (!/^[\w:.-]+$/.test(eventName)) {
      throw new TypeError('Component event names must contain only letters, numbers, underscores, colons, dots or hyphens.')
    }
    return eventName
  }

  function on(eventName: string, listener?: MiniProgramEventListener) {
    const name = normalizeEventName(eventName)
    const listeners = subscriptions.get(name) ?? new Map<symbol, MiniProgramEventListener | undefined>()
    const token = Symbol(name)
    subscriptions.set(name, listeners)
    listeners.set(token, listener)
    changed()
    let active = true
    return () => {
      if (active) {
        active = false
        listeners.delete(token)
        if (listeners.size === 0 && subscriptions.get(name) === listeners) {
          subscriptions.delete(name)
        }
        changed()
      }
    }
  }

  function off(eventName: string, listener?: MiniProgramEventListener) {
    if (listener === undefined) {
      subscriptions.delete(eventName)
    }
    else {
      const listeners = subscriptions.get(eventName)
      for (const [token, registered] of listeners ?? []) {
        if (registered === listener) {
          listeners?.delete(token)
        }
      }
      if (listeners?.size === 0) {
        subscriptions.delete(eventName)
      }
    }
    changed()
  }

  for (const name of options.events ?? []) {
    on(name)
  }
  for (const [name, listener] of Object.entries(options.on ?? {})) {
    on(name, listener)
  }

  return {
    clear() {
      subscriptions.clear()
      changed = () => {}
    },
    emitted: (name: string) => [...(log.get(name) ?? [])],
    names: () => [...subscriptions.keys()],
    off,
    on,
    receive(name: string, detail: unknown, event: Record<string, any>) {
      const listeners = subscriptions.get(name)
      if (!listeners) {
        return
      }
      const entries = log.get(name) ?? []
      entries.push(detail)
      log.set(name, entries)
      for (const listener of [...listeners.values()]) {
        listener?.(detail, event)
      }
    },
    setChangeHandler(handler: () => void) {
      changed = handler
    },
  }
}
