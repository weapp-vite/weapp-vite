import process from 'node:process'
import logger from '../logger'

const watchLimitErrorCodes = new Set(['EMFILE', 'ENOSPC'])
const watchLimitMessagePattern = /(?:EMFILE|ENOSPC|unable to start FSEvent stream)/i

export function findWatchLimitErrorCode(error: unknown): string | undefined {
  const visited = new Set<unknown>()

  const visit = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') {
      return undefined
    }
    if (visited.has(value)) {
      return undefined
    }
    visited.add(value)

    const maybeError = value as {
      code?: unknown
      message?: unknown
      cause?: unknown
      error?: unknown
      errors?: unknown
    }

    if (typeof maybeError.code === 'string' && watchLimitErrorCodes.has(maybeError.code)) {
      return maybeError.code
    }

    if (typeof maybeError.message === 'string' && watchLimitMessagePattern.test(maybeError.message)) {
      const match = maybeError.message.match(/EMFILE|ENOSPC/i)
      if (match?.[0]) {
        return match[0].toUpperCase()
      }
      return 'EMFILE'
    }

    if (Array.isArray(maybeError.errors)) {
      for (const item of maybeError.errors) {
        const found = visit(item)
        if (found) {
          return found
        }
      }
    }

    const fromError = visit(maybeError.error)
    if (fromError) {
      return fromError
    }

    return visit(maybeError.cause)
  }

  return visit(error)
}

export function handleCLIError(error: unknown) {
  const code = findWatchLimitErrorCode(error)
  if (code) {
    const tip = process.platform === 'darwin'
      ? '可先执行 `ulimit -n 65536` 后重试。'
      : '请提高系统文件描述符上限后重试。'
    logger.error(`[监听] 文件监听数量达到上限 (${code})，${tip}`)
    return
  }

  logger.error(error)
}

