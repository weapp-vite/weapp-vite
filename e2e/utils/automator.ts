import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { Automator, MiniProgram } from '@weapp-vite/miniprogram-automator'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { runWechatIdeEngineBuildByHttp } from '../../packages/weapp-ide-cli/src/cli/engine'
import { openWechatIdeProjectByHttp, resetWechatIdeFileUtilsByHttp } from '../../packages/weapp-ide-cli/src/cli/http'
import { setRuntimeWechatDevtoolsServicePort } from '../../packages/weapp-ide-cli/src/cli/wechatDevtoolsRuntimePort'
import { extractWechatDevtoolsServicePort } from './automator.cli-bridge'
import { launchHeadlessAutomator } from './automator.headless'
import { cleanupResidualDevtoolsProcesses } from './ide-devtools-cleanup'
import { captureDevtoolsLogBaseline, scanRecentDevtoolsSimulatorBootIssues } from './ide-devtools-logs'
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
  /#initialize-error:\s*wait IDE port timeout/i,
  /IDE may already started at port/i,
  /wait IDE port timeout/i,
  /listen EPERM/i,
  /operation not permitted 0\.0\.0\.0/i,
  /EACCES/i,
  /ECONNREFUSED/i,
  /connect ECONNREFUSED/i,
]
const DEVTOOLS_CONNECTION_CLOSED_PATTERNS = [
  /Connection closed, check if wechat web devTools is still running/i,
  /WebSocket is not open/i,
  /fetch failed/i,
  /other side closed/i,
  /socket hang up/i,
  /UND_ERR_SOCKET/i,
]
const DEVTOOLS_CLI_EARLY_EXIT_PATTERNS = [
  /Failed to launch wechat web devTools, please make sure cliPath is correctly specified/i,
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
const DEVTOOLS_TOOL_COMPILE_TIMEOUT_PATTERNS = [
  /Timeout in compile project/i,
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
const DEFAULT_RELUNCH_SETTLE_DELAY = 260
const QUICK_CURRENT_ROUTE_READY_TIMEOUT = 300
const DEFAULT_LAUNCH_RETRIES = 5
const DEFAULT_LAUNCH_RETRY_DELAY = 1_200
const DEFAULT_LAUNCH_ATTEMPT_TIMEOUT = 24_000
const DEFAULT_APP_CONFIG_READY_TIMEOUT = 12_000
const DEFAULT_TOOL_COMPILE_TIMEOUT = 30_000
const DEFAULT_PAGE_ROOT_QUERY_TIMEOUT = 1_000
const ROUTE_READY_PAGE_ROOT_PROBE_TIMEOUT = 1_500
const DEFAULT_BRIDGE_CONNECT_SETTLE_DELAY = 5_000
const DEFAULT_BRIDGE_WARMUP_READY_TIMEOUT = DEFAULT_RELUNCH_READY_TIMEOUT
const DEVTOOLS_LOG_SCAN_INTERVAL = 500
const DEFAULT_WECHAT_CLI_MACOS_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const DEFAULT_WECHAT_CLI_WINDOWS_PATH = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_PREBUILD_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_PREBUILD'
const AUTOMATOR_BRIDGE_PREBUILD_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_PREBUILD'
const AUTOMATOR_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH'
const AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY'
const AUTOMATOR_BRIDGE_WRAPPER_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_WRAPPER'
const AUTOMATOR_CLI_BRIDGE_PATH = path.resolve(import.meta.dirname, './automator.cli-bridge.ts')
const AUTOMATOR_BRIDGE_WRAPPER_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-ide-bridge-projects')
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS = [
  /simulator not found/i,
  /模拟器启动失败/,
  /WeChat DevTools simulator boot error detected in IDE log/i,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /getPageMetaByWebviewId/i,
  /subPackages[\s\S]{0,80}undefined/i,
]
const TRAILING_PATH_SEPARATOR_PATTERN = /[\\/]+$/
const ENV_LIST_SPLIT_PATTERN = /[,;\n]/
const ERROR_CONSOLE_TEXT_PATTERN = /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/
const WARN_CONSOLE_TEXT_PATTERN = /\b(?:warn(?:ing)?|deprecated|deprecation)\b/i
const COMPONENT_WARN_PATTERN = /\[Component\]/
const RELAUNCH_RETRYABLE_PATTERNS = [
  /Wait timed out after/i,
  /Timeout in raw reLaunch/i,
  /Timeout in warmup reLaunch/i,
  /Timeout in warmup current page/i,
  /Timeout in read current page/i,
  /Operation timed out after \d+ms/i,
  /reLaunch returned empty page/i,
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
const DEVTOOLS_CLI_ENGINE_BUILD_OPENED_PATTERN = /打开项目成功|project\s+opened|open\s+project\s+success/i

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
const TOOL_COMPILE_TIMEOUT = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_TOOL_COMPILE_TIMEOUT,
  DEFAULT_TOOL_COMPILE_TIMEOUT,
)
const BRIDGE_CONNECT_SETTLE_DELAY = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_BRIDGE_CONNECT_SETTLE_DELAY,
  DEFAULT_BRIDGE_CONNECT_SETTLE_DELAY,
)
const BRIDGE_WARMUP_READY_TIMEOUT = resolvePositiveIntEnv(
  process.env.WEAPP_VITE_E2E_BRIDGE_WARMUP_READY_TIMEOUT,
  DEFAULT_BRIDGE_WARMUP_READY_TIMEOUT,
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
const automator = new Automator()

export interface RuntimeLogStats {
  debug: number
  info: number
  log: number
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
  reset: () => void
  closed: boolean
  closeWrapped: boolean
}

interface RelaunchPatchMeta {
  wrapped: boolean
}

interface RelaunchRecoveryOptions {
  checkDevtoolsLog?: (label: string) => void
  cliPath?: string
  cwd?: string
  disableSessionRecovery?: boolean
  project: string
  projectPath?: string
  rootSelectors?: string[]
  skipPageRootCheck?: boolean
}

type RuntimeLogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error' | 'exception'

interface RuntimeLogEntry {
  level: RuntimeLogLevel
  text: string
}

interface LaunchProjectMeta {
  appConfigPath: string
  warmupRoute?: string
}

interface BridgeWrapperProject {
  distRoot: string
  path: string
  stopSync?: () => void
}

interface BridgeWrapperSyncOptions {
  preserveRoots?: string[]
}

class LaunchAppConfigNotReadyError extends Error {
  constructor(appConfigPath: string, reason: string) {
    super(`[runtime:launch-preflight] app.json not ready: ${appConfigPath} reason=${reason}`)
    this.name = 'WechatIdeLaunchAppConfigNotReadyError'
  }
}

class DevtoolsSimulatorBootLogError extends Error {
  constructor(label: string) {
    super(`WeChat DevTools simulator boot error detected in IDE log during ${label}`)
    this.name = 'WechatIdeSimulatorBootLogError'
  }
}

interface LaunchAppConfigValidationResult {
  ready: boolean
  reason?: string
  warmupRoute?: string
}

type AutomatorLaunchOptions = Parameters<typeof automator.launch>[0]

interface LaunchAutomatorOptions extends AutomatorLaunchOptions {
  disableRelaunchSessionRecovery?: boolean
  skipRelaunchPageRootCheck?: boolean
  skipWarmup?: boolean
  warmupAllowRelaunch?: boolean
  warmupAnyPage?: boolean
  warmupRootSelectors?: string[]
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
  servicePort?: number
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

export function resolveAutomatorLaunchMode() {
  return process.env[AUTOMATOR_LAUNCH_MODE_ENV]?.trim().toLowerCase() || AUTOMATOR_LAUNCH_MODE_BRIDGE
}

function shouldSkipAutomatorWarmup(skipWarmup?: boolean) {
  return skipWarmup === true || process.env[AUTOMATOR_SKIP_WARMUP_ENV] === '1'
}

export function shouldPrebuildAutomatorProject() {
  return process.env[AUTOMATOR_PREBUILD_ENV] === '1'
}

function shouldPrebuildAutomatorBridgeProject() {
  const bridgePrebuild = process.env[AUTOMATOR_BRIDGE_PREBUILD_ENV]
  if (bridgePrebuild === '0') {
    return false
  }
  if (bridgePrebuild === '1') {
    return true
  }
  return shouldPrebuildAutomatorProject()
}

function shouldRefreshAutomatorBridgeProjectAfterConnect() {
  return process.env[AUTOMATOR_POST_CONNECT_REFRESH_ENV] === '1'
    || process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV] === '1'
}

function shouldDisableAutomatorRelaunchCurrentReady() {
  return process.env[AUTOMATOR_DISABLE_RELAUNCH_CURRENT_READY_ENV] !== '0'
}

function shouldUseAutomatorBridgeWrapper() {
  return process.env[AUTOMATOR_BRIDGE_WRAPPER_ENV] !== '0'
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

function resolveConsoleLevel(entry: any): Exclude<RuntimeLogLevel, 'exception'> {
  const payload = resolveConsolePayload(entry)
  const rawLevel = String(payload?.level ?? payload?.type ?? '').toLowerCase()
  if (rawLevel === 'debug') {
    return 'debug'
  }
  if (rawLevel === 'info') {
    return 'info'
  }
  if (rawLevel === 'warn' || rawLevel === 'warning') {
    return 'warn'
  }
  if (rawLevel === 'error' || rawLevel === 'fatal') {
    return 'error'
  }
  if (isErrorConsoleEntry(entry)) {
    return 'error'
  }
  if (isWarnConsoleEntry(entry)) {
    return 'warn'
  }
  return 'log'
}

function ensureRuntimeLogMeta(miniProgram: any, project: string): RuntimeLogMeta {
  const existing = (miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] as RuntimeLogMeta | undefined
  if (existing) {
    return existing
  }

  const entries: RuntimeLogEntry[] = []
  const stats: RuntimeLogStats = {
    debug: 0,
    info: 0,
    log: 0,
    warn: 0,
    error: 0,
    exception: 0,
    total: 0,
  }

  const appendRuntimeLogEvent = (entry: RuntimeLogEntry) => {
    appendIdeReportEvent({
      source: 'runtime',
      kind: 'message',
      project,
      level: entry.level,
      channel: entry.level === 'exception' ? 'exception' : 'runtime',
      text: entry.text,
    })
  }

  const onConsole = (entry: any) => {
    const text = normalizeConsoleText(entry)
    if (!text) {
      return
    }
    const level = resolveConsoleLevel(entry)
    stats[level] += 1
    stats.total += 1
    const runtimeEntry = { level, text }
    entries.push(runtimeEntry)
    appendRuntimeLogEvent(runtimeEntry)
  }

  const onException = (entry: any) => {
    const text = typeof entry?.exceptionDetails?.text === 'string'
      ? entry.exceptionDetails.text
      : normalizeConsoleText(entry)
    stats.exception += 1
    stats.total += 1
    const runtimeEntry = { level: 'exception', text } satisfies RuntimeLogEntry
    entries.push(runtimeEntry)
    appendRuntimeLogEvent(runtimeEntry)
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
    reset() {
      entries.length = 0
      stats.warn = 0
      stats.error = 0
      stats.exception = 0
      stats.log = 0
      stats.info = 0
      stats.debug = 0
      stats.total = 0
    },
    closed: false,
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

function isLikelySimulatorBootErrorMessage(message: string) {
  return DEVTOOLS_SIMULATOR_BOOT_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function isLikelyDevtoolsLaunchCacheStaleMessage(message: string) {
  return isLikelyDevtoolsCompileCacheCorruptionMessage(message)
    || isLikelySimulatorBootErrorMessage(message)
    || LAUNCH_TIMEOUT_PATTERN.test(message)
    || RELAUNCH_RETRYABLE_PATTERNS.some(pattern => pattern.test(message))
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
    const output = `${stderr}\n${stdout}`
    if (isLikelyDevtoolsInfraErrorMessage(output)
      || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(output))) {
      return null
    }
    throw new Error(stderr || stdout || `Failed to verify WeChat DevTools login: exit ${(result.exitCode ?? 1)}`)
  }

  return null
}

function extractExecutionErrorText(error: unknown, seen = new Set<unknown>()) {
  if (!error || typeof error !== 'object') {
    return ''
  }
  if (seen.has(error)) {
    return ''
  }
  seen.add(error)

  const parts: string[] = []
  const candidate = error as {
    cause?: unknown
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

  const causeText = extractExecutionErrorText(candidate.cause, seen)
  if (causeText) {
    parts.push(causeText)
  }

  return parts.join('\n')
}

async function recoverDevtoolsCompileCache(options: {
  cliPath?: string
  completedSteps?: Set<string>
  cwd?: string
  error: unknown
  project: string
}) {
  const message = extractExecutionErrorText(options.error) || String(options.error)
  if (!isLikelyDevtoolsLaunchCacheStaleMessage(message)) {
    return false
  }

  const resolvedCliPath = resolveWechatCliPath(options.cliPath)
  const completedSteps = options.completedSteps
  for (const cleanType of DEVTOOLS_CACHE_RECOVERY_STEPS) {
    if (completedSteps?.has(cleanType)) {
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
      completedSteps?.add(cleanType)
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

async function cleanupDevtoolsProcessStateAfterLaunchFailure(error: unknown, project: string) {
  const message = extractExecutionErrorText(error) || String(error)
  if (!isLikelyDevtoolsLaunchCacheStaleMessage(message)
    && !isLikelyDevtoolsInfraErrorMessage(message)
    && !isLikelySimulatorBootErrorMessage(message)
    && !DEVTOOLS_CLI_EARLY_EXIT_PATTERNS.some(pattern => pattern.test(message))) {
    return
  }

  process.stdout.write(`[warn] [runtime:launch-recover] cleanup-devtools project=${project}\n`)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project,
    level: 'warn',
    channel: 'launch-recover',
    text: 'cleanup-devtools',
  })
  await cleanupResidualDevtoolsProcesses().catch((cleanupError) => {
    const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    process.stdout.write(`[warn] [runtime:launch-recover] cleanup-devtools-failed project=${project} reason=${cleanupMessage.slice(0, 240)}\n`)
  })
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function createDevtoolsSimulatorBootLogMonitor(project: string) {
  const sinceMs = Date.now()
  const baseline = captureDevtoolsLogBaseline()
  let lastScanAt = 0
  let reportedIssueText = ''

  return {
    assertClean(label: string) {
      const now = Date.now()
      if (now - lastScanAt < DEVTOOLS_LOG_SCAN_INTERVAL) {
        return
      }
      lastScanAt = now

      const issues = scanRecentDevtoolsSimulatorBootIssues({ baseline, sinceMs })
      if (issues.length === 0) {
        return
      }

      const issueText = 'WeChat DevTools simulator boot error detected in IDE log'
      if (issueText === reportedIssueText) {
        throw new DevtoolsSimulatorBootLogError(label)
      }
      reportedIssueText = issueText
      process.stdout.write(`[warn] [runtime:devtools-log] label=${label} reason=${issueText} project=${project}\n`)
      appendIdeReportEvent({
        source: 'runtime',
        kind: 'message',
        project,
        level: 'warn',
        channel: 'devtools-log',
        text: `${label}: ${issueText}`,
      })
      throw new DevtoolsSimulatorBootLogError(label)
    },
  }
}

function normalizeRouteForCompare(value: string) {
  return value
    .split('?', 1)[0]
    .replace(LEADING_SLASH_PATTERN, '')
    .replace(TRIM_ROUTE_SLASH_PATTERN, '')
}

function routeHasQuery(value: string) {
  return value.includes('?')
}

function isRunWithTimeoutError(error: unknown, label: string) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(`Timeout in ${label} after`)
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

async function runWithDevtoolsLogMonitor<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
  label: string,
  monitor: ReturnType<typeof createDevtoolsSimulatorBootLogMonitor>,
  onLateResolve?: (value: T) => Promise<void> | void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let interval: ReturnType<typeof setInterval> | null = null
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
        interval = setInterval(() => {
          try {
            monitor.assertClean(label)
          }
          catch (error) {
            timedOut = true
            reject(error)
          }
        }, DEVTOOLS_LOG_SCAN_INTERVAL)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (interval) {
      clearInterval(interval)
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
  return isLikelySimulatorBootErrorMessage(message)
    || RELAUNCH_RETRYABLE_PATTERNS.some(pattern => pattern.test(message))
}

function isRawRelaunchTimeoutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in raw reLaunch/i.test(message)
}

export function isWarmupRelaunchTimeoutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in warmup reLaunch/i.test(message)
}

export function isWarmupPageRootTimeoutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timed out waiting page root after warmup reLaunch/i.test(message)
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

function writeJsonObject(filePath: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function copyJsonConfigAsBridgeWrapper(sourcePath: string, targetPath: string, patch: Record<string, any> = {}) {
  const source = readJsonObject(sourcePath)
  if (!source) {
    return
  }
  writeJsonObject(targetPath, {
    ...source,
    ...patch,
  })
}

export function createBridgeWrapperProjectConfig(source: Record<string, any>, patch: Record<string, any> = {}) {
  const {
    miniprogramRoot: _miniprogramRoot,
    srcMiniprogramRoot: _srcMiniprogramRoot,
    qcloudRoot: _qcloudRoot,
    ...rest
  } = source

  const sourceSetting = source.setting && typeof source.setting === 'object' ? source.setting : {}
  const patchSetting = patch.setting && typeof patch.setting === 'object' ? patch.setting : {}
  const setting = {
    ...sourceSetting,
    ...patchSetting,
  }
  setting.packNpmManually = false
  setting.packNpmRelationList = []

  return {
    compileType: 'miniprogram',
    ...rest,
    ...patch,
    miniprogramRoot: './',
    srcMiniprogramRoot: './',
    setting,
    condition: {
      ...(source.condition && typeof source.condition === 'object' ? source.condition : {}),
      ...(patch.condition && typeof patch.condition === 'object' ? patch.condition : {}),
    },
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

function resolveBridgeWrapperProjectConfig(projectPath: string) {
  return readJsonObject(path.join(projectPath, 'project.config.json')) ?? {}
}

function normalizeProjectRelativeRoot(rawRoot: unknown) {
  if (typeof rawRoot !== 'string') {
    return undefined
  }
  const normalized = rawRoot.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized === '.') {
    return undefined
  }
  if (normalized.split('/').includes('..')) {
    return undefined
  }
  return normalized
}

function copyDistEntryForBridgeWrapper(sourcePath: string, targetPath: string, isDirectory: boolean) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  try {
    if (isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true })
      fs.cpSync(sourcePath, targetPath, {
        dereference: true,
        recursive: true,
      })
      return
    }

    fs.rmSync(targetPath, { recursive: true, force: true })
    fs.copyFileSync(sourcePath, targetPath)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function shouldPreserveBridgeWrapperPath(relativePath: string, preserveRoots: string[]) {
  const normalized = relativePath.replace(/\\/g, '/')
  return normalized === 'project.config.json'
    || normalized === 'project.private.config.json'
    || preserveRoots.some(root => normalized === root || normalized.startsWith(`${root}/`))
}

function safeStat(targetPath: string) {
  try {
    return fs.lstatSync(targetPath)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

function safeReadDirectory(directoryPath: string) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

function removeStaleBridgeWrapperDistEntries(distRoot: string, wrapperRoot: string, preserveRoots: string[]) {
  if (!fs.existsSync(wrapperRoot)) {
    return
  }

  const entries = safeReadDirectory(wrapperRoot)
  if (!entries) {
    return
  }
  for (const entry of entries) {
    const targetPath = path.join(wrapperRoot, entry.name)
    const relativePath = path.relative(wrapperRoot, targetPath)
    if (shouldPreserveBridgeWrapperPath(relativePath, preserveRoots)) {
      continue
    }
    if (!fs.existsSync(path.join(distRoot, relativePath))) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    }
  }
}

function copyBridgeWrapperDistSnapshot(
  distRoot: string,
  wrapperRoot: string,
  options: BridgeWrapperSyncOptions = {},
) {
  const distEntries = safeReadDirectory(distRoot)
  if (!distEntries) {
    return
  }

  const preserveRoots = options.preserveRoots ?? []
  fs.mkdirSync(wrapperRoot, { recursive: true })
  removeStaleBridgeWrapperDistEntries(distRoot, wrapperRoot, preserveRoots)

  for (const entry of distEntries) {
    const sourcePath = path.join(distRoot, entry.name)
    const targetPath = path.join(wrapperRoot, entry.name)
    copyDistEntryForBridgeWrapper(sourcePath, targetPath, entry.isDirectory())
  }
}

function copyProjectRootForBridgeWrapper(projectPath: string, wrapperRoot: string, relativeRoot: string) {
  const sourcePath = path.join(projectPath, relativeRoot)
  if (!fs.existsSync(sourcePath)) {
    return
  }

  const targetPath = path.join(wrapperRoot, relativeRoot)
  const entry = safeStat(sourcePath)
  if (!entry) {
    return
  }
  copyDistEntryForBridgeWrapper(sourcePath, targetPath, entry.isDirectory())
}

function isPathInsideRoot(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function copyBridgeWrapperDistPath(distRoot: string, wrapperRoot: string, sourcePath: string) {
  if (!isPathInsideRoot(distRoot, sourcePath) || !fs.existsSync(sourcePath)) {
    return
  }

  const relativePath = path.relative(distRoot, sourcePath)
  const targetPath = path.join(wrapperRoot, relativePath)
  const sourceStat = safeStat(sourcePath)
  if (!sourceStat) {
    return
  }
  copyDistEntryForBridgeWrapper(sourcePath, targetPath, sourceStat.isDirectory())
}

function removeBridgeWrapperDistPath(distRoot: string, wrapperRoot: string, sourcePath: string) {
  if (!isPathInsideRoot(distRoot, sourcePath)) {
    return
  }

  const relativePath = path.relative(distRoot, sourcePath)
  fs.rmSync(path.join(wrapperRoot, relativePath), { recursive: true, force: true })
}

function startBridgeWrapperDistSync(
  distRoot: string,
  wrapperRoot: string,
  options: BridgeWrapperSyncOptions = {},
) {
  const preserveRoots = options.preserveRoots ?? []
  const pendingPaths = new Set<string>()
  const watchers = new Map<string, fs.FSWatcher>()
  let timer: NodeJS.Timeout | undefined
  let reconcileTimer: NodeJS.Timeout | undefined
  let closed = false
  let watchDirectoryTree: (directoryPath: string) => void = () => {}

  const closeWatchers = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    for (const watcher of watchers.values()) {
      watcher.close()
    }
    watchers.clear()
    pendingPaths.clear()
  }

  const closeSync = () => {
    closed = true
    closeWatchers()
    if (reconcileTimer) {
      clearInterval(reconcileTimer)
      reconcileTimer = undefined
    }
  }

  const syncSnapshot = () => {
    if (closed) {
      return
    }
    if (!fs.existsSync(distRoot)) {
      closeWatchers()
      return
    }
    watchDirectoryTree(distRoot)
    copyBridgeWrapperDistSnapshot(distRoot, wrapperRoot, { preserveRoots })
  }

  const flush = () => {
    timer = undefined
    if (!fs.existsSync(distRoot)) {
      closeWatchers()
      return
    }
    const paths = Array.from(pendingPaths)
    pendingPaths.clear()

    for (const changedPath of paths) {
      if (closed) {
        return
      }
      if (fs.existsSync(changedPath)) {
        copyBridgeWrapperDistPath(distRoot, wrapperRoot, changedPath)
      }
      else {
        removeBridgeWrapperDistPath(distRoot, wrapperRoot, changedPath)
      }
    }
  }

  const schedule = (changedPath: string) => {
    if (closed) {
      return
    }
    pendingPaths.add(changedPath)
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(flush, 80)
  }

  const watchDirectory = (directoryPath: string) => {
    if (closed || watchers.has(directoryPath) || !fs.existsSync(directoryPath)) {
      return
    }

    const watcher = fs.watch(directoryPath, (_eventType, fileName) => {
      if (!fileName) {
        syncSnapshot()
        return
      }

      const changedPath = path.join(directoryPath, fileName.toString())
      if (fs.existsSync(changedPath)) {
        const stat = safeStat(changedPath)
        if (stat?.isDirectory()) {
          watchDirectoryTree(changedPath)
        }
      }
      schedule(changedPath)
    })
    watcher.on('error', () => {
      watchers.delete(directoryPath)
      syncSnapshot()
    })
    watcher.unref()
    watchers.set(directoryPath, watcher)
  }

  watchDirectoryTree = (directoryPath: string) => {
    if (!fs.existsSync(directoryPath)) {
      return
    }

    watchDirectory(directoryPath)
    const entries = safeReadDirectory(directoryPath)
    if (!entries) {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        watchDirectoryTree(path.join(directoryPath, entry.name))
      }
    }
  }

  watchDirectoryTree(distRoot)
  reconcileTimer = setInterval(syncSnapshot, 500)
  reconcileTimer.unref()

  return closeSync
}

function prepareAutomatorBridgeWrapperProject(
  projectPath: string | undefined,
  projectMeta: LaunchProjectMeta | undefined,
): BridgeWrapperProject | undefined {
  if (!projectPath || !projectMeta || !shouldUseAutomatorBridgeWrapper()) {
    return projectPath ? { distRoot: '', path: projectPath } : undefined
  }

  const distRoot = path.dirname(projectMeta.appConfigPath)
  if (!fs.existsSync(distRoot)) {
    return { distRoot, path: projectPath }
  }

  const hash = crypto
    .createHash('sha1')
    .update(path.resolve(projectPath))
    .update('\0')
    .update(path.resolve(distRoot))
    .digest('hex')
    .slice(0, 16)
  const wrapperRoot = path.join(AUTOMATOR_BRIDGE_WRAPPER_ROOT, hash)
  copyBridgeWrapperDistSnapshot(distRoot, wrapperRoot)

  const projectConfig = resolveBridgeWrapperProjectConfig(projectPath)
  const pluginRoot = normalizeProjectRelativeRoot(projectConfig.pluginRoot)
  const preserveRoots = pluginRoot ? [pluginRoot] : []
  if (pluginRoot) {
    copyProjectRootForBridgeWrapper(projectPath, wrapperRoot, pluginRoot)
  }

  const wrapperProjectConfig = createBridgeWrapperProjectConfig(projectConfig)
  writeJsonObject(path.join(wrapperRoot, 'project.config.json'), wrapperProjectConfig)
  copyJsonConfigAsBridgeWrapper(
    path.join(projectPath, 'project.private.config.json'),
    path.join(wrapperRoot, 'project.private.config.json'),
  )

  return {
    distRoot,
    path: wrapperRoot,
    stopSync: startBridgeWrapperDistSync(distRoot, wrapperRoot, { preserveRoots }),
  }
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

function validateLaunchAppConfig(config: Record<string, any>): LaunchAppConfigValidationResult {
  const pages = Array.isArray(config.pages) ? config.pages : []
  const hasPage = pages.some(item => typeof item === 'string' && item.trim())
  if (!hasPage) {
    return {
      ready: false,
      reason: 'pages is empty',
    }
  }

  if (!Object.hasOwn(config, 'subPackages')) {
    return {
      ready: false,
      reason: 'subPackages is missing',
      warmupRoute: resolveRouteFromAppConfig(config),
    }
  }

  if (!Array.isArray(config.subPackages)) {
    return {
      ready: false,
      reason: 'subPackages is not an array',
      warmupRoute: resolveRouteFromAppConfig(config),
    }
  }

  if (config.subpackages != null && !Array.isArray(config.subpackages)) {
    return {
      ready: false,
      reason: 'subpackages is not an array',
      warmupRoute: resolveRouteFromAppConfig(config),
    }
  }

  for (const subPackage of [...config.subPackages, ...(Array.isArray(config.subpackages) ? config.subpackages : [])]) {
    if (!subPackage || typeof subPackage !== 'object') {
      return {
        ready: false,
        reason: 'subPackages contains non-object item',
        warmupRoute: resolveRouteFromAppConfig(config),
      }
    }
    if (!Array.isArray(subPackage.pages)) {
      return {
        ready: false,
        reason: 'subPackages contains item without pages array',
        warmupRoute: resolveRouteFromAppConfig(config),
      }
    }
  }

  return {
    ready: true,
    warmupRoute: resolveRouteFromAppConfig(config),
  }
}

async function resolveLaunchProjectMeta(projectPath: string | undefined): Promise<LaunchProjectMeta | undefined> {
  if (!projectPath) {
    return undefined
  }

  const appConfigPath = path.resolve(projectPath, resolveMiniprogramRoot(projectPath), 'app.json')
  const start = Date.now()
  let lastReason = 'app.json is not readable'
  while (Date.now() - start <= APP_CONFIG_READY_TIMEOUT) {
    const config = readJsonObject(appConfigPath)
    if (config) {
      const validation = validateLaunchAppConfig(config)
      lastReason = validation.reason ?? 'app.json is ready'
      if (validation.ready) {
        return {
          appConfigPath,
          warmupRoute: validation.warmupRoute,
        }
      }
    }
    await sleep(120)
  }

  const timeoutLine = `[warn] [runtime:launch-preflight] app.json not ready within ${APP_CONFIG_READY_TIMEOUT}ms: ${appConfigPath} reason=${lastReason}`
  process.stdout.write(`${timeoutLine}\n`)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project: resolveReportProjectPath(projectPath),
    level: 'warn',
    channel: 'launch-preflight',
    text: `app.json not ready within ${APP_CONFIG_READY_TIMEOUT}ms: ${resolveReportProjectPath(appConfigPath)} reason=${lastReason}`,
  })
  throw new LaunchAppConfigNotReadyError(appConfigPath, lastReason)
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

  const message = extractExecutionErrorText(error) || String(error)
  return isLikelyDevtoolsInfraErrorMessage(message)
    || LAUNCH_TIMEOUT_PATTERN.test(message)
    || DEVTOOLS_CONNECTION_CLOSED_PATTERNS.some(pattern => pattern.test(message))
    || DEVTOOLS_CLI_EARLY_EXIT_PATTERNS.some(pattern => pattern.test(message))
    || isLikelySimulatorBootErrorMessage(message)
    || isLikelyRelaunchRetryableError(error)
}

function handleLaunchError(error: unknown, project: string): never {
  const message = extractExecutionErrorText(error) || String(error)
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

async function waitForRelaunchPageRoot(page: any, timeoutMs = RELAUNCH_READY_TIMEOUT, rootSelectors: string[] = []) {
  const start = Date.now()
  const renderedSelectors = [...rootSelectors, 'view', 'text']
  const selectors = [...rootSelectors, 'page', 'body', 'weapp-app-shell', 'view']
  while (Date.now() - start <= timeoutMs) {
    try {
      if (typeof page?.waitForRendered === 'function') {
        for (const selector of renderedSelectors) {
          const remaining = Math.max(1, timeoutMs - (Date.now() - start))
          const probeTimeout = Math.min(ROUTE_READY_PAGE_ROOT_PROBE_TIMEOUT, remaining)
          try {
            await runWithTimeout(
              () => page.waitForRendered({
                selector,
                timeout: probeTimeout,
              }),
              probeTimeout + 500,
              `wait rendered page node ${selector}`,
            )
            return { selector }
          }
          catch {
            // 旧版 DevTools 的 Page.getElement 可能不可用，但 selectorQuery 失败时仍继续走历史探测。
          }
        }
      }
      for (const selector of selectors) {
        const remaining = Math.max(1, timeoutMs - (Date.now() - start))
        const queryTimeout = Math.min(DEFAULT_PAGE_ROOT_QUERY_TIMEOUT, remaining)
        if (typeof page?.$$ === 'function') {
          const roots = await runWithTimeout(
            () => page.$$(selector),
            queryTimeout,
            `query page roots ${selector}`,
          )
          if (Array.isArray(roots) && roots.length > 0) {
            return roots[0]
          }
        }
        const root = await runWithTimeout(
          () => page?.$(selector),
          queryTimeout,
          `query page root ${selector}`,
        )
        if (root) {
          return root
        }
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

async function waitForCurrentRouteReady(
  miniProgram: any,
  route: string,
  timeoutMs = RELAUNCH_READY_TIMEOUT,
  options: { checkDevtoolsLog?: (label: string) => void, closeOnQueryTimeout?: boolean, queryTimeoutMs?: number, rootSelectors?: string[] } = {},
) {
  if (typeof miniProgram?.currentPage !== 'function') {
    return null
  }

  const normalizedRoute = normalizeRouteForCompare(route)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const remaining = Math.max(1, timeoutMs - (Date.now() - start))
    const label = `read current page for route ${route}`
    try {
      options.checkDevtoolsLog?.(label)
      const currentPage = await runWithTimeout(
        () => miniProgram.currentPage(),
        Math.min(options.queryTimeoutMs ?? 2_000, remaining),
        label,
      )
      if (normalizeRouteForCompare(currentPage?.path ?? '') === normalizedRoute) {
        const pageRoot = await waitForRelaunchPageRoot(currentPage, Math.min(2_000, remaining), options.rootSelectors)
        if (pageRoot) {
          return currentPage
        }
      }
    }
    catch (error) {
      if (options.closeOnQueryTimeout && isRunWithTimeoutError(error, label)) {
        await miniProgram.close?.().catch(() => {})
        throw error
      }
      // DevTools 模拟器创建期间 currentPage 可能短暂不可用，继续轮询。
    }
    await sleep(Math.min(220, Math.max(1, timeoutMs - (Date.now() - start))))
  }

  return null
}

async function waitForAnyCurrentPageReady(
  miniProgram: any,
  timeoutMs = RELAUNCH_READY_TIMEOUT,
  options: { checkDevtoolsLog?: (label: string) => void, closeOnQueryTimeout?: boolean, queryTimeoutMs?: number } = {},
) {
  if (typeof miniProgram?.currentPage !== 'function') {
    return null
  }

  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const remaining = Math.max(1, timeoutMs - (Date.now() - start))
    const label = 'read current page'
    try {
      options.checkDevtoolsLog?.(label)
      const currentPage = await runWithTimeout(
        () => miniProgram.currentPage(),
        Math.min(options.queryTimeoutMs ?? 2_000, remaining),
        label,
      )
      const pageRoot = await waitForRelaunchPageRoot(currentPage, Math.min(2_000, remaining))
      if (pageRoot) {
        return currentPage
      }
    }
    catch (error) {
      if (options.closeOnQueryTimeout && isRunWithTimeoutError(error, label)) {
        await miniProgram.close?.().catch(() => {})
        throw error
      }
      // DevTools 模拟器创建期间 currentPage 可能短暂不可用，继续轮询。
    }
    await sleep(Math.min(220, Math.max(1, timeoutMs - (Date.now() - start))))
  }

  return null
}

export function formatRuntimeStatsLine(stats: RuntimeLogStats) {
  const runtimeIssueCount = stats.warn + stats.error + stats.exception
  return `[e2e-runtime-stats] warn=${stats.warn} error=${stats.error} exception=${stats.exception} total=${runtimeIssueCount} log=${stats.log} info=${stats.info} debug=${stats.debug} all=${stats.total}`
}

function logRuntimeStats(meta: RuntimeLogMeta) {
  const runtimeLogCount = meta.stats.debug + meta.stats.info + meta.stats.log
  const runtimeIssueCount = meta.stats.warn + meta.stats.error + meta.stats.exception
  const summary = formatRuntimeStatsLine(meta.stats)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'stats',
    project: meta.project,
    log: meta.stats.log + meta.stats.debug,
    info: meta.stats.info,
    warn: meta.stats.warn,
    error: meta.stats.error,
    exception: meta.stats.exception,
    total: runtimeIssueCount,
  })
  if (runtimeIssueCount > 0) {
    process.stderr.write(`${summary}\n`)
    for (const entry of meta.entries) {
      if (entry.level === 'log' || entry.level === 'info' || entry.level === 'debug') {
        continue
      }
      if (entry.level === 'warn') {
        const logLine = `[warn] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        continue
      }
      if (entry.level === 'error') {
        const logLine = `[error] [runtime] ${entry.text}`
        process.stderr.write(`${logLine}\n`)
        continue
      }
      const logLine = `[error] [runtime:exception] ${entry.text}`
      process.stderr.write(`${logLine}\n`)
    }
    return
  }
  process.stdout.write(`${summary}\n`)
  if (runtimeLogCount > 0) {
    process.stdout.write(`[e2e-runtime-logs] log=${meta.stats.log} info=${meta.stats.info} debug=${meta.stats.debug}\n`)
  }
}

function enhanceMiniProgramWithRuntimeLogs(miniProgram: any, project: string) {
  const meta = ensureRuntimeLogMeta(miniProgram, project)
  if (meta.closeWrapped) {
    return miniProgram
  }
  meta.closeWrapped = true

  const rawClose = miniProgram.close.bind(miniProgram)
  miniProgram.close = async (...args: any[]) => {
    if (meta.closed) {
      return
    }
    meta.closed = true
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

function resetMiniProgramRuntimeLogs(miniProgram: any) {
  const meta = (miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] as RuntimeLogMeta | undefined
  meta?.reset()
}

async function resolveCurrentPageAfterWarmupFailure(
  miniProgram: any,
  route: string,
  error: unknown,
  project: string,
) {
  if (typeof miniProgram.currentPage !== 'function') {
    return undefined
  }

  try {
    const currentPage = await runWithTimeout(
      () => miniProgram.currentPage(),
      Math.min(DEFAULT_PAGE_ROOT_QUERY_TIMEOUT, RELAUNCH_READY_TIMEOUT),
      `read current page after warmup failure ${route}`,
    )
    const currentRoute = currentPage?.path ?? ''
    if (normalizeRouteForCompare(currentRoute) !== normalizeRouteForCompare(route)) {
      process.stdout.write(`[info] [runtime:warmup-current-page] route=${route} current=${currentRoute || '<none>'} project=${project}\n`)
      return undefined
    }

    const pageRoot = await waitForRelaunchPageRoot(currentPage)
    if (!pageRoot) {
      process.stdout.write(`[info] [runtime:warmup-current-page] route=${route} current=${currentRoute} root=<missing> project=${project}\n`)
      return undefined
    }

    process.stdout.write(`[info] [runtime:warmup-fallback] route=${route} project=${project} reason=${error instanceof Error ? error.message : String(error)}\n`)
    return currentPage
  }
  catch {
    return undefined
  }
}

async function warmupMiniProgramRoute(
  miniProgram: any,
  route: string,
  project: string,
  options: { allowAnyPage?: boolean, allowRelaunch?: boolean, checkDevtoolsLog?: (label: string) => void, rootSelectors?: string[] } = {},
) {
  const currentPageReadyTimeout = options.allowRelaunch === false
    ? Math.min(BRIDGE_WARMUP_READY_TIMEOUT, RELAUNCH_READY_TIMEOUT)
    : Math.min(QUICK_CURRENT_ROUTE_READY_TIMEOUT, RELAUNCH_READY_TIMEOUT)
  if (options.allowRelaunch === false && options.allowAnyPage) {
    const bootedPage = await waitForAnyCurrentPageReady(miniProgram, currentPageReadyTimeout, {
      checkDevtoolsLog: options.checkDevtoolsLog,
      closeOnQueryTimeout: false,
      queryTimeoutMs: 1_500,
    })
    if (bootedPage) {
      process.stdout.write(`[info] [runtime:launch-step] warmup-ready route=${route} source=current-page-any current=${bootedPage?.path ?? '<unknown>'} project=${project}\n`)
      return
    }
    process.stdout.write(`[warn] [runtime:launch-step] warmup-any-page-timeout route=${route} project=${project}\n`)
    return
  }
  const currentPage = await waitForCurrentRouteReady(miniProgram, route, currentPageReadyTimeout, {
    checkDevtoolsLog: options.checkDevtoolsLog,
    closeOnQueryTimeout: options.allowRelaunch === false,
    queryTimeoutMs: currentPageReadyTimeout,
  })
  if (currentPage) {
    process.stdout.write(`[info] [runtime:launch-step] warmup-ready route=${route} source=current-page project=${project}\n`)
    return
  }
  if (options.allowRelaunch === false) {
    const bootedPage = await waitForAnyCurrentPageReady(miniProgram, currentPageReadyTimeout, {
      checkDevtoolsLog: options.checkDevtoolsLog,
      closeOnQueryTimeout: !options.allowAnyPage,
      queryTimeoutMs: currentPageReadyTimeout,
    })
    if (bootedPage) {
      process.stdout.write(`[info] [runtime:launch-step] warmup-ready route=${route} source=current-page-any current=${bootedPage?.path ?? '<unknown>'} project=${project}\n`)
      return
    }
    if (options.allowAnyPage) {
      process.stdout.write(`[warn] [runtime:launch-step] warmup-any-page-timeout route=${route} project=${project}\n`)
      return
    }
    try {
      await miniProgram.close?.()
    }
    catch {
    }
    throw new Error(`Timeout in warmup current page ${route} after ${currentPageReadyTimeout}ms`)
  }

  let page: any
  try {
    page = await runWithTimeout(
      () => miniProgram.reLaunch(route),
      RELAUNCH_READY_TIMEOUT,
      `warmup reLaunch ${route}`,
    )
  }
  catch (error) {
    const currentPage = isLikelyRelaunchRetryableError(error)
      ? await resolveCurrentPageAfterWarmupFailure(miniProgram, route, error, project)
      : undefined
    if (!currentPage) {
      if (isWarmupRelaunchTimeoutError(error)) {
        try {
          await miniProgram.close?.()
        }
        catch {
        }
      }
      throw error
    }
    page = currentPage
  }
  if (!page) {
    throw new Error(`warmup reLaunch returned empty page: ${route}`)
  }

  if (RELAUNCH_SETTLE_DELAY > 0) {
    if (typeof page.waitFor === 'function') {
      await page.waitFor(RELAUNCH_SETTLE_DELAY)
    }
    else {
      await sleep(RELAUNCH_SETTLE_DELAY)
    }
  }

  const pageRoot = await waitForRelaunchPageRoot(page, RELAUNCH_READY_TIMEOUT, options.rootSelectors)
  if (!pageRoot) {
    throw new Error(`Timed out waiting page root after warmup reLaunch: ${route}`)
  }

  process.stdout.write(`[info] [runtime:launch-step] warmup-ready route=${route} project=${project}\n`)
}

function isUnsupportedToolCompileError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return DEVTOOLS_TOOL_COMPILE_UNSUPPORTED_PATTERNS.some(pattern => pattern.test(error.message))
}

function isToolCompileTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return DEVTOOLS_TOOL_COMPILE_TIMEOUT_PATTERNS.some(pattern => pattern.test(error.message))
}

async function compileMiniProgramProject(miniProgram: any, project: string) {
  if (typeof miniProgram?.compile !== 'function') {
    return
  }

  process.stdout.write(`[info] [runtime:launch-step] compile-start project=${project}\n`)
  try {
    await runWithTimeout(
      () => miniProgram.compile({ force: true }),
      TOOL_COMPILE_TIMEOUT,
      `compile project ${project}`,
    )
  }
  catch (error) {
    if (isUnsupportedToolCompileError(error)) {
      process.stdout.write(`[warn] [runtime:launch-step] compile-skip reason=tool-unimplemented project=${project}\n`)
      return
    }
    if (isToolCompileTimeoutError(error)) {
      process.stdout.write(`[warn] [runtime:launch-step] compile-skip reason=tool-timeout project=${project}\n`)
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

function rememberWechatDevtoolsServicePort(output: string) {
  const servicePort = extractWechatDevtoolsServicePort(output)
  if (servicePort) {
    setRuntimeWechatDevtoolsServicePort(servicePort)
  }
  return servicePort
}

async function runWechatIdeEngineBuildByRuntimeHttp(projectPath: string, project: string) {
  await runWithTimeout(
    () => runWechatIdeEngineBuildByHttp(projectPath, {
      overallTimeoutMs: 60_000,
      pollIntervalMs: 1_000,
    }),
    70_000,
    `engine build ${project}`,
  )
}

async function refreshMiniProgramProjectIndex(
  projectPath: string | undefined,
  project: string,
  options: { allowCliEngineBuildFallback?: boolean, cliPath?: string, cwd?: string, refreshProject?: boolean } = {},
) {
  if (!projectPath) {
    return
  }

  if (options.refreshProject) {
    process.stdout.write(`[info] [runtime:launch-step] project-refresh-start project=${project}\n`)
    await runWithTimeout(
      () => openWechatIdeProjectByHttp(projectPath),
      10_000,
      `refresh project ${project}`,
    )
    await sleep(1_000)
    process.stdout.write(`[info] [runtime:launch-step] project-refresh-ready project=${project}\n`)
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
    await runWechatIdeEngineBuildByRuntimeHttp(projectPath, project)
  }
  catch (error) {
    if (isMissingEngineBuildEndpointError(error)) {
      process.stdout.write(`[warn] [runtime:launch-step] engine-build-http-skip reason=endpoint-missing project=${project}\n`)
      if (options.allowCliEngineBuildFallback === false) {
        process.stdout.write(`[warn] [runtime:launch-step] engine-build-cli-skip reason=bridge-session project=${project}\n`)
        await sleep(1_200)
        return
      }
      const cliPath = resolveWechatCliPath(options.cliPath)
      const result = await execa(cliPath, ['engine', 'build', path.resolve(projectPath)], {
        cwd: options.cwd,
        reject: false,
        timeout: 70_000,
      })
      const combinedOutput = `${typeof result.stderr === 'string' ? result.stderr : ''}\n${typeof result.stdout === 'string' ? result.stdout : ''}`
      rememberWechatDevtoolsServicePort(combinedOutput)
      if ((result.exitCode ?? 1) !== 0) {
        const stderr = typeof result.stderr === 'string' ? result.stderr.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
        const stdout = typeof result.stdout === 'string' ? result.stdout.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
        const details = (stderr || stdout || `exit=${result.exitCode ?? 1}`).slice(0, 240)
        if (DEVTOOLS_CLI_ENGINE_BUILD_OPENED_PATTERN.test(`${stderr}\n${stdout}`)) {
          try {
            await runWechatIdeEngineBuildByRuntimeHttp(projectPath, project)
            process.stdout.write(`[info] [runtime:launch-step] engine-build-ready source=http-after-cli-open project=${project}\n`)
            return
          }
          catch (httpRetryError) {
            if (!isMissingEngineBuildEndpointError(httpRetryError)) {
              throw httpRetryError
            }
          }
          process.stdout.write(`[warn] [runtime:launch-step] engine-build-cli-opened-with-nonzero project=${project} reason=${details}\n`)
          await sleep(1_200)
          return
        }
        throw new Error(`Wechat DevTools CLI engine build failed: ${details}`)
      }
      await sleep(1_200)
      process.stdout.write(`[info] [runtime:launch-step] engine-build-ready source=cli project=${project}\n`)
      return
    }
    throw error
  }
  process.stdout.write(`[info] [runtime:launch-step] engine-build-ready project=${project}\n`)
}

async function prebuildAutomatorProjectIndex(
  projectPath: string | undefined,
  project: string,
  options: { cliPath?: string, cwd?: string } = {},
) {
  if (!projectPath) {
    return
  }

  const cliPath = resolveWechatCliPath(options.cliPath)
  process.stdout.write(`[info] [runtime:launch-step] prebuild-start project=${project}\n`)
  const result = await execa(cliPath, ['engine', 'build', path.resolve(projectPath)], {
    cwd: options.cwd,
    reject: false,
    timeout: 70_000,
  })
  if ((result.exitCode ?? 1) !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
    const stdout = typeof result.stdout === 'string' ? result.stdout.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim() : ''
    const details = (stderr || stdout || `exit=${result.exitCode ?? 1}`).slice(0, 240)
    if (DEVTOOLS_CLI_ENGINE_BUILD_OPENED_PATTERN.test(`${stderr}\n${stdout}`)) {
      process.stdout.write(`[warn] [runtime:launch-step] prebuild-opened-with-nonzero project=${project} reason=${details}\n`)
      await sleep(1_200)
      return
    }
    throw new Error(`Wechat DevTools CLI prebuild failed: ${details}`)
  }
  await sleep(1_200)
  process.stdout.write(`[info] [runtime:launch-step] prebuild-ready project=${project}\n`)
}

async function closeUnstableRelaunchSession(
  miniProgram: any,
  options: RelaunchRecoveryOptions,
  route: string,
  attempt: number,
  error: unknown,
) {
  const reason = error instanceof Error ? error.message : String(error)
  const text = `route=${route} attempt=${attempt} reason=${reason.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim().slice(0, 240)}`
  process.stdout.write(`[warn] [runtime:relaunch-session-close] ${text} project=${options.project}\n`)
  appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project: options.project,
    level: 'warn',
    channel: 'relaunch-session-close',
    text,
  })
  try {
    await miniProgram.close?.()
  }
  catch {
  }
}

function enhanceMiniProgramRelaunch(miniProgram: any, options: RelaunchRecoveryOptions) {
  const meta = (miniProgram as Record<string, any>)[RELAUNCH_PATCH_META_KEY] as RelaunchPatchMeta | undefined
  if (meta?.wrapped) {
    return miniProgram
  }

  ;(miniProgram as Record<string, any>)[RELAUNCH_PATCH_META_KEY] = { wrapped: true } as RelaunchPatchMeta
  const rawReLaunch = miniProgram.reLaunch.bind(miniProgram)
  const disableRelaunchCurrentReady = shouldDisableAutomatorRelaunchCurrentReady()
  miniProgram.reLaunch = async (...args: any[]) => {
    const route = typeof args[0] === 'string' ? args[0] : '<unknown-route>'
    const attempt = 1
    let page: any = null

    try {
      if (!options.skipPageRootCheck && !disableRelaunchCurrentReady && !routeHasQuery(route)) {
        const currentPage = await waitForCurrentRouteReady(miniProgram, route, Math.min(QUICK_CURRENT_ROUTE_READY_TIMEOUT, RELAUNCH_READY_TIMEOUT), {
          checkDevtoolsLog: options.checkDevtoolsLog,
          rootSelectors: options.rootSelectors,
        })
        if (currentPage) {
          process.stdout.write(`[info] [runtime:relaunch-current-ready] route=${route} attempt=${attempt}\n`)
          return currentPage
        }
      }

      options.checkDevtoolsLog?.(`raw reLaunch ${route}`)
      page = await runWithTimeout(
        () => rawReLaunch(...args),
        RELAUNCH_READY_TIMEOUT,
        `raw reLaunch ${route}`,
      )
      if (!page) {
        throw new Error(`reLaunch returned empty page: ${route}`)
      }

      options.checkDevtoolsLog?.(`reLaunch ${route}`)
      if (RELAUNCH_SETTLE_DELAY > 0) {
        if (typeof page.waitFor === 'function') {
          await page.waitFor(RELAUNCH_SETTLE_DELAY)
        }
        else {
          await sleep(RELAUNCH_SETTLE_DELAY)
        }
      }

      if (!options.skipPageRootCheck) {
        const pageRoot = await waitForRelaunchPageRoot(page, ROUTE_READY_PAGE_ROOT_PROBE_TIMEOUT, options.rootSelectors)
        if (!pageRoot) {
          throw new Error(`Timed out waiting page root after reLaunch: ${route}`)
        }
      }

      return page
    }
    catch (error) {
      if (!isLikelyRelaunchRetryableError(error)) {
        throw error
      }
      if (options.disableSessionRecovery) {
        throw error
      }
      if (isLikelySimulatorBootErrorMessage(error instanceof Error ? error.message : String(error))) {
        await closeUnstableRelaunchSession(miniProgram, options, route, attempt, error)
        throw error
      }
      try {
        const currentPage = await miniProgram.currentPage()
        if (normalizeRouteForCompare(currentPage?.path ?? '') === normalizeRouteForCompare(route)) {
          if (options.skipPageRootCheck) {
            process.stdout.write(`[info] [runtime:relaunch-current-fallback] route=${route} attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
            return currentPage ?? page
          }

          if (!isRawRelaunchTimeoutError(error)) {
            const pageRoot = await waitForRelaunchPageRoot(currentPage, ROUTE_READY_PAGE_ROOT_PROBE_TIMEOUT, options.rootSelectors)
            if (pageRoot) {
              process.stdout.write(`[info] [runtime:relaunch-fallback] route=${route} attempt=${attempt} reason=${error instanceof Error ? error.message : String(error)}\n`)
              return currentPage ?? page
            }
            process.stdout.write(`[info] [runtime:relaunch-current-page] route=${route} attempt=${attempt} current=${currentPage?.path ?? '<none>'} root=<missing>\n`)
          }
        }
        else {
          process.stdout.write(`[info] [runtime:relaunch-current-page] route=${route} attempt=${attempt} current=${currentPage?.path ?? '<none>'}\n`)
        }
      }
      catch {
        // currentPage 在 DevTools 路由切换瞬态可能继续超时，这里直接重启会话。
      }
      await closeUnstableRelaunchSession(miniProgram, options, route, attempt, error)
      throw error
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

async function launchAutomatorViaCliBridge(
  options: AutomatorCliBridgePayload,
  project: string,
  monitor?: ReturnType<typeof createDevtoolsSimulatorBootLogMonitor>,
) {
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
  if (typeof bridgeResult.servicePort === 'number') {
    setRuntimeWechatDevtoolsServicePort(bridgeResult.servicePort)
  }
  process.stdout.write(`[info] [runtime:launch-bridge-step] bootstrap-ready endpoint=${bridgeResult.wsEndpoint} project=${project}\n`)

  const connectStartedAt = Date.now()
  let lastConnectError: unknown
  let miniProgram: any = null
  while (Date.now() - connectStartedAt <= Math.max(12_000, options.timeout ?? 30_000)) {
    try {
      monitor?.assertClean(`connect automator bridge ${bridgeResult.wsEndpoint}`)
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
  const endpointPort = new URL(bridgeResult.wsEndpoint).port
  Reflect.set(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA', {
    port: Number.parseInt(endpointPort, 10),
    projectPath: options.projectPath,
    wsEndpoint: bridgeResult.wsEndpoint,
  })
  await sleep(BRIDGE_CONNECT_SETTLE_DELAY)
  return miniProgram
}

function attachBridgeWrapperSyncCleanup(miniProgram: any, bridgeWrapperProject: BridgeWrapperProject | undefined) {
  if (!bridgeWrapperProject?.stopSync) {
    return miniProgram
  }

  let stopped = false
  const stopSync = () => {
    if (stopped) {
      return
    }
    stopped = true
    bridgeWrapperProject.stopSync?.()
  }

  for (const methodName of ['close', 'disconnect']) {
    const rawMethod = miniProgram?.[methodName]
    if (typeof rawMethod !== 'function') {
      continue
    }

    miniProgram[methodName] = async (...args: any[]) => {
      try {
        return await rawMethod.apply(miniProgram, args)
      }
      finally {
        stopSync()
      }
    }
  }

  return miniProgram
}

export function launchAutomator(options: LaunchAutomatorOptions) {
  const provider = resolveRuntimeProviderName()
  if (provider === 'headless') {
    return launchHeadlessAutomator({
      projectPath: options.projectPath!,
    })
  }
  assertRuntimeProviderImplemented(provider)
  patchNetListenToLoopback()
  patchAutomatorVersionCheck()
  const { disableRelaunchSessionRecovery, projectConfig, skipRelaunchPageRootCheck, skipWarmup, timeout, trustProject, warmupAllowRelaunch, warmupAnyPage, warmupRootSelectors, warmupRoute, ...rest } = options
  const resolvedTrustProject = trustProject ?? isProjectPathTrustedByEnv(rest.projectPath)
  const project = resolveReportProjectPath(rest.projectPath)
  const launchTimeout = timeout ?? 90_000
  const launchAttemptTimeout = Math.max(LAUNCH_ATTEMPT_TIMEOUT, launchTimeout)
  const launchMode = resolveAutomatorLaunchMode()
  const completedRecoverySteps = new Set<string>()
  if (launchMode !== AUTOMATOR_LAUNCH_MODE_BRIDGE) {
    patchMiniProgramOn()
  }
  return (async () => {
    for (let attempt = 1; attempt <= LAUNCH_RETRIES; attempt += 1) {
      let miniProgram: any = null
      let bridgeWrapperProject: BridgeWrapperProject | undefined
      try {
        return await runWithTimeout(
          async () => {
            process.stdout.write(`[info] [runtime:launch-step] preflight project=${project}\n`)
            const devtoolsLogMonitor = createDevtoolsSimulatorBootLogMonitor(project)
            const projectMeta = await resolveLaunchProjectMeta(rest.projectPath)
            const resolvedWarmupRoute = typeof warmupRoute === 'string' && warmupRoute.trim()
              ? `/${warmupRoute.trim().replace(LEADING_SLASH_PATTERN, '')}`
              : projectMeta?.warmupRoute
            process.stdout.write(`[info] [runtime:launch-step] preflight-ready project=${project} warmup=${resolvedWarmupRoute ?? '<none>'}\n`)
            const mergedProjectConfig = projectConfig
              ? {
                  libVersion: DEFAULT_LIB_VERSION,
                  ...projectConfig,
                }
              : undefined
            bridgeWrapperProject = launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE
              ? prepareAutomatorBridgeWrapperProject(rest.projectPath, projectMeta)
              : undefined
            const launchProjectPath = bridgeWrapperProject?.path ?? rest.projectPath
            const launchRest = {
              ...rest,
              ...(launchProjectPath ? { projectPath: launchProjectPath } : {}),
            }
            const launchOptions = {
              ...launchRest,
              timeout: launchTimeout,
              trustProject: resolvedTrustProject,
              ...(mergedProjectConfig ? { projectConfig: mergedProjectConfig } : {}),
            }
            const shouldPrebuild = launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE
              ? shouldPrebuildAutomatorBridgeProject()
              : shouldPrebuildAutomatorProject()
            if (shouldPrebuild) {
              await prebuildAutomatorProjectIndex(launchProjectPath, project, {
                cliPath: rest.cliPath,
                cwd: rest.cwd,
              })
            }
            process.stdout.write(`[info] [runtime:launch-step] connect-start mode=${launchMode || 'direct'} project=${project}\n`)
            miniProgram = launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE
              ? await launchAutomatorViaCliBridge(launchOptions, project, devtoolsLogMonitor)
              : await runWithDevtoolsLogMonitor(
                  () => automator.launch(launchOptions),
                  launchTimeout,
                  'connect direct',
                  devtoolsLogMonitor,
                  async (lateMiniProgram) => {
                    try {
                      await lateMiniProgram?.close?.()
                    }
                    catch {
                    }
                  },
                )
            devtoolsLogMonitor.assertClean(`connect ${launchMode || 'direct'}`)
            process.stdout.write(`[info] [runtime:launch-step] connect-ready mode=${launchMode || 'direct'} project=${project}\n`)
            if (launchMode === AUTOMATOR_LAUNCH_MODE_BRIDGE) {
              patchMiniProgramOn()
            }

            const withRuntimeLogs = await enhanceMiniProgramWithRuntimeLogs(miniProgram, project)
            if (!shouldRefreshAutomatorBridgeProjectAfterConnect()) {
              process.stdout.write(`[info] [runtime:launch-step] post-connect-refresh-skip project=${project}\n`)
            }
            else {
              await refreshMiniProgramProjectIndex(launchProjectPath, project, {
                allowCliEngineBuildFallback: true,
                cliPath: rest.cliPath,
                cwd: rest.cwd,
                refreshProject: true,
              })
              await compileMiniProgramProject(withRuntimeLogs, project)
              resetMiniProgramRuntimeLogs(withRuntimeLogs)
            }
            if (resolvedWarmupRoute && !shouldSkipAutomatorWarmup(skipWarmup)) {
              process.stdout.write(`[info] [runtime:launch-step] warmup-start route=${resolvedWarmupRoute} project=${project}\n`)
              await warmupMiniProgramRoute(withRuntimeLogs, resolvedWarmupRoute, project, {
                allowAnyPage: warmupAnyPage,
                allowRelaunch: warmupAllowRelaunch !== false,
                checkDevtoolsLog: devtoolsLogMonitor.assertClean,
                rootSelectors: warmupRootSelectors,
              })
            }
            const withRelaunch = enhanceMiniProgramRelaunch(withRuntimeLogs, {
              checkDevtoolsLog: devtoolsLogMonitor.assertClean,
              cliPath: rest.cliPath,
              cwd: rest.cwd,
              disableSessionRecovery: disableRelaunchSessionRecovery,
              project,
              projectPath: launchProjectPath,
              rootSelectors: warmupRootSelectors,
              skipPageRootCheck: skipRelaunchPageRootCheck,
            })
            return attachBridgeWrapperSyncCleanup(withRelaunch, bridgeWrapperProject)
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
        bridgeWrapperProject?.stopSync?.()
        if (miniProgram) {
          try {
            await miniProgram.close()
          }
          catch {
          }
        }

        if (isWarmupRelaunchTimeoutError(error) || isWarmupPageRootTimeoutError(error)) {
          throw error
        }

        if (attempt < LAUNCH_RETRIES) {
          const recovered = await recoverDevtoolsCompileCache({
            cliPath: rest.cliPath,
            completedSteps: completedRecoverySteps,
            cwd: rest.cwd,
            error,
            project,
          })
          if (recovered) {
            await cleanupDevtoolsProcessStateAfterLaunchFailure(error, project)
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
          await cleanupDevtoolsProcessStateAfterLaunchFailure(error, project)
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
    const loginState = await resolveDevtoolsCliLoginState()
    if (loginState === false) {
      throw createDevtoolsLoginRequiredError('需要重新登录')
    }
    if (loginState === null && resolveAutomatorLaunchMode() !== AUTOMATOR_LAUNCH_MODE_BRIDGE) {
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

export function isDevtoolsSimulatorBootError(error: unknown) {
  const message = extractExecutionErrorText(error) || String(error)
  return isLikelySimulatorBootErrorMessage(message)
}
