import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { Automator, MiniProgram } from '@weapp-vite/miniprogram-automator'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { runWechatIdeEngineBuildByHttp } from '../../packages/weapp-ide-cli/src/cli/engine'
import { resetWechatIdeFileUtilsByHttp } from '../../packages/weapp-ide-cli/src/cli/http'
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
const DEVTOOLS_CLI_EARLY_EXIT_PATTERNS = [
  /WeChat DevTools CLI exited before automator socket was ready/i,
  /ERR_INVALID_ARG_TYPE/i,
  /The ["']path["'] argument must be of type string/i,
]
const DEVTOOLS_ENGINE_BUILD_ENDPOINT_MISSING_PATTERNS = [
  /Cannot GET \/engine\/build\b/i,
  /Cannot GET \/engine\/buildResult\//i,
]
const DEVTOOLS_TOOL_COMPILE_UNSUPPORTED_PATTERNS = [
  /^unimplemented$/i,
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
const DEFAULT_RELUNCH_READY_TIMEOUT = 30_000
const DEFAULT_RELUNCH_RETRIES = 3
const DEFAULT_RELUNCH_RETRY_DELAY = 280
const DEFAULT_RELUNCH_SETTLE_DELAY = 260
const DEFAULT_LAUNCH_RETRIES = 3
const DEFAULT_LAUNCH_RETRY_DELAY = 1_200
const DEFAULT_LAUNCH_ATTEMPT_TIMEOUT = 24_000
const DEFAULT_APP_CONFIG_READY_TIMEOUT = 12_000
const DEFAULT_WECHAT_CLI_MACOS_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const DEFAULT_WECHAT_CLI_WINDOWS_PATH = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_CLI_BRIDGE_PATH = path.resolve(import.meta.dirname, './automator.cli-bridge.ts')
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS = [
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /subPackages[\s\S]{0,80}undefined/i,
]
const TRAILING_PATH_SEPARATOR_PATTERN = /[\\/]+$/
const ENV_LIST_SPLIT_PATTERN = /[,;\n]/
const ERROR_CONSOLE_TEXT_PATTERN = /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/
const WARN_CONSOLE_TEXT_PATTERN = /\b(?:warn(?:ing)?|deprecated|deprecation)\b/i
const COMPONENT_WARN_PATTERN = /\[Component\]/
const RELAUNCH_RETRYABLE_PATTERNS = [
  /Wait timed out after/i,
  /timed out waiting page root/i,
  /Failed to find page root/i,
  /Execution context was destroyed/i,
  /Target closed/i,
  /DevTools did not respond to protocol method App\.getCurrentPage within \d+ms/i,
  /\bDEVTOOLS_PROTOCOL_TIMEOUT\b/i,
  /ECONNRESET/i,
  /not connected/i,
]
const LEADING_SLASH_PATTERN = /^\/+/
const TRIM_ROUTE_SLASH_PATTERN = /^\/+|\/+$/g
const DUPLICATE_SLASH_PATTERN = /\/{2,}/g
const LOGIN_REQUIRED_TEXT_PATTERN = /需要重新登录/
const LOGIN_REQUIRED_ENGLISH_PATTERN = /need\s+re-?login|re-?login/i
const LINE_SPLIT_PATTERN = /\r?\n/
const ERROR_LOG_PREFIX_PATTERN = /^\[error\]\s*/i
const ERROR_PREFIX_PATTERN = /^error\s*:\s*/i
const LOGIN_REQUIRED_CODE_PATTERN = /code\s*[:=]\s*(\d+)/i
const BRIDGE_CONNECT_TIMEOUT_PATTERN = /Timeout in connect automator bridge/i
const BRIDGE_CONNECT_FAILURE_PATTERN = /Failed connecting to /
const COMPACT_WHITESPACE_PATTERN = /\s+/g
const LAUNCH_TIMEOUT_PATTERN = /Timeout in launch automator#/i
const DEVTOOLS_COMPILE_CACHE_CORRUPTION_PATTERNS = [
  /TypeError\s*\[ERR_INVALID_ARG_TYPE\]/i,
  /The ["']path["'] argument must be of type string\. Received undefined/i,
  /SummerCompiler\._getPackageFiles/i,
  /miniprogram-builder\/modules\/corecompiler\/summerCompiler/i,
] as const
const DEVTOOLS_CACHE_RECOVERY_STEPS = ['compile', 'all'] as const
const DEVTOOLS_ISLOGIN_JSON_PATTERN = /"login"\s*:\s*(true|false)/i

function normalizePathForMatch(value: string) {
  const normalized = path.normalize(path.resolve(value))
  return normalized.replace(TRAILING_PATH_SEPARATOR_PATTERN, '')
}

function resolvePositiveIntEnv(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function compareVersion(versionA: string, versionB: string) {
  const left = versionA.split('.')
  const right = versionB.split('.')
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const currentLeft = Number.parseInt(left[index] || '0', 10)
    const currentRight = Number.parseInt(right[index] || '0', 10)
    if (currentLeft > currentRight) {
      return 1
    }
    if (currentLeft < currentRight) {
      return -1
    }
  }

  return 0
}

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
  .split(ENV_LIST_SPLIT_PATTERN)
  .map(item => item.trim())
  .filter(Boolean)
  .map(item => normalizePathForMatch(item))

let versionPatched = false
let miniProgramOnPatched = false
let loginPreflightPassed = false
let localhostListenPatched = false
const completedDevtoolsCacheRecoverySteps = new Set<string>()
const automator = new Automator()

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

interface AutomatorCliBridgePayload {
  projectPath?: string
  cliPath?: string
  cwd?: string
  timeout?: number
  trustProject?: boolean
  args?: string[]
  projectConfig?: Record<string, any>
}

interface AutomatorCliBridgeResult {
  wsEndpoint: string
  cliPid?: number
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

function resolveAutomatorLaunchMode() {
  return process.env[AUTOMATOR_LAUNCH_MODE_ENV]?.trim().toLowerCase() || ''
}

function shouldSkipAutomatorWarmup() {
  return process.env[AUTOMATOR_SKIP_WARMUP_ENV] === '1'
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
  return ERROR_CONSOLE_TEXT_PATTERN.test(text)
}

function isWarnConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? payload?.type ?? '').toLowerCase()
  if (level === 'warn' || level === 'warning') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return WARN_CONSOLE_TEXT_PATTERN.test(text)
    || COMPONENT_WARN_PATTERN.test(text)
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

function isLikelyDevtoolsCompileCacheCorruptionMessage(message: string) {
  return DEVTOOLS_COMPILE_CACHE_CORRUPTION_PATTERNS.some(pattern => pattern.test(message))
}

function resolveWechatCliPath(cliPath?: string) {
  if (typeof cliPath === 'string' && cliPath.trim()) {
    return cliPath.trim()
  }
  if (process.platform === 'win32') {
    return DEFAULT_WECHAT_CLI_WINDOWS_PATH
  }
  return DEFAULT_WECHAT_CLI_MACOS_PATH
}

export function extractDevtoolsCliLoginState(output: string | undefined) {
  const normalized = typeof output === 'string' ? output : ''
  const match = normalized.match(DEVTOOLS_ISLOGIN_JSON_PATTERN)
  if (!match) {
    return null
  }
  return match[1]?.toLowerCase() === 'true'
}

async function resolveDevtoolsCliLoginState(cliPath?: string) {
  const resolvedCliPath = resolveWechatCliPath(cliPath)
  const result = await execa(resolvedCliPath, ['islogin'], {
    reject: false,
    timeout: DEFAULT_LOGIN_PREFLIGHT_TIMEOUT,
  })
  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : ''
  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : ''
  const loginState = extractDevtoolsCliLoginState(`${stdout}\n${stderr}`)

  if (loginState !== null) {
    return loginState
  }

  if ((result.exitCode ?? 1) !== 0) {
    throw new Error(stderr || stdout || `Failed to verify WeChat DevTools login: exit ${(result.exitCode ?? 1)}`)
  }

  return null
}

async function recoverDevtoolsCompileCache(options: {
  cliPath?: string
  cwd?: string
  error: unknown
  project: string
}) {
  const message = options.error instanceof Error ? options.error.message : String(options.error)
  if (!isLikelyDevtoolsCompileCacheCorruptionMessage(message)) {
    return false
  }

  const resolvedCliPath = resolveWechatCliPath(options.cliPath)
  for (const cleanType of DEVTOOLS_CACHE_RECOVERY_STEPS) {
    const recoveryKey = `${resolvedCliPath}::${cleanType}`
    if (completedDevtoolsCacheRecoverySteps.has(recoveryKey)) {
      continue
    }

    process.stdout.write(`[warn] [runtime:launch-recover] clean=${cleanType} project=${options.project}\n`)
    appendIdeReportEvent({
      source: 'runtime',
      kind: 'message',
      project: options.project,
      level: 'warn',
      channel: 'launch-recover',
      text: `clean=${cleanType}`,
    })

    const result = await execa(resolvedCliPath, ['cache', '--clean', cleanType], {
      cwd: options.cwd,
      reject: false,
      timeout: 20_000,
    })

    if ((result.exitCode ?? 1) === 0) {
      completedDevtoolsCacheRecoverySteps.add(recoveryKey)
      process.stdout.write(`[info] [runtime:launch-recover] cleaned=${cleanType} project=${options.project}\n`)
      appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        project: options.project,
        level: 'info',
        channel: 'launch-recover',
        text: `cleaned=${cleanType}`,
      })
      return true
    }

    const stderr = typeof result.stderr === 'string' ? result.stderr.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
    const stdout = typeof result.stdout === 'string' ? result.stdout.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
    const details = (stderr || stdout || `exit=${result.exitCode ?? 1}`).slice(0, 240)
    process.stdout.write(`[warn] [runtime:launch-recover] clean-failed=${cleanType} project=${options.project} reason=${details}\n`)
    appendIdeReportEvent({
      source: 'runtime',
      kind: 'message',
      project: options.project,
      level: 'warn',
      channel: 'launch-recover',
      text: `clean-failed=${cleanType} reason=${details}`,
    })
  }

  return false
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

export function isLikelyRelaunchRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return RELAUNCH_RETRYABLE_PATTERNS.some(pattern => pattern.test(message))
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
    return `/${firstPage.replace(LEADING_SLASH_PATTERN, '')}`
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]
  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string' ? subPackage.root.replace(TRIM_ROUTE_SLASH_PATTERN, '') : ''
    const packagePages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    const packagePage = packagePages.find(item => typeof item === 'string' && item.trim())
    if (typeof packagePage !== 'string') {
      continue
    }
    const segments = [root, packagePage].filter(Boolean)
    if (segments.length > 0) {
      return `/${segments.join('/').replace(DUPLICATE_SLASH_PATTERN, '/')}`
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
  if (LOGIN_REQUIRED_TEXT_PATTERN.test(text)) {
    return '需要重新登录'
  }

  const englishMatch = text.match(LOGIN_REQUIRED_ENGLISH_PATTERN)
  if (englishMatch?.[0]) {
    return englishMatch[0].toLowerCase()
  }

  const firstLine = text
    .split(LINE_SPLIT_PATTERN)
    .map(line => line.trim())
    .find(line => Boolean(line) && !line.startsWith('at '))

  if (!firstLine) {
    return ''
  }

  return firstLine
    .replace(ERROR_LOG_PREFIX_PATTERN, '')
    .replace(ERROR_PREFIX_PATTERN, '')
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
  const code = text.match(LOGIN_REQUIRED_CODE_PATTERN)?.[1]
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

function isLikelyLaunchRetryableError(error: unknown) {
  if (isDevtoolsLoginRequiredError(error)) {
    return false
  }

  const message = error instanceof Error ? error.message : String(error)
  return isLikelyDevtoolsInfraErrorMessage(message)
    || LAUNCH_TIMEOUT_PATTERN.test(message)
    || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
    || DEVTOOLS_CLI_EARLY_EXIT_PATTERNS.some(pattern => pattern.test(message))
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

    const normalizeRoute = (value: string) => {
      return value
        .split('?', 1)[0]
        .replace(LEADING_SLASH_PATTERN, '')
        .replace(TRIM_ROUTE_SLASH_PATTERN, '')
    }

    for (let attempt = 1; attempt <= RELAUNCH_RETRIES; attempt += 1) {
      let page: any = null
      try {
        page = await rawReLaunch(...args)
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
        try {
          const currentPage = await miniProgram.currentPage()
          if (normalizeRoute(currentPage?.path ?? '') === normalizeRoute(route)) {
            process.stdout.write(`[info] [runtime:relaunch-fallback] route=${route} attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
            return currentPage ?? page
          }
          process.stdout.write(`[info] [runtime:relaunch-current-page] route=${route} attempt=${attempt} current=${currentPage?.path ?? '<none>'}\n`)
        }
        catch {
          // currentPage 在 DevTools 路由切换瞬态可能继续超时，这里保持原重试路径。
        }
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

function isUnsupportedToolCompileError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return DEVTOOLS_TOOL_COMPILE_UNSUPPORTED_PATTERNS.some(pattern => pattern.test(error.message))
}

async function compileMiniProgramProject(miniProgram: any, project: string) {
  if (typeof miniProgram?.compile !== 'function') {
    return
  }

  process.stdout.write(`[info] [runtime:launch-step] compile-start project=${project}\n`)
  try {
    await runWithTimeout(
      () => miniProgram.compile({ force: true }),
      30_000,
      `compile project ${project}`,
    )
  }
  catch (error) {
    if (isUnsupportedToolCompileError(error)) {
      process.stdout.write(`[warn] [runtime:launch-step] compile-skip reason=tool-unimplemented project=${project}\n`)
      return
    }
    throw error
  }
  await sleep(1_200)
  process.stdout.write(`[info] [runtime:launch-step] compile-ready project=${project}\n`)
}

function isMissingEngineBuildEndpointError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return DEVTOOLS_ENGINE_BUILD_ENDPOINT_MISSING_PATTERNS.some(pattern => pattern.test(error.message))
}

async function refreshMiniProgramProjectIndex(projectPath: string | undefined, project: string) {
  if (!projectPath) {
    return
  }

  process.stdout.write(`[info] [runtime:launch-step] fileutils-reset-start project=${project}\n`)
  await runWithTimeout(
    () => resetWechatIdeFileUtilsByHttp(projectPath),
    10_000,
    `reset fileutils ${project}`,
  )
  process.stdout.write(`[info] [runtime:launch-step] fileutils-reset-ready project=${project}\n`)

  process.stdout.write(`[info] [runtime:launch-step] engine-build-start project=${project}\n`)
  try {
    await runWithTimeout(
      () => runWechatIdeEngineBuildByHttp(projectPath, {
        overallTimeoutMs: 60_000,
        pollIntervalMs: 1_000,
      }),
      70_000,
      `engine build ${project}`,
    )
  }
  catch (error) {
    if (isMissingEngineBuildEndpointError(error)) {
      process.stdout.write(`[warn] [runtime:launch-step] engine-build-skip reason=endpoint-missing project=${project}\n`)
      return
    }
    throw error
  }
  process.stdout.write(`[info] [runtime:launch-step] engine-build-ready project=${project}\n`)
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
    if (compareVersion(sdkVersion, MIN_SDK_VERSION) < 0) {
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

function isMissingProcessError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}

export async function terminateBridgeCliProcess(cliPid: number) {
  const signalTarget = process.platform === 'win32' ? cliPid : -cliPid

  try {
    process.kill(signalTarget, 'SIGTERM')
  }
  catch (error) {
    if (isMissingProcessError(error)) {
      return
    }
    throw error
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt <= 1_500) {
    try {
      process.kill(cliPid, 0)
      await sleep(120)
    }
    catch (error) {
      if (isMissingProcessError(error)) {
        return
      }
      throw error
    }
  }

  try {
    process.kill(signalTarget, 'SIGKILL')
  }
  catch (error) {
    if (!isMissingProcessError(error)) {
      throw error
    }
  }
}

function enhanceMiniProgramWithBridgeCliCleanup(miniProgram: any, cliPid: number) {
  const metaKey = '__weappViteBridgeCliCleanupWrapped'
  if ((miniProgram as Record<string, any>)[metaKey]) {
    return miniProgram
  }

  ;(miniProgram as Record<string, any>)[metaKey] = true
  const rawClose = miniProgram.close.bind(miniProgram)
  miniProgram.close = async (...args: any[]) => {
    try {
      return await rawClose(...args)
    }
    finally {
      await terminateBridgeCliProcess(cliPid).catch(() => {})
    }
  }
  return miniProgram
}

async function launchAutomatorViaCliBridge(options: AutomatorCliBridgePayload, project: string) {
  process.stdout.write(`[info] [runtime:launch-bridge-step] bootstrap-start project=${project}\n`)
  const result = await execa('node', ['--import', 'tsx', AUTOMATOR_CLI_BRIDGE_PATH, JSON.stringify(options)], {
    cwd: options.cwd,
    reject: false,
    timeout: options.timeout,
    env: {
      ...process.env,
      [AUTOMATOR_LAUNCH_MODE_ENV]: '',
    },
  })
  process.stdout.write(`[info] [runtime:launch-bridge-step] bootstrap-exit code=${result.exitCode ?? 1} project=${project}\n`)

  if ((result.exitCode ?? 1) !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : ''
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : ''
    const details = stderr || stdout || `bridge exit code ${(result.exitCode ?? 1)}`
    throw new Error(`Failed to bootstrap automator cli bridge: ${details}`)
  }

  const rawStdout = typeof result.stdout === 'string' ? result.stdout.trim() : ''
  if (!rawStdout) {
    throw new Error('Failed to bootstrap automator cli bridge: empty stdout')
  }

  let bridgeResult: AutomatorCliBridgeResult
  try {
    bridgeResult = JSON.parse(rawStdout) as AutomatorCliBridgeResult
  }
  catch (error) {
    throw new Error(`Failed to parse automator cli bridge output: ${rawStdout}`, {
      cause: error as Error,
    })
  }

  if (!bridgeResult.wsEndpoint || typeof bridgeResult.wsEndpoint !== 'string') {
    throw new Error(`Invalid automator cli bridge output: ${rawStdout}`)
  }
  process.stdout.write(`[info] [runtime:launch-bridge-step] bootstrap-ready endpoint=${bridgeResult.wsEndpoint} project=${project}\n`)

  const connectStartedAt = Date.now()
  let lastConnectError: unknown
  let miniProgram: any = null
  while (Date.now() - connectStartedAt <= Math.max(12_000, options.timeout ?? 30_000)) {
    try {
      process.stdout.write(`[info] [runtime:launch-bridge-step] connect-attempt endpoint=${bridgeResult.wsEndpoint} project=${project}\n`)
      miniProgram = await runWithTimeout(
        () => (automator as typeof automator & {
          connect: (options: { wsEndpoint: string }) => Promise<any>
        }).connect({
          wsEndpoint: bridgeResult.wsEndpoint,
        }),
        4_000,
        `connect automator bridge ${bridgeResult.wsEndpoint}`,
        async (lateMiniProgram) => {
          try {
            await lateMiniProgram?.close?.()
          }
          catch {
          }
        },
      )
      process.stdout.write(`[info] [runtime:launch-bridge-step] connect-ok endpoint=${bridgeResult.wsEndpoint} project=${project}\n`)
      break
    }
    catch (error) {
      lastConnectError = error
      const message = error instanceof Error ? error.message : String(error)
      if (!DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
        && !BRIDGE_CONNECT_TIMEOUT_PATTERN.test(message)
        && !BRIDGE_CONNECT_FAILURE_PATTERN.test(message)) {
        throw error
      }
      await sleep(400)
    }
  }

  if (!miniProgram) {
    throw new Error(`Failed to connect automator cli bridge: ${bridgeResult.wsEndpoint}`, {
      cause: lastConnectError as Error,
    })
  }

  process.stdout.write(`[info] [runtime:launch-bridge] connected=${bridgeResult.wsEndpoint} project=${project}\n`)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project,
    level: 'info',
    channel: 'launch-bridge',
    text: `connected=${bridgeResult.wsEndpoint}`,
  })
  if (typeof bridgeResult.cliPid === 'number' && bridgeResult.cliPid > 0) {
    enhanceMiniProgramWithBridgeCliCleanup(miniProgram, bridgeResult.cliPid)
  }
  return miniProgram
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
  const { projectConfig, timeout, trustProject, ...rest } = options
  const resolvedTrustProject = trustProject ?? isProjectPathTrustedByEnv(rest.projectPath)
  const project = resolveReportProjectPath(rest.projectPath)
  const launchTimeout = timeout ?? 90_000
  const launchAttemptTimeout = Math.max(LAUNCH_ATTEMPT_TIMEOUT, launchTimeout)
  const launchMode = resolveAutomatorLaunchMode()
  if (launchMode !== AUTOMATOR_LAUNCH_MODE_BRIDGE) {
    patchMiniProgramOn()
  }
  return (async () => {
    for (let attempt = 1; attempt <= LAUNCH_RETRIES; attempt += 1) {
      let miniProgram: any = null
      try {
        return await runWithTimeout(
          async () => {
            process.stdout.write(`[info] [runtime:launch-step] preflight project=${project}\n`)
            const projectMeta = await resolveLaunchProjectMeta(rest.projectPath)
            process.stdout.write(`[info] [runtime:launch-step] preflight-ready project=${project} warmup=${projectMeta?.warmupRoute ?? '<none>'}\n`)
            const launchOptions = {
              ...rest,
              timeout: launchTimeout,
              trustProject: resolvedTrustProject,
              projectConfig: {
                libVersion: DEFAULT_LIB_VERSION,
                ...projectConfig,
              },
            }
            process.stdout.write(`[info] [runtime:launch-step] connect-start mode=${launchMode || 'direct'} project=${project}\n`)
            miniProgram = launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE
              ? await launchAutomatorViaCliBridge(launchOptions, project)
              : await automator.launch(launchOptions)
            process.stdout.write(`[info] [runtime:launch-step] connect-ready mode=${launchMode || 'direct'} project=${project}\n`)
            if (launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE) {
              patchMiniProgramOn()
            }

            const withRuntimeLogs = await enhanceMiniProgramWithRuntimeLogs(miniProgram, project)
            const withRelaunch = enhanceMiniProgramRelaunch(withRuntimeLogs)
            await refreshMiniProgramProjectIndex(rest.projectPath, project)
            await compileMiniProgramProject(withRelaunch, project)
            if (projectMeta?.warmupRoute && !shouldSkipAutomatorWarmup()) {
              process.stdout.write(`[info] [runtime:launch-step] warmup-start route=${projectMeta.warmupRoute} project=${project}\n`)
              await withRelaunch.reLaunch(projectMeta.warmupRoute)
              process.stdout.write(`[info] [runtime:launch-step] warmup-ready route=${projectMeta.warmupRoute} project=${project}\n`)
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

        if (attempt < LAUNCH_RETRIES) {
          const recovered = await recoverDevtoolsCompileCache({
            cliPath: rest.cliPath,
            cwd: rest.cwd,
            error,
            project,
          })
          if (recovered) {
            await sleep(LAUNCH_RETRY_DELAY)
            continue
          }
        }

        if (attempt < LAUNCH_RETRIES && isLikelyLaunchRetryableError(error)) {
          const rawMessage = error instanceof Error ? error.message : String(error)
          const compactMessage = rawMessage.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim()
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
  let closeError: unknown = null
  try {
    if (resolveAutomatorLaunchMode() === AUTOMATOR_LAUNCH_MODE_BRIDGE) {
      const loginState = await resolveDevtoolsCliLoginState()
      if (loginState === false) {
        throw createDevtoolsLoginRequiredError('需要重新登录')
      }
    }
    else {
      miniProgram = await launchAutomator({
        projectPath,
        timeout: DEFAULT_LOGIN_PREFLIGHT_TIMEOUT,
      })
    }
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
      try {
        await miniProgram.close()
      }
      catch (error) {
        if (!DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(error instanceof Error ? error.message : String(error)))) {
          closeError = error
        }
      }
    }
  }
  if (closeError) {
    throw closeError
  }
}

export function isDevtoolsHttpPortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return isLikelyDevtoolsInfraErrorMessage(message)
    || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
    || LAUNCH_TIMEOUT_PATTERN.test(message)
}
