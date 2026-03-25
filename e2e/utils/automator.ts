import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import cmpVersion from 'licia/cmpVersion'
import automator from 'miniprogram-automator'
import MiniProgram from 'miniprogram-automator/out/MiniProgram.js'
import { launchHeadlessAutomator } from './automator.headless'
import {
  appendIdeReportEvent,
  resolveReportProjectPath,
} from './ideWarningReport'
import {
  assertRuntimeProviderImplemented,
  resolveRuntimeProviderName,
} from './runtimeProvider'

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
const DEVTOOLS_CONNECTION_CLOSED_PATTERNS = [
  /Connection closed, check if wechat web devTools is still running/i,
  /WebSocket is not open/i,
  /socket hang up/i,
]
const DEVTOOLS_LOGIN_REQUIRED_PATTERNS = [
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]
const RUNTIME_LOG_META_KEY = '__weappViteRuntimeLogMeta'
const RELAUNCH_PATCH_META_KEY = '__weappViteRelaunchPatchMeta'
const DEFAULT_LOGIN_PREFLIGHT_TIMEOUT = 30_000
const DEFAULT_RELUNCH_READY_TIMEOUT = 15_000
const DEFAULT_RELUNCH_RETRIES = 3
const DEFAULT_RELUNCH_RETRY_DELAY = 280
const DEFAULT_RELUNCH_SETTLE_DELAY = 260
const DEFAULT_LAUNCH_RETRIES = 3
const DEFAULT_LAUNCH_RETRY_DELAY = 1_200
const DEFAULT_LAUNCH_ATTEMPT_TIMEOUT = 24_000
const DEFAULT_APP_CONFIG_READY_TIMEOUT = 12_000
const DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS = [
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /subPackages[\s\S]{0,80}undefined/i,
]
const RELAUNCH_READY_TIMEOUT = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_RELUNCH_READY_TIMEOUT,
  DEFAULT_RELUNCH_READY_TIMEOUT,
)
const RELAUNCH_RETRIES = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_RELUNCH_RETRIES,
  DEFAULT_RELUNCH_RETRIES,
)
const RELAUNCH_RETRY_DELAY = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_RELUNCH_RETRY_DELAY,
  DEFAULT_RELUNCH_RETRY_DELAY,
)
const RELAUNCH_SETTLE_DELAY = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_RELUNCH_SETTLE_DELAY,
  DEFAULT_RELUNCH_SETTLE_DELAY,
)
const LAUNCH_RETRIES = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_LAUNCH_RETRIES,
  DEFAULT_LAUNCH_RETRIES,
)
const LAUNCH_RETRY_DELAY = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_LAUNCH_RETRY_DELAY,
  DEFAULT_LAUNCH_RETRY_DELAY,
)
const LAUNCH_ATTEMPT_TIMEOUT = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_LAUNCH_ATTEMPT_TIMEOUT,
  DEFAULT_LAUNCH_ATTEMPT_TIMEOUT,
)
const APP_CONFIG_READY_TIMEOUT = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_APP_CONFIG_READY_TIMEOUT,
  DEFAULT_APP_CONFIG_READY_TIMEOUT,
)
const TRUST_ALL_PROJECTS = process.env.WEAPP_VITE_E2E_TRUST_PROJECT === '1'
const TRUST_PROJECT_PREFIXES = (process.env.WEAPP_VITE_E2E_TRUST_PROJECTS || '')
  .split(/[,;\n]/)
  .map(item => item.trim())
  .filter(Boolean)
  .map(item => normalizePathForMatch(item))

let versionPatched = false
let miniProgramOnPatched = false
let loginPreflightPassed = false
let localhostListenPatched = false

interface RuntimeLogStats {
  warn: number
  error: number
  exception: number
  total: number
}

interface RuntimeLogMeta {
  project: string
  entries: RuntimeLogEntry[]
  stats: RuntimeLogStats
  dispose: () => void
  closeWrapped: boolean
}

interface RelaunchPatchMeta {
  wrapped: boolean
}

type RuntimeLogLevel = 'warn' | 'error' | 'exception'

interface RuntimeLogEntry {
  level: RuntimeLogLevel
  text: string
}

interface LaunchProjectMeta {
  appConfigPath: string
  warmupRoute?: string
}

function normalizePathForMatch(value: string) {
  const normalized = path.normalize(path.resolve(value))
  return normalized.replace(/[\\/]+$/, '')
}

