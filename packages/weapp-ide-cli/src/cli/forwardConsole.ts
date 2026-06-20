import type { AutomatorSessionOptions, MiniProgramEventMap, MiniProgramLike } from './automator-session'
import { inspect } from 'node:util'
import logger, { colors } from '../logger'
import { acquireSharedMiniProgram, connectMiniProgram, releaseSharedMiniProgram } from './automator-session'

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
const ENABLE_LOG_REFRESH_INTERVAL_MS = 2000
const AUXILIARY_FORWARD_CONSOLE_DELAY_MS = 2500
const DUPLICATE_LOG_SUPPRESS_MS = 800

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

async function refreshOpenedMiniProgramConsoleLog(options: ForwardConsoleOptions) {
  const miniProgram = await connectMiniProgram({
    ...options,
    openedOnly: true,
  })
  try {
    await enableMiniProgramConsoleLog(miniProgram)
  }
  finally {
    miniProgram.disconnect()
  }
}

function startEnableLogRefresh(miniProgram: MiniProgramLike, options: ForwardConsoleOptions) {
  if (typeof miniProgram.enableLog !== 'function') {
    return undefined
  }

  const timer = setInterval(() => {
    void miniProgram.enableLog().catch(() => {})
    void refreshOpenedMiniProgramConsoleLog(options).catch(() => {})
  }, ENABLE_LOG_REFRESH_INTERVAL_MS)

  return () => {
    clearInterval(timer)
  }
}

/**
 * @description 启动小程序控制台日志转发，并保持 automator 会话常驻。
 */
export async function startForwardConsole(options: ForwardConsoleOptions): Promise<ForwardConsoleSession> {
  const miniProgram = await acquireSharedMiniProgram(options)
  const logLevels = new Set(options.logLevels?.length ? options.logLevels : DEFAULT_FORWARD_CONSOLE_LEVELS)
  const logHandler = options.onLog ?? printForwardConsoleEvent
  const recentLogTimes = new Map<string, number>()
  const emitLog = (event: ForwardConsoleEvent) => {
    const key = `${event.level}\0${event.message}`
    const now = Date.now()
    const lastEmittedAt = recentLogTimes.get(key) ?? 0
    if (now - lastEmittedAt < DUPLICATE_LOG_SUPPRESS_MS) {
      return
    }
    recentLogTimes.set(key, now)
    logHandler(event)
  }
  const onConsole: MiniProgramEventMap['console'] = (payload) => {
    const event = normalizeConsoleEvent(payload)
    if (!logLevels.has(event.level)) {
      return
    }
    emitLog(event)
  }
  const onException: MiniProgramEventMap['exception'] = (payload) => {
    if (options.unhandledErrors === false) {
      return
    }
    emitLog(normalizeExceptionEvent(payload))
  }
  let closed = false
  let stopEnableLogRefresh: (() => void) | undefined
  let auxiliaryMiniProgram: MiniProgramLike | undefined
  let auxiliaryTimer: ReturnType<typeof setTimeout> | undefined
  const closeSession = async () => {
    if (closed) {
      return
    }
    closed = true
    if (auxiliaryTimer) {
      clearTimeout(auxiliaryTimer)
      auxiliaryTimer = undefined
    }
    stopEnableLogRefresh?.()
    stopEnableLogRefresh = undefined
    detachMiniProgramListener(miniProgram, 'console', onConsole)
    detachMiniProgramListener(miniProgram, 'exception', onException)
    if (auxiliaryMiniProgram) {
      detachMiniProgramListener(auxiliaryMiniProgram, 'console', onConsole)
      detachMiniProgramListener(auxiliaryMiniProgram, 'exception', onException)
      auxiliaryMiniProgram.disconnect()
      auxiliaryMiniProgram = undefined
    }
    releaseSharedMiniProgram(options.projectPath, options.sessionId || options.port)
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
  stopEnableLogRefresh = startEnableLogRefresh(miniProgram, options)
  auxiliaryTimer = setTimeout(() => {
    void (async () => {
      const openedMiniProgram = await connectMiniProgram({
        ...options,
        openedOnly: true,
      })
      if (closed) {
        openedMiniProgram.disconnect()
        return
      }
      auxiliaryMiniProgram = openedMiniProgram
      await enableMiniProgramConsoleLog(openedMiniProgram)
      openedMiniProgram.on('console', onConsole)
      openedMiniProgram.on('exception', onException)
    })().catch(() => {})
  }, AUXILIARY_FORWARD_CONSOLE_DELAY_MS)
  options.onReady?.()

  return {
    close: closeSession,
  }
}
