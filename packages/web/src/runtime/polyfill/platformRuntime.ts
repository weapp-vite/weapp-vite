interface UpdatePresetSnapshot {
  hasUpdate: boolean
  ready: boolean
  failed: boolean
}

interface RuntimeConsoleLike {
  debug?: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  log?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
}

export function readExtConfigValue() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const value = runtimeGlobal.__weappViteWebExtConfig
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

export function createUpdateManagerBridge(
  resolveUpdateManagerPreset: () => UpdatePresetSnapshot,
  scheduleMicrotask: (callback: () => void) => void,
) {
  return {
    applyUpdate() {},
    onCheckForUpdate(callback: ((result: { hasUpdate: boolean }) => void) | undefined) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      scheduleMicrotask(() => callback({ hasUpdate: preset.hasUpdate }))
    },
    onUpdateReady(callback: (() => void) | undefined) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      if (!preset.hasUpdate || !preset.ready) {
        return
      }
      scheduleMicrotask(() => callback())
    },
    onUpdateFailed(callback: (() => void) | undefined) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      if (!preset.hasUpdate || !preset.failed) {
        return
      }
      scheduleMicrotask(() => callback())
    },
  }
}

export function createLogManagerBridge(level: 0 | 1, runtimeConsole: RuntimeConsoleLike | undefined) {
  const invokeConsole = (method: 'debug' | 'info' | 'log' | 'warn', args: unknown[]) => {
    const handler = runtimeConsole?.[method]
    if (typeof handler === 'function') {
      handler.apply(runtimeConsole, args)
    }
  }
  return {
    debug(...args: unknown[]) {
      if (level > 0) {
        return
      }
      invokeConsole('debug', args)
    },
    info(...args: unknown[]) {
      invokeConsole('info', args)
    },
    log(...args: unknown[]) {
      invokeConsole('log', args)
    },
    warn(...args: unknown[]) {
      invokeConsole('warn', args)
    },
  }
}

export function reportAnalyticsEvent(eventName: string, data?: Record<string, unknown>) {
  const runtimeGlobal = globalThis as {
    __weappViteWebAnalyticsEvents?: Array<{
      eventName: string
      data: Record<string, unknown>
      timestamp: number
    }>
  }
  runtimeGlobal.__weappViteWebAnalyticsEvents ??= []
  runtimeGlobal.__weappViteWebAnalyticsEvents.push({
    eventName: String(eventName ?? ''),
    data: { ...(data ?? {}) },
    timestamp: Date.now(),
  })
}
