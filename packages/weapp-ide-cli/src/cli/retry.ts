import process from 'node:process'
import { emitKeypressEvents } from 'node:readline'

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

/**
 * @description 交互等待用户按键重试，按 r 重试，按 q 或 Ctrl+C 取消。
 */
export async function waitForRetryKeypress() {
  if (!process.stdin.isTTY) {
    return false
  }

  emitKeypressEvents(process.stdin)

  const hasSetRawMode = typeof process.stdin.setRawMode === 'function'
  if (hasSetRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  return new Promise<boolean>((resolve) => {
    const cleanup = () => {
      process.stdin.off('keypress', onKeypress)
      if (hasSetRawMode) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    }

    const done = (value: boolean) => {
      cleanup()
      resolve(value)
    }

    const onKeypress = (_str: string, key: { name?: string, ctrl?: boolean } | undefined) => {
      if (!key) {
        return
      }

      if (key.ctrl && key.name === 'c') {
        done(false)
        return
      }

      if (key.name === 'r') {
        done(true)
        return
      }

      if (key.name === 'q' || key.name === 'escape') {
        done(false)
      }
    }

    process.stdin.on('keypress', onKeypress)
  })
}
