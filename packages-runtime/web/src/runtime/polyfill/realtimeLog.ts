import type { RealtimeLogManager } from './types/compatibility'
import { emitRuntimeWarning } from '../warning'
import { readRuntimeConsole } from './platformRuntime'

export type { RealtimeLogManager, RealtimeTagLogManager } from './types/compatibility'

function createLogger(tag?: string, parentFilters?: () => string[]) {
  const filters = new Set<string>()
  const readFilters = () => [...(parentFilters?.() ?? []), ...filters]
  const invoke = (method: 'info' | 'warn' | 'error', args: unknown[]) => {
    const logger = readRuntimeConsole()
    const handler = logger?.[method]
    if (typeof handler !== 'function') {
      return
    }
    const context = [tag ? `[${tag}]` : '', ...readFilters().map(value => `[${value}]`)].filter(Boolean)
    handler.apply(logger, [...context, ...args])
  }
  return {
    info: (...args: unknown[]) => invoke('info', args),
    warn: (...args: unknown[]) => invoke('warn', args),
    error: (...args: unknown[]) => invoke('error', args),
    setFilterMsg(message: string) {
      filters.clear()
      filters.add(message)
    },
    addFilterMsg(message: string) {
      filters.add(message)
    },
    readFilters,
  }
}

/** 只向本地 console 输出，不缓存或上传日志，也不持有页面实例。 */
export function getRealtimeLogManager(): RealtimeLogManager {
  emitRuntimeWarning('[@weapp-vite/web] wx.getRealtimeLogManager 在 Web 端仅输出本地 console 日志，不会上报到微信平台。', { key: 'getRealtimeLogManager' })
  const { readFilters, ...logger } = createLogger()
  return {
    ...logger,
    in() {},
    tag(name) {
      const { readFilters: _readFilters, ...tagLogger } = createLogger(name, readFilters)
      return tagLogger
    },
    getCurrentState: () => ({ logCount: 0, maxLogCount: 0, maxSize: 0, size: 0 }),
  }
}
