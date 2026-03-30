import net from 'node:net'
import automator from '@weapp-vite/miniprogram-automator'

export interface AutomatorOptions {
  projectPath: string
  timeout?: number
}

const ERROR_STACK_PREFIX_RE = /^at /
const ERROR_PREFIX_RE = /^\[error\]\s*/i
const ERROR_LABEL_PREFIX_RE = /^error\s*:\s*/i
const ERROR_LINE_SPLIT_RE = /\r?\n/
const LOGIN_REQUIRED_CN_RE = /需要重新登录/
const LOGIN_REQUIRED_EN_RE = /need\s+re-?login|re-?login/i
const LOGIN_REQUIRED_CODE_RE = /code\s*[:=]\s*(\d+)/i
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

let localhostListenPatched = false

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

/**
 * @description Extract error text from various error types
 */
function extractErrorText(error: unknown): string {
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
 * @description Check if error is a DevTools HTTP port error
 */
export function isDevtoolsHttpPortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
    || DEVTOOLS_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * @description Check if error is a login required error
 */
export function isAutomatorLoginError(error: unknown): boolean {
  const text = extractErrorText(error)
  if (!text) {
    return false
  }
  return DEVTOOLS_LOGIN_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * @description Format login error for display
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
 * @description Launch automator with default options
 */
export async function launchAutomator(options: AutomatorOptions) {
  patchNetListenToLoopback()
  const { projectPath, timeout = 30_000 } = options

  return automator.launch({
    projectPath,
    timeout,
  })
}
