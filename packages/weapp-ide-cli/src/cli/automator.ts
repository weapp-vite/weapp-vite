import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Launcher } from '@weapp-vite/miniprogram-automator'
import { readCustomConfig } from '../config/custom'
import { resolveCliPath } from './resolver'
import { bootstrapWechatDevtoolsSettings } from './wechatDevtoolsSettings'

export interface AutomatorOptions {
  projectPath: string
  timeout?: number
  cliPath?: string
  trustProject?: boolean
  preferOpenedSession?: boolean
}

interface PersistedAutomatorSession {
  projectPath: string
  updatedAt: string
  wsEndpoint: string
}

const ERROR_STACK_PREFIX_RE = /^at /
const ERROR_PREFIX_RE = /^\[error\]\s*/i
const ERROR_LABEL_PREFIX_RE = /^error\s*:\s*/i
const ERROR_LINE_SPLIT_RE = /\r?\n/
const LOGIN_REQUIRED_CN_RE = /需要重新登录/
const LOGIN_REQUIRED_EN_RE = /need\s+re-?login|re-?login/i
const LOGIN_REQUIRED_CODE_RE = /code\s*[:=]\s*(\d+)/i
const DEVTOOLS_HTTP_PORT_ERROR = 'Failed to launch wechat web devTools, please make sure http port is open'
const DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
const AUTOMATOR_LAUNCH_TIMEOUT_RE = /Wait timed out after \d+ ms/i
const AUTOMATOR_WS_CONNECT_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+/i
const DEVTOOLS_PROTOCOL_TIMEOUT_RE = /DevTools did not respond to protocol method (\S+) within \d+ms/i
const DEVTOOLS_INFRA_ERROR_PATTERNS = [
  /listen EPERM/i,
  /operation not permitted 0\.0\.0\.0/i,
  /EACCES/i,
  /ECONNREFUSED/i,
  /connect ECONNREFUSED/i,
]
const DEFAULT_WECHAT_DEVTOOLS_WS_ENDPOINT = 'ws://127.0.0.1:9420'
const AUTOMATOR_SESSION_DIR = path.join(os.tmpdir(), 'weapp-vite-automator-sessions')
const DEVTOOLS_LOGIN_REQUIRED_PATTERNS = [
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]

/**
 * @description 从错误对象中提取可读文本。
 */
function extractErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const candidate = error as {
    message?: unknown
    shortMessage?: unknown
    stderr?: unknown
    stdout?: unknown
  }

  return [
    candidate.message,
    candidate.shortMessage,
    candidate.stderr,
    candidate.stdout,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
}

function resolveAutomatorSessionFilePath(projectPath: string) {
  const normalizedProjectPath = path.resolve(projectPath)
  const encodedProjectPath = Buffer.from(normalizedProjectPath).toString('base64url')
  return path.join(AUTOMATOR_SESSION_DIR, `${encodedProjectPath}.json`)
}

async function persistAutomatorSession(projectPath: string, wsEndpoint: string) {
  const filePath = resolveAutomatorSessionFilePath(projectPath)
  const payload: PersistedAutomatorSession = {
    projectPath: path.resolve(projectPath),
    updatedAt: new Date().toISOString(),
    wsEndpoint,
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

async function readPersistedAutomatorSession(projectPath: string) {
  const filePath = resolveAutomatorSessionFilePath(projectPath)

  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const payload = JSON.parse(raw) as Partial<PersistedAutomatorSession>
    if (payload.projectPath !== path.resolve(projectPath) || typeof payload.wsEndpoint !== 'string' || !payload.wsEndpoint.trim()) {
      return null
    }
    return payload as PersistedAutomatorSession
  }
  catch {
    return null
  }
}

async function removePersistedAutomatorSession(projectPath: string) {
  const filePath = resolveAutomatorSessionFilePath(projectPath)

  try {
    await fs.rm(filePath, { force: true })
  }
  catch {
  }
}

/**
 * @description 提取登录失效时最适合展示给用户的一行信息。
 */
function extractLoginRequiredMessage(text: string): string {
  if (!text) {
    return ''
  }

  if (LOGIN_REQUIRED_CN_RE.test(text)) {
    return '需要重新登录'
  }

  const englishMatch = text.match(LOGIN_REQUIRED_EN_RE)
  if (englishMatch?.[0]) {
    return englishMatch[0].toLowerCase()
  }

  const firstLine = text
    .split(ERROR_LINE_SPLIT_RE)
    .map(line => line.trim())
    .find(line => Boolean(line) && !ERROR_STACK_PREFIX_RE.test(line))

  if (!firstLine) {
    return ''
  }

  return firstLine
    .replace(ERROR_PREFIX_RE, '')
    .replace(ERROR_LABEL_PREFIX_RE, '')
    .slice(0, 120)
}

/**
 * @description 判断错误是否属于开发者工具服务端口不可用。
 */
export function isDevtoolsHttpPortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
    || DEVTOOLS_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * @description 判断错误是否属于开发者工具 automator 扩展上下文尚未就绪。
 */
export function isDevtoolsExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE.test(message)
}

