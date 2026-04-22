import process from 'node:process'
import { i18nText } from '../i18n'
import { colors } from '../logger'
import { waitForExclusiveKeypress } from './inputCoordinator'

export interface RetryKeypressOptions {
  timeoutMs?: number
}

export interface RetryPromptOptions extends RetryKeypressOptions {
  logger: {
    info: (message: string) => void
  }
}

export interface RetryLogger {
  error: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
}

export interface WechatIdeLoginRetryOptions {
  allowRetry?: boolean
  cancelLevel?: 'info' | 'warn'
  error: unknown
  logger: RetryLogger
  promptOpenIdeLogin?: boolean
  retryTimeoutMs?: number
}

export type RetryPromptResult = 'retry' | 'cancel' | 'timeout'

export const RETRY_PROMPT_INITIAL_IGNORE_MS = 300

const LOGIN_REQUIRED_PATTERNS = [
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]

interface ExecErrorLike {
  message?: unknown
  shortMessage?: unknown
  stderr?: unknown
  stdout?: unknown
}

/**
 * @description 提取执行错误文本，便于统一匹配与提示。
 */
export function extractExecutionErrorText(error: unknown) {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const parts: string[] = []
  const candidate = error as ExecErrorLike

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

/**
 * @description 判断是否为微信开发者工具登录失效错误。
 */
export function isWechatIdeLoginRequiredError(error: unknown) {
  const text = extractExecutionErrorText(error)
  if (!text) {
    return false
  }
  return LOGIN_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * @description 将登录失效错误格式化为更易读的摘要。
 */
export function formatWechatIdeLoginRequiredError(error: unknown) {
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

/**
 * @description 创建登录失效专用错误，并携带退出码语义。
 */
export function createWechatIdeLoginRequiredExitError(error: unknown, reason?: string) {
  const summary = formatWechatIdeLoginRequiredError(error)
  const message = reason ? `${reason}\n${summary}` : summary
  const loginError = new Error(message) as Error & {
    code: number
    exitCode: number
  }

  loginError.name = 'WechatIdeLoginRequiredError'
  loginError.code = 10
  loginError.exitCode = 10

  return loginError
}

/**
 * @description 交互等待用户按键重试，按 r 重试，按 q 或 Ctrl+C 取消。
 */
export async function waitForRetryKeypress(options: RetryKeypressOptions = {}) {
  const { timeoutMs = 30_000 } = options

  if (!process.stdin.isTTY) {
    return 'cancel' as const
  }

  return await waitForExclusiveKeypress<RetryPromptResult>({
    ignoreInitialMs: RETRY_PROMPT_INITIAL_IGNORE_MS,
    onKeypress: (_str, key) => {
      if (!key) {
        return
      }

      if (key.ctrl && key.name === 'c') {
        return 'cancel'
      }

      if (key.name === 'r') {
        return 'retry'
      }

      if (key.name === 'q' || key.name === 'escape') {
        return 'cancel'
      }
    },
    timeoutMs,
  })
}

function highlightHotkey(key: string) {
  return colors.bold(colors.green(key))
}

/**
 * @description 生成重试按键提示，并高亮关键热键。
 */
export function formatRetryHotkeyPrompt(timeoutMs = 30_000) {
  const highlight = (key: string) => highlightHotkey(key)
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000))
  return i18nText(
    `按 ${highlight('r')} 重试，按 ${highlight('q')} / ${highlight('Esc')} / ${highlight('Ctrl+C')} 退出（${timeoutSeconds}s 内无输入将自动失败）。`,
    `Press ${highlight('r')} to retry, ${highlight('q')} / ${highlight('Esc')} / ${highlight('Ctrl+C')} to cancel (auto fail in ${timeoutSeconds}s).`,
  )
}

/**
 * @description 输出重试热键提示，并独占等待当前提示对应的按键输入。
 */
export async function promptRetryKeypress(options: RetryPromptOptions) {
  const { logger, timeoutMs = 30_000 } = options
  logger.info(formatRetryHotkeyPrompt(timeoutMs))
  return await waitForRetryKeypress({ timeoutMs })
}

/**
 * @description 统一处理微信开发者工具登录失效场景下的提示与重试交互。
 */
export async function promptWechatIdeLoginRetry(options: WechatIdeLoginRetryOptions) {
  const {
    allowRetry = true,
    cancelLevel = 'info',
    error,
    logger,
    promptOpenIdeLogin = false,
    retryTimeoutMs = 30_000,
  } = options

  logger.error(i18nText(
    '检测到微信开发者工具登录状态失效，请先登录后重试。',
    'Wechat DevTools login has expired. Please login and retry.',
  ))

  if (promptOpenIdeLogin) {
    logger.warn(i18nText(
      '请先打开微信开发者工具完成登录。',
      'Please open Wechat DevTools and complete login first.',
    ))
  }

  logger.warn(formatWechatIdeLoginRequiredError(error))

  if (!allowRetry) {
    return 'cancel' as const
  }

  const action = await promptRetryKeypress({
    logger,
    timeoutMs: retryTimeoutMs,
  })

  if (action === 'timeout') {
    logger.error(i18nText(
      `等待登录重试输入超时（${retryTimeoutMs}ms），已自动取消。`,
      `Retry prompt timed out (${retryTimeoutMs}ms), canceled automatically.`,
    ))
    return 'cancel' as const
  }

  if (action !== 'retry') {
    logger[cancelLevel](i18nText(
      '已取消重试。完成登录后请重新执行当前命令。',
      'Retry canceled. Please run the command again after login.',
    ))
    return 'cancel' as const
  }

  return 'retry' as const
}
