import fs from 'node:fs'
import process from 'node:process'
import cmpVersion from 'licia/cmpVersion'
import automator from 'miniprogram-automator'
import MiniProgram from 'miniprogram-automator/out/MiniProgram.js'

const MIN_SDK_VERSION = '2.7.3'
const DEFAULT_LIB_VERSION = '3.13.2'
const DEVTOOLS_HTTP_PORT_ERROR = 'Failed to launch wechat web devTools, please make sure http port is open'
const DEVTOOLS_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted 0\.0\.0\.0/i,
  /EACCES/i,
  /ECONNREFUSED/i,
  /connect ECONNREFUSED/i,
]
const DEVTOOLS_LOGIN_REQUIRED_PATTERNS = [
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]
const RUNTIME_LOG_META_KEY = '__weappViteRuntimeLogMeta'
const RUNTIME_LOG_FILE = process.env.WEAPP_VITE_E2E_RUNTIME_LOG_FILE || '/tmp/weapp-vite-e2e-runtime.log'
const DEFAULT_LOGIN_PREFLIGHT_TIMEOUT = 30_000

let versionPatched = false
let loginPreflightPassed = false

interface RuntimeLogStats {
  warn: number
  error: number
  exception: number
  total: number
}

interface RuntimeLogMeta {
  entries: RuntimeLogEntry[]
  stats: RuntimeLogStats
  dispose: () => void
  closeWrapped: boolean
}

type RuntimeLogLevel = 'warn' | 'error' | 'exception'

interface RuntimeLogEntry {
  level: RuntimeLogLevel
  text: string
}

function resolveConsolePayload(entry: any) {
  if (entry && typeof entry === 'object' && entry.entry && typeof entry.entry === 'object') {
    return entry.entry
  }
  if (entry && typeof entry === 'object' && entry.message && typeof entry.message === 'object') {
    return entry.message
  }
  if (entry && typeof entry === 'object' && entry.params && typeof entry.params === 'object') {
    return entry.params
  }
  return entry
}

function normalizeConsoleText(entry: any) {
  const payload = resolveConsolePayload(entry)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }
  if (Array.isArray(payload?.args) && payload.args.length > 0) {
    const text = payload.args
      .map((item: any) => {
        const raw = item && typeof item === 'object' && 'value' in item ? item.value : item
        if (typeof raw === 'string') {
          return raw
        }
        try {
          return JSON.stringify(raw)
        }
        catch {
          return String(raw)
        }
      })
      .join(' ')
      .trim()
    if (text) {
      return text
    }
  }
  try {
    return JSON.stringify(entry)
  }
  catch {
    return String(entry)
  }
}

function isErrorConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? payload?.type ?? '').toLowerCase()
  if (level === 'error' || level === 'fatal') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/.test(text)
}

function isWarnConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? payload?.type ?? '').toLowerCase()
  if (level === 'warn' || level === 'warning') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:warn(?:ing)?|deprecated|deprecation)\b/i.test(text)
    || /\[Component\]/.test(text)
}

function ensureRuntimeLogMeta(miniProgram: any): RuntimeLogMeta {
  const existing = (miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] as RuntimeLogMeta | undefined
  if (existing) {
    return existing
  }

  const entries: RuntimeLogEntry[] = []
  const stats: RuntimeLogStats = {
    warn: 0,
    error: 0,
    exception: 0,
    total: 0,
  }

  const onConsole = (entry: any) => {
    const text = normalizeConsoleText(entry)
    if (!text) {
      return
    }
    if (isErrorConsoleEntry(entry)) {
      stats.error += 1
      stats.total += 1
      entries.push({ level: 'error', text })
      return
    }
    if (isWarnConsoleEntry(entry)) {
      stats.warn += 1
      stats.total += 1
      entries.push({ level: 'warn', text })
    }
  }

  const onException = (entry: any) => {
    const text = typeof entry?.exceptionDetails?.text === 'string'
      ? entry.exceptionDetails.text
      : normalizeConsoleText(entry)
    stats.exception += 1
    stats.total += 1
    entries.push({ level: 'exception', text })
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)

  const meta: RuntimeLogMeta = {
    entries,
    stats,
    dispose() {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
    },
    closeWrapped: false,
  }

  ;(miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] = meta
  return meta
}