function patchNetListenToLoopback() {
  if (localhostListenPatched) {
    return
  }
  localhostListenPatched = true

  const rawListen = net.Server.prototype.listen
  net.Server.prototype.listen = function patchedListen(this: net.Server, ...args: any[]) {
    const firstArg = args[0]
    if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg)) {
      if (!('host' in firstArg) || !firstArg.host) {
        args[0] = {
          ...firstArg,
          host: '127.0.0.1',
        }
      }
      return rawListen.apply(this, args as any)
    }

    if ((typeof firstArg === 'number' || typeof firstArg === 'string') && typeof args[1] !== 'string') {
      args.splice(1, 0, '127.0.0.1')
    }

    return rawListen.apply(this, args as any)
  } as typeof net.Server.prototype.listen
}

function resolvePositiveIntEnv(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function isProjectPathTrustedByEnv(projectPath: string | undefined) {
  if (TRUST_ALL_PROJECTS) {
    return true
  }

  if (!projectPath || TRUST_PROJECT_PREFIXES.length === 0) {
    return false
  }

  const normalizedProjectPath = normalizePathForMatch(projectPath)
  return TRUST_PROJECT_PREFIXES.some((prefix) => {
    return normalizedProjectPath === prefix || normalizedProjectPath.startsWith(`${prefix}${path.sep}`)
  })
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

function ensureRuntimeLogMeta(miniProgram: any, project: string): RuntimeLogMeta {
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
    project,
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

function isLikelyDevtoolsInfraErrorMessage(message: string) {
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
    || DEVTOOLS_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function runWithTimeout<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
  label: string,
  onLateResolve?: (value: T) => Promise<void> | void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  let timedOut = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task
        .then(async (value) => {
          if (timedOut && onLateResolve) {
            await onLateResolve(value)
          }
        })
        .catch(() => {})
    }
  }
}

function isLikelyRelaunchRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Wait timed out after/i.test(message)
    || /timed out waiting page root/i.test(message)
    || /Failed to find page root/i.test(message)
    || /Execution context was destroyed/i.test(message)
    || /Target closed/i.test(message)
    || /ECONNRESET/i.test(message)
    || /not connected/i.test(message)
}

function isLikelySimulatorBootErrorMessage(message: string) {
  return DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function readJsonObject(filePath: string): Record<string, any> | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : undefined
  }
  catch {
    return undefined
  }
}

function resolveMiniprogramRoot(projectPath: string) {
  for (const fileName of ['project.config.json', 'project.private.config.json']) {
    const config = readJsonObject(path.join(projectPath, fileName))
    if (!config) {
      continue
    }
    const miniprogramRoot = config.miniprogramRoot
    if (typeof miniprogramRoot === 'string' && miniprogramRoot.trim()) {
      return miniprogramRoot.trim()
    }
  }
  return 'dist'
}

function resolveRouteFromAppConfig(config: Record<string, any>) {
  const pages = Array.isArray(config.pages) ? config.pages : []
  const firstPage = pages.find(item => typeof item === 'string' && item.trim())
  if (typeof firstPage === 'string') {
    return `/${firstPage.replace(/^\/+/, '')}`
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]
  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string' ? subPackage.root.replace(/^\/+|\/+$/g, '') : ''
    const packagePages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    const packagePage = packagePages.find(item => typeof item === 'string' && item.trim())
    if (typeof packagePage !== 'string') {
      continue
    }
    const segments = [root, packagePage].filter(Boolean)
    if (segments.length > 0) {
      return `/${segments.join('/').replace(/\/{2,}/g, '/')}`
    }
  }

  return undefined
}

async function resolveLaunchProjectMeta(projectPath: string | undefined): Promise<LaunchProjectMeta | undefined> {
  if (!projectPath) {
    return undefined
  }

  const appConfigPath = path.resolve(projectPath, resolveMiniprogramRoot(projectPath), 'app.json')
  const start = Date.now()
  while (Date.now() - start <= APP_CONFIG_READY_TIMEOUT) {
    const config = readJsonObject(appConfigPath)
    if (config) {
      return {
        appConfigPath,
        warmupRoute: resolveRouteFromAppConfig(config),
      }
    }
    await sleep(120)
  }

  const timeoutLine = `[warn] [runtime:launch-preflight] app.json not ready within ${APP_CONFIG_READY_TIMEOUT}ms: ${appConfigPath}`
  process.stdout.write(`${timeoutLine}\n`)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project: resolveReportProjectPath(projectPath),
    level: 'warn',
    channel: 'launch-preflight',
    text: `app.json not ready within ${APP_CONFIG_READY_TIMEOUT}ms: ${resolveReportProjectPath(appConfigPath)}`,
  })
  return { appConfigPath }
}

