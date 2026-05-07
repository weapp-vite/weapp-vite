/**
 * @file 百度智能小程序自动化日志工具。
 */

export interface SmartappLogger {
  error: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

const rawConsole = console
const loggers = new Map<string, SmartappLogger>()

function createLogger(label: string): SmartappLogger {
  return {
    error: message => rawConsole.error(`[${label}] ${message}`),
    info: message => rawConsole.info(`[${label}] ${message}`),
    warn: message => rawConsole.warn(`[${label}] ${message}`),
  }
}

export function set(_dir: string, label = 'smartapp-automator') {
  const logger = createLogger(label)
  loggers.set(label, logger)
  return logger
}

export function get(label = 'smartapp-automator') {
  const logger = loggers.get(label)
  if (!logger) {
    return set('', label)
  }
  return logger
}

export const log = {
  get,
  set,
}
