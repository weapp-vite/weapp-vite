interface VkSession {
  start: () => Promise<{ errMsg: string }>
  stop: () => Promise<{ errMsg: string }>
  destroy: () => void
  on: (eventName: string, callback: (payload: unknown) => void) => void
  off: (eventName?: string, callback?: (payload: unknown) => void) => void
}

export function createVkSessionBridge(): VkSession {
  let destroyed = false
  const listeners = new Map<string, Set<(payload: unknown) => void>>()

  const ensureAvailable = (action: string) => {
    if (destroyed) {
      throw new TypeError(`createVKSession:fail session is destroyed (${action})`)
    }
  }

  return {
    start() {
      try {
        ensureAvailable('start')
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return Promise.reject(new TypeError(message))
      }
      return Promise.resolve({ errMsg: 'vkSession.start:ok' })
    },
    stop() {
      try {
        ensureAvailable('stop')
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return Promise.reject(new TypeError(message))
      }
      return Promise.resolve({ errMsg: 'vkSession.stop:ok' })
    },
    destroy() {
      destroyed = true
      listeners.clear()
    },
    on(eventName: string, callback: (payload: unknown) => void) {
      if (typeof eventName !== 'string' || typeof callback !== 'function') {
        return
      }
      const key = eventName.trim()
      if (!key) {
        return
      }
      const list = listeners.get(key) ?? new Set<(payload: unknown) => void>()
      list.add(callback)
      listeners.set(key, list)
    },
    off(eventName?: string, callback?: (payload: unknown) => void) {
      if (typeof eventName !== 'string' || !eventName.trim()) {
        listeners.clear()
        return
      }
      const list = listeners.get(eventName.trim())
      if (!list) {
        return
      }
      if (typeof callback !== 'function') {
        listeners.delete(eventName.trim())
        return
      }
      list.delete(callback)
      if (list.size === 0) {
        listeners.delete(eventName.trim())
      }
    },
  }
}