function isLikelyLaunchRetryableError(error: unknown) {
  if (isDevtoolsLoginRequiredError(error)) {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  return isLikelyDevtoolsInfraErrorMessage(message)
    || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
    || isLikelySimulatorBootErrorMessage(message)
    || isLikelyRelaunchRetryableError(error)
}

function handleLaunchError(error: unknown, project: string): never {
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
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'stats',
    project,
    warn: 0,
    error: isInfraError ? 0 : 1,
    exception: 0,
    total: isInfraError ? 0 : 1,
  })
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project,
    level: isInfraError ? 'warn' : 'error',
    channel: isInfraError
      ? 'launch-infra'
      : isLoginRequiredError
        ? 'launch-login'
        : 'launch',
    text: isInfraError
      ? message
      : isLoginRequiredError
        ? formatDevtoolsLoginRequiredError(error)
        : message,
  })
  if (isLoginRequiredError) {
    throw createDevtoolsLoginRequiredError(error)
  }
  throw error
}

async function waitForRelaunchPageRoot(page: any, timeoutMs = RELAUNCH_READY_TIMEOUT) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      if (typeof page?.$$ === 'function') {
        const roots = await page.$$('page')
        if (Array.isArray(roots) && roots.length > 0) {
          return roots[0]
        }
      }
      const root = await page?.$('page')
      if (root) {
        return root
      }
    }
    catch {
      // Ignore transient query errors during devtools route swaps.
    }

    if (typeof page?.waitFor === 'function') {
      await page.waitFor(120)
    }
    else {
      await sleep(120)
    }
  }
  return null
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
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'stats',
    project: meta.project,
    warn: meta.stats.warn,
    error: meta.stats.error,
    exception: meta.stats.exception,
    total: meta.stats.total,
  })
  if (meta.stats.total > 0) {
    process.stderr.write(`${summary}\n`)
    for (const entry of meta.entries) {
      if (entry.level === 'warn') {
        const logLine = `[warn] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        appendIdeReportEvent({
          source: 'runtime',
          kind: 'message',
          project: meta.project,
          level: 'warn',
          channel: 'runtime',
          text: entry.text,
        })
        continue
      }
      if (entry.level === 'error') {
        const logLine = `[error] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        appendIdeReportEvent({
          source: 'runtime',
          kind: 'message',
          project: meta.project,
          level: 'error',
          channel: 'runtime',
          text: entry.text,
        })
        continue
      }
      const logLine = `[error] [runtime:exception] ${entry.text}`
      process.stderr.write(`${logLine}\n`)
      appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        project: meta.project,
        level: 'exception',
        channel: 'exception',
        text: entry.text,
      })
    }
    return
  }
  process.stdout.write(`${summary}\n`)
}

