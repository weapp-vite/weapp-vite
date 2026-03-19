import process from 'node:process'
import logger from '../logger'

export function isPrepareCommandArgs(args: string[]) {
  return Array.isArray(args) && args[0] === 'prepare'
}

export function formatPrepareSkipMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `[prepare] 跳过 .weapp-vite 支持文件预生成：${message}`
}

export function handlePrepareLifecycleError(args: string[], error: unknown) {
  if (!isPrepareCommandArgs(args)) {
    return false
  }

  logger.warn(formatPrepareSkipMessage(error))
  process.exitCode = 0
  return true
}