function appendRuntimeLog(line: string) {
  try {
    fs.appendFileSync(RUNTIME_LOG_FILE, `${line}\n`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[e2e-log-write-error] runtime-log file=${RUNTIME_LOG_FILE} error=${message}\n`)
  }
}

function isLikelyDevtoolsInfraErrorMessage(message: string) {
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
    || DEVTOOLS_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function extractExecutionErrorText(error: unknown) {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const parts: string[] = []
  const candidate = error as {
    message?: unknown
    shortMessage?: unknown
    stderr?: unknown
    stdout?: unknown
  }

  for (const field of [candidate.message, candidate.shortMessage, candidate.stderr, candidate.stdout]) {
    if (typeof field === 'string' && field.trim()) {
      parts.push(field)
    }
  }

  return parts.join('\n')
}

function extractLoginRequiredMessage(text: string) {
  if (!text) {
    return ''
  }
  if (/需要重新登录/.test(text)) {
    return '需要重新登录'
  }

  const englishMatch = text.match(/need\s+re-?login|re-?login/i)
  if (englishMatch?.[0]) {
    return englishMatch[0].toLowerCase()
  }

  const firstLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => Boolean(line) && !line.startsWith('at '))

  if (!firstLine) {
    return ''
  }

  return firstLine
    .replace(/^\[error\]\s*/i, '')
    .replace(/^error\s*:\s*/i, '')
    .slice(0, 120)
}

export function isDevtoolsLoginRequiredError(error: unknown) {
  const text = extractExecutionErrorText(error)
  if (!text) {
    return false
  }
  return DEVTOOLS_LOGIN_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

export function formatDevtoolsLoginRequiredError(error: unknown) {
  const text = extractExecutionErrorText(error)
  const code = text.match(/code\s*[:=]\s*(\d+)/i)?.[1]
  const message = extractLoginRequiredMessage(text)

  const lines = ['微信开发者工具返回登录错误：']
  if (code) {
    lines.push(`- code: ${code}`)
  }
  if (message) {
    lines.push(`- message: ${message}`)
  }
  if (!code && !message) {
    lines.push('- message: 需要重新登录')
  }

  return lines.join('\n')
}

function createDevtoolsLoginRequiredError(error: unknown) {
  const details = formatDevtoolsLoginRequiredError(error)
  const next = new Error(
    `检测到微信开发者工具登录状态失效，请先登录后再执行 e2e。\n${details}`,
    { cause: error as Error },
  ) as Error & { code: number, exitCode: number }
  next.name = 'WechatIdeLoginRequiredError'
  next.code = 10
  next.exitCode = 10
  return next
}

function logRuntimeStats(meta: RuntimeLogMeta) {
  const summary = `[e2e-runtime-stats] warn=${meta.stats.warn} error=${meta.stats.error} exception=${meta.stats.exception} total=${meta.stats.total}`
  appendRuntimeLog(summary)
  if (meta.stats.total > 0) {
    process.stderr.write(`${summary}\n`)
    for (const entry of meta.entries) {
      if (entry.level === 'warn') {
        const logLine = `[warn] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        appendRuntimeLog(logLine)
        continue
      }
      if (entry.level === 'error') {
        const logLine = `[error] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        appendRuntimeLog(logLine)
        continue
      }
      const logLine = `[error] [runtime:exception] ${entry.text}`
      process.stderr.write(`${logLine}\n`)
      appendRuntimeLog(logLine)
    }
    return
  }
  process.stdout.write(`${summary}\n`)
}

function enhanceMiniProgramWithRuntimeLogs(miniProgram: any) {
  const meta = ensureRuntimeLogMeta(miniProgram)
  if (meta.closeWrapped) {
    return miniProgram
  }
  meta.closeWrapped = true

  const rawClose = miniProgram.close.bind(miniProgram)
  miniProgram.close = async (...args: any[]) => {
    try {
      return await rawClose(...args)
    }
    finally {
      meta.dispose()
      logRuntimeStats(meta)
    }
  }

  return miniProgram
}

function patchAutomatorVersionCheck() {
  if (versionPatched) {
    return
  }
  versionPatched = true
  MiniProgram.prototype.checkVersion = async function checkVersionPatched(this: {
    send: (method: string) => Promise<{ SDKVersion?: string }>
  }) {
    const info = await this.send('Tool.getInfo')
    const sdkVersion = info?.SDKVersion
    if (!sdkVersion || sdkVersion === 'dev') {
      return
    }
    if (cmpVersion(sdkVersion, MIN_SDK_VERSION) < 0) {
      throw new Error(
        `SDKVersion is currently ${sdkVersion}, while automator requires at least version ${MIN_SDK_VERSION}`,
      )
    }
  }
}

export function launchAutomator(options: Parameters<typeof automator.launch>[0]) {
  patchAutomatorVersionCheck()
  const { projectConfig, timeout, ...rest } = options
  return automator.launch({
    ...rest,
    timeout: timeout ?? 90_000,
    projectConfig: {
      libVersion: DEFAULT_LIB_VERSION,
      ...projectConfig,
    },
  })
    .then(miniProgram => enhanceMiniProgramWithRuntimeLogs(miniProgram))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      const isInfraError = isLikelyDevtoolsInfraErrorMessage(message)
      const isLoginRequiredError = isDevtoolsLoginRequiredError(error)
      const summary = isInfraError
        ? '[e2e-runtime-stats] warn=0 error=0 exception=0 total=0'
        : '[e2e-runtime-stats] warn=0 error=1 exception=0 total=1'
      const logLine = isInfraError
        ? `[runtime:launch-infra] ${message}`
        : isLoginRequiredError
          ? `[error] [runtime:launch-login] ${formatDevtoolsLoginRequiredError(error)}`
          : `[error] [runtime:launch] ${message}`
      if (isInfraError) {
        process.stdout.write(`${summary}\n`)
        process.stdout.write(`${logLine}\n`)
      }
      else {
        process.stderr.write(`${summary}\n`)
        process.stderr.write(`${logLine}\n`)
      }
      appendRuntimeLog(summary)
      appendRuntimeLog(logLine)
      if (isLoginRequiredError) {
        throw createDevtoolsLoginRequiredError(error)
      }
      throw error
    })
}

export async function assertDevtoolsLoggedIn(projectPath: string) {
  if (loginPreflightPassed) {
    return
  }

  let miniProgram: any = null
  try {
    miniProgram = await launchAutomator({
      projectPath,
      timeout: DEFAULT_LOGIN_PREFLIGHT_TIMEOUT,
    })
    loginPreflightPassed = true
  }
  catch (error) {
    if (isDevtoolsLoginRequiredError(error)) {
      throw createDevtoolsLoginRequiredError(error)
    }
    throw error
  }
  finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}

export function isDevtoolsHttpPortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isLikelyDevtoolsInfraErrorMessage(message)
}
