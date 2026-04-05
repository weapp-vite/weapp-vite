import { Launcher } from '@weapp-vite/miniprogram-automator'
import { resolveCliPath } from './resolver'

export interface AutomatorOptions {
  projectPath: string
  timeout?: number
  cliPath?: string
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
  const launcher = new Launcher()
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await launcher.launch({
        cliPath: resolvedCliPath,
        projectPath,
        timeout,
      })
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
