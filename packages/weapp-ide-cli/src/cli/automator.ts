import automator from 'miniprogram-automator'

export interface AutomatorOptions {
  projectPath: string
  timeout?: number
}

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

/**
 * @description Launch automator with default options
 */
export async function launchAutomator(options: AutomatorOptions) {
  const { projectPath, timeout = 30_000 } = options

  return automator.launch({
    projectPath,
    timeout,
  })
}
