import type { AutomatorSessionOptions, MiniProgramEventMap, MiniProgramLike } from './automator-session'
import { inspect } from 'node:util'
import logger, { colors } from '../logger'
import { connectMiniProgram } from './automator-session'

export type ForwardConsoleLogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error'

export interface ForwardConsoleEvent {
  level: ForwardConsoleLogLevel
  message: string
  raw: unknown
}

export interface ForwardConsoleOptions extends AutomatorSessionOptions {
  logLevels?: ForwardConsoleLogLevel[]
  unhandledErrors?: boolean
  onLog?: (event: ForwardConsoleEvent) => void
  onReady?: () => void
}

export interface ForwardConsoleSession {
  close: () => Promise<void>
}

const DEFAULT_FORWARD_CONSOLE_LEVELS: ForwardConsoleLogLevel[] = ['log', 'info', 'warn', 'error']

/**
 * @description 启动小程序控制台日志转发，并保持 automator 会话常驻。
 */
export async function startForwardConsole(options: ForwardConsoleOptions): Promise<ForwardConsoleSession> {
  const miniProgram = await connectMiniProgram(options)
  const logLevels = new Set(options.logLevels?.length ? options.logLevels : DEFAULT_FORWARD_CONSOLE_LEVELS)
  const logHandler = options.onLog ?? printForwardConsoleEvent
  const onConsole: MiniProgramEventMap['console'] = (payload) => {
    const event = normalizeConsoleEvent(payload)
    if (!logLevels.has(event.level)) {
      return
    }
    logHandler(event)
  }
  const onException: MiniProgramEventMap['exception'] = (payload) => {
    if (options.unhandledErrors === false) {
      return
    }
    logHandler(normalizeExceptionEvent(payload))
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)
  options.onReady?.()

  let closed = false

  return {
    async close() {
      if (closed) {
        return
      }
      closed = true
      detachMiniProgramListener(miniProgram, 'console', onConsole)
      detachMiniProgramListener(miniProgram, 'exception', onException)
      await miniProgram.close()
    },
  }
}

function detachMiniProgramListener<TEvent extends keyof MiniProgramEventMap>(
  miniProgram: MiniProgramLike,
  event: TEvent,
  listener: MiniProgramEventMap[TEvent],
) {
  if (typeof miniProgram.off === 'function') {
    miniProgram.off(event, listener)
  }
}

function printForwardConsoleEvent(event: ForwardConsoleEvent) {
  const prefix = colors.dim(`[mini:${event.level}]`)
  const line = `${prefix} ${event.message}`

  switch (event.level) {
    case 'error':
      logger.error(line)
      return
    case 'warn':
      logger.warn(line)
      return
    case 'info':
      logger.info(line)
      return
    default:
      logger.log(line)
  }
}

function normalizeConsoleEvent(payload: unknown): ForwardConsoleEvent {
  const record = toPlainObject(payload)
  return {
    level: normalizeLogLevel(record.type ?? record.level ?? record.method),
    message: resolveLogMessage(record, payload),
    raw: payload,
  }
}

function normalizeExceptionEvent(payload: unknown): ForwardConsoleEvent {
  const record = toPlainObject(payload)
  const error = toPlainObject(record.error)
  const message = [
    getStringValue(error.message) ?? getStringValue(record.message),
    getStringValue(error.stack) ?? getStringValue(record.stack),
  ].filter(Boolean).join('\n')

  return {
    level: 'error',
    message: message || inspect(payload, { depth: 4, colors: false, compact: true }),
    raw: payload,
  }
}

function normalizeLogLevel(value: unknown): ForwardConsoleLogLevel {
  const normalized = String(value ?? 'log').toLowerCase()
  if (normalized === 'warning') {
    return 'warn'
  }
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized
  }
  return 'log'
}

function resolveLogMessage(record: Record<string, unknown>, payload: unknown) {
  const text = getStringValue(record.text) ?? getStringValue(record.message)
  if (text) {
    return text
  }

  if (Array.isArray(record.args) && record.args.length > 0) {
    return record.args.map(formatConsoleArgument).join(' ')
  }

  if (typeof payload === 'string') {
    return payload
  }

  return inspect(payload, { depth: 4, colors: false, compact: true })
}

function formatConsoleArgument(value: unknown): string {
  const record = toPlainObject(value)
  const rawValue = record.value
  const description = getStringValue(record.description)

  if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return String(rawValue)
  }

  if (rawValue !== undefined) {
    return inspect(rawValue, { depth: 4, colors: false, compact: true })
  }

  if (description) {
    return description
  }

  if (typeof value === 'string') {
    return value
  }

  return inspect(value, { depth: 4, colors: false, compact: true })
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}
