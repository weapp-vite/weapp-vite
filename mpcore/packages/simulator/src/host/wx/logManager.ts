export interface HeadlessWxGetLogManagerOption {
  /** 控制宿主自动生命周期及 API 日志，不过滤显式日志方法。 */
  level?: number
}

export interface HeadlessWxLogManager {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

export function createHeadlessLogManager(runtimeConsole: HeadlessWxLogManager): HeadlessWxLogManager {
  return {
    debug(...args) {
      runtimeConsole.debug(...args)
    },
    info(...args) {
      runtimeConsole.info(...args)
    },
    log(...args) {
      runtimeConsole.log(...args)
    },
    warn(...args) {
      runtimeConsole.warn(...args)
    },
  }
}