/**
 * @description 判断错误是否属于可重试的 automator 启动抖动。
 */
export function isRetryableAutomatorLaunchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE.test(message)
    || AUTOMATOR_LAUNCH_TIMEOUT_RE.test(message)
    || AUTOMATOR_WS_CONNECT_RE.test(message)
}

/**
 * @description 判断错误是否属于开发者工具 websocket 连接失败。
 */
export function isAutomatorWsConnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return AUTOMATOR_WS_CONNECT_RE.test(message)
}

/**
 * @description 判断错误是否属于开发者工具协议调用超时。
 */
export function isAutomatorProtocolTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_PROTOCOL_TIMEOUT_RE.test(message)
}

/**
 * @description 提取协议超时的方法名。
 */
export function getAutomatorProtocolTimeoutMethod(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error)
  return message.match(DEVTOOLS_PROTOCOL_TIMEOUT_RE)?.[1]
}

/**
 * @description 判断错误是否属于开发者工具登录失效。
 */
export function isAutomatorLoginError(error: unknown): boolean {
  const text = extractErrorText(error)
  if (!text) {
    return false
  }

  return DEVTOOLS_LOGIN_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * @description 格式化开发者工具登录失效错误，便于终端展示。
 */
export function formatAutomatorLoginError(error: unknown): string {
  const text = extractErrorText(error)
  const code = text.match(LOGIN_REQUIRED_CODE_RE)?.[1]
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

/**
 * @description 基于当前配置解析 CLI 路径，并通过现代化 automator 入口启动会话。
 */
export async function launchAutomator(options: AutomatorOptions) {
  const { cliPath, projectPath, timeout = 30_000 } = options
  const resolvedCliPath = cliPath ?? (await resolveCliPath()).cliPath ?? undefined
  const config = await readCustomConfig()
  const resolvedTrustProject = options.trustProject ?? config.autoTrustProject ?? false
  const launcher = new Launcher()
  let lastError: unknown = null

  if (config.autoBootstrapDevtools !== false) {
    await bootstrapWechatDevtoolsSettings({
      projectPath,
      trustProject: resolvedTrustProject,
    })
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const miniProgram = await launcher.launch({
        cliPath: resolvedCliPath,
        projectPath,
        timeout,
        trustProject: resolvedTrustProject,
      })
      const sessionMetadata = Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as { wsEndpoint?: string } | undefined
      if (typeof sessionMetadata?.wsEndpoint === 'string' && sessionMetadata.wsEndpoint) {
        await persistAutomatorSession(projectPath, sessionMetadata.wsEndpoint)
      }
      return miniProgram
    }
    catch (error) {
      lastError = error
      if (!isRetryableAutomatorLaunchError(error) || attempt === 1) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * @description 连接当前项目已打开的开发者工具自动化会话，不触发新的 IDE 拉起。
 */
export async function connectOpenedAutomator(options: AutomatorOptions) {
  const { projectPath } = options
  const launcher = new Launcher()
  const persistedSession = await readPersistedAutomatorSession(projectPath)
  const wsEndpoint = persistedSession?.wsEndpoint ?? DEFAULT_WECHAT_DEVTOOLS_WS_ENDPOINT

  try {
    return await launcher.connect({ wsEndpoint })
  }
  catch (error) {
    if (persistedSession) {
      await removePersistedAutomatorSession(projectPath)
    }
    throw error
  }
}
