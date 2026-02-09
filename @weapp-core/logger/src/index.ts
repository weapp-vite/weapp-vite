import type { ConsolaInstance } from 'consola'
import { createConsola } from 'consola'
import picocolors from 'picocolors'

/**
 * @description 日志类型
 */
export type LogType = 'error' | 'warn' | 'info'
/**
 * @description 日志级别
 */
export type LogLevel = LogType | 'silent'

/**
 * @description 终端文本染色工具，基于 picocolors。
 */
export const colors = picocolors

export interface LoggerConfig {
  /**
   * @description 全局日志级别
   * @example
   * level: 'info'
   */
  level?: LogLevel
  /**
   * @description 按 tag 覆盖日志级别
   * @example
   * tags: { build: 'warn', npm: 'silent' }
   */
  tags?: Record<string, LogLevel | undefined>
}

const baseLogger = createConsola()
const levelRank: Record<LogLevel, number> = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
}
const typeLevel: Record<string, number> = {
  fatal: 0,
  error: 0,
  warn: 1,
  log: 2,
  info: 2,
  success: 2,
  fail: 2,
  ready: 2,
  start: 2,
  box: 2,
  debug: 2,
  trace: 2,
}
const defaultLoggerConfig: Required<LoggerConfig> = {
  level: 'info',
  tags: {},
}
let loggerConfig = { ...defaultLoggerConfig }

/**
 * @description 设置全局 logger 配置
 */
export function configureLogger(config: LoggerConfig = {}) {
  loggerConfig = {
    level: config.level ?? defaultLoggerConfig.level,
    tags: config.tags ?? defaultLoggerConfig.tags,
  }
}

function resolveLogLevel(tag?: string): LogLevel {
  if (tag && loggerConfig.tags[tag]) {
    return loggerConfig.tags[tag]!
  }
  return loggerConfig.level
}

function shouldLog(tag: string | undefined, type: string) {
  const level = resolveLogLevel(tag)
  if (level === 'silent') {
    return false
  }
  const requiredLevel = typeLevel[type] ?? levelRank.info
  return levelRank[level] >= requiredLevel
}

function createLogger(tag?: string): ConsolaInstance {
  const target = tag ? baseLogger.withTag(tag) : baseLogger
  return new Proxy(target, {
    get(targetLogger, prop, receiver) {
      if (prop === 'withTag' || prop === 'withScope') {
        return (nextTag: string) => createLogger(nextTag)
      }
      if (typeof prop !== 'string') {
        return Reflect.get(targetLogger, prop, receiver)
      }
      const value = Reflect.get(targetLogger, prop, receiver)
      if (typeof value === 'function' && prop in typeLevel) {
        return (...args: unknown[]) => {
          if (shouldLog(tag, prop)) {
            return value.apply(targetLogger, args)
          }
        }
      }
      if (typeof value === 'function') {
        return value.bind(targetLogger)
      }
      return value
    },
  }) as ConsolaInstance
}

const logger = createLogger()

export default logger