function enhanceMiniProgramWithRuntimeLogs(miniProgram: any, project: string) {
  const meta = ensureRuntimeLogMeta(miniProgram, project)
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

function enhanceMiniProgramRelaunch(miniProgram: any) {
  const meta = (miniProgram as Record<string, any>)[RELAUNCH_PATCH_META_KEY] as RelaunchPatchMeta | undefined
  if (meta?.wrapped) {
    return miniProgram
  }

  ;(miniProgram as Record<string, any>)[RELAUNCH_PATCH_META_KEY] = { wrapped: true } as RelaunchPatchMeta
  const rawReLaunch = miniProgram.reLaunch.bind(miniProgram)
  miniProgram.reLaunch = async (...args: any[]) => {
    const route = typeof args[0] === 'string' ? args[0] : '<unknown-route>'
    let lastError: unknown = null

    for (let attempt = 1; attempt <= RELAUNCH_RETRIES; attempt += 1) {
      try {
        const page = await rawReLaunch(...args)
        if (!page) {
          throw new Error(`reLaunch returned empty page: ${route}`)
        }

        if (RELAUNCH_SETTLE_DELAY > 0) {
          if (typeof page.waitFor === 'function') {
            await page.waitFor(RELAUNCH_SETTLE_DELAY)
          }
          else {
            await sleep(RELAUNCH_SETTLE_DELAY)
          }
        }

        const pageRoot = await waitForRelaunchPageRoot(page)
        if (!pageRoot) {
          throw new Error(`Timed out waiting page root after reLaunch: ${route}`)
        }

        return page
      }
      catch (error) {
        lastError = error
        if (attempt >= RELAUNCH_RETRIES || !isLikelyRelaunchRetryableError(error)) {
          throw error
        }
        await sleep(RELAUNCH_RETRY_DELAY)
      }
    }

    throw lastError
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

function patchMiniProgramOn() {
  if (miniProgramOnPatched) {
    return
  }
  miniProgramOnPatched = true
  const rawOn = MiniProgram.prototype.on
  MiniProgram.prototype.on = function onPatched(this: InstanceType<typeof MiniProgram>, eventName: string, listener: (...args: any[]) => void) {
    if (eventName === 'console') {
      void this.send('App.enableLog').catch(() => {})
      this.addListener(eventName, listener)
      return this
    }
    return rawOn.call(this, eventName, listener)
  } as typeof MiniProgram.prototype.on
}

export function launchAutomator(options: Parameters<typeof automator.launch>[0]) {
  const provider = resolveRuntimeProviderName()
  if (provider === 'headless') {
    return launchHeadlessAutomator({
      projectPath: options.projectPath!,
    })
  }
  assertRuntimeProviderImplemented(provider)
  patchNetListenToLoopback()
  patchAutomatorVersionCheck()
  patchMiniProgramOn()
  const { projectConfig, timeout, trustProject, ...rest } = options
  const resolvedTrustProject = trustProject ?? isProjectPathTrustedByEnv(rest.projectPath)
  const project = resolveReportProjectPath(rest.projectPath)
  const launchTimeout = timeout ?? 90_000
  const launchAttemptTimeout = Math.max(LAUNCH_ATTEMPT_TIMEOUT, launchTimeout)
  return (async () => {
    for (let attempt = 1; attempt <= LAUNCH_RETRIES; attempt += 1) {
      let miniProgram: any = null
      try {
        return await runWithTimeout(
          async () => {
            const projectMeta = await resolveLaunchProjectMeta(rest.projectPath)
            miniProgram = await automator.launch({
              ...rest,
              timeout: launchTimeout,
              trustProject: resolvedTrustProject,
              projectConfig: {
                libVersion: DEFAULT_LIB_VERSION,
                ...projectConfig,
              },
            })

            const withRuntimeLogs = await enhanceMiniProgramWithRuntimeLogs(miniProgram, project)
            const withRelaunch = enhanceMiniProgramRelaunch(withRuntimeLogs)
            if (projectMeta?.warmupRoute) {
              await withRelaunch.reLaunch(projectMeta.warmupRoute)
            }
            return withRelaunch
          },
          launchAttemptTimeout,
          `launch automator#${attempt}`,
          async (lateMiniProgram) => {
            try {
              await lateMiniProgram?.close?.()
            }
            catch {
            }
          },
        )
      }
      catch (error) {
        if (miniProgram) {
          try {
            await miniProgram.close()
          }
          catch {
          }
        }

        if (attempt < LAUNCH_RETRIES && isLikelyLaunchRetryableError(error)) {
          const rawMessage = error instanceof Error ? error.message : String(error)
          const compactMessage = rawMessage.replace(/\s+/g, ' ').trim()
          const retryLine = `[warn] [runtime:launch-retry] attempt=${attempt}/${LAUNCH_RETRIES} delay=${LAUNCH_RETRY_DELAY}ms reason=${compactMessage.slice(0, 240)}`
          process.stdout.write(`${retryLine}\n`)
          appendIdeReportEvent({
            source: 'runtime',
            kind: 'message',
            project,
            level: 'warn',
            channel: 'launch-retry',
            text: `attempt=${attempt}/${LAUNCH_RETRIES} delay=${LAUNCH_RETRY_DELAY}ms reason=${compactMessage.slice(0, 240)}`,
          })
          await sleep(LAUNCH_RETRY_DELAY)
          continue
        }

        handleLaunchError(error, project)
      }
    }

    throw new Error('[runtime:launch] exhausted launch retries')
  })()
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
    || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
    || /Timeout in launch automator#/i.test(message)
}
