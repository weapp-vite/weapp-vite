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
const ENABLE_LOG_RETRY_DELAY_MS = 500
const ENABLE_LOG_RETRY_TIMES = 5

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
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

function detachMiniProgramListener<TEvent extends keyof MiniProgramEventMap>(
  miniProgram: MiniProgramLike,
  event: TEvent,
  listener: MiniProgramEventMap[TEvent],
) {
  if (typeof miniProgram.off === 'function') {
    miniProgram.off(event, listener)
  }
}

function formatForwardConsolePrefix(level: ForwardConsoleLogLevel) {
  const label = `[mini:${level.padEnd(5)}]`
  if (level === 'error') {
    return colors.bold(colors.red(label))
  }
  if (level === 'warn') {
    return colors.bold(colors.yellow(label))
  }
  if (level === 'info') {
    return colors.bold(colors.cyan(label))
  }
  if (level === 'debug') {
    return colors.dim(label)
  }
  return colors.bold(colors.green(label))
}

function formatForwardConsoleMessage(event: ForwardConsoleEvent) {
  if (event.level === 'debug') {
    return colors.dim(event.message)
  }
  if (event.level === 'error') {
    return colors.red(event.message)
  }
  if (event.level === 'warn') {
    return colors.yellow(event.message)
  }
  return event.message
}

function printForwardConsoleEvent(event: ForwardConsoleEvent) {
  const prefix = formatForwardConsolePrefix(event.level)
  const line = `${prefix} ${formatForwardConsoleMessage(event)}`

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function enableMiniProgramConsoleLog(miniProgram: MiniProgramLike) {
  if (typeof miniProgram.enableLog !== 'function') {
    return
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= ENABLE_LOG_RETRY_TIMES; attempt += 1) {
    try {
      await miniProgram.enableLog()
      return
    }
    catch (error) {
      lastError = error
      if (attempt < ENABLE_LOG_RETRY_TIMES) {
        await sleep(ENABLE_LOG_RETRY_DELAY_MS)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

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
  let closed = false
  const closeSession = async () => {
    if (closed) {
      return
    }
    closed = true
    detachMiniProgramListener(miniProgram, 'console', onConsole)
    detachMiniProgramListener(miniProgram, 'exception', onException)
    await miniProgram.close()
  }

  try {
    await enableMiniProgramConsoleLog(miniProgram)
  }
  catch (error) {
    await closeSession()
    throw error
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)
  options.onReady?.()

  return {
    close: closeSession,
  }
}
