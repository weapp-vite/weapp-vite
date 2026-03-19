import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../logger'
import { formatPrepareSkipMessage, handlePrepareLifecycleError, isPrepareCommandArgs } from './prepareGuard'

vi.mock('../logger', () => ({
  default: {
    warn: vi.fn(),
  },
}))

describe('prepare guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('detects prepare command args', () => {
    expect(isPrepareCommandArgs(['prepare'])).toBe(true)
    expect(isPrepareCommandArgs(['build'])).toBe(false)
  })

  it('formats prepare skip message', () => {
    expect(formatPrepareSkipMessage(new Error('boom'))).toBe(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：boom',
    )
  })

  it('swallows lifecycle errors for prepare without setting failure exit code', () => {
    process.exitCode = 1

    expect(handlePrepareLifecycleError(['prepare'], new Error('bootstrap failed'))).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：bootstrap failed',
    )
    expect(process.exitCode).toBe(0)
  })

  it('keeps non-prepare errors unhandled', () => {
    process.exitCode = 1

    expect(handlePrepareLifecycleError(['build'], new Error('boom'))).toBe(false)
    expect(logger.warn).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
