import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const waitForExclusiveKeypressMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/inputCoordinator', () => ({
  waitForExclusiveKeypress: waitForExclusiveKeypressMock,
}))

vi.mock('../src/logger', () => ({
  colors: {
    bold: (value: string) => value,
    green: (value: string) => value,
  },
}))

describe('retry interaction helpers', () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
  let originalStdinIsTTY: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.resetModules()
    originalStdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    })
    waitForExclusiveKeypressMock.mockReset()
    logger.error.mockReset()
    logger.info.mockReset()
    logger.warn.mockReset()
  })

  afterEach(() => {
    if (originalStdinIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalStdinIsTTY)
    }
    else {
      delete (process.stdin as any).isTTY
    }
  })

  it('logs login-required details and retries when user confirms', async () => {
    waitForExclusiveKeypressMock.mockResolvedValue('retry')
    const { promptWechatIdeLoginRetry, RETRY_PROMPT_INITIAL_IGNORE_MS } = await import('../src/cli/retry')
    const error = new Error('需要重新登录 (code 10)')

    const result = await promptWechatIdeLoginRetry({
      error,
      logger,
      promptOpenIdeLogin: true,
      retryTimeoutMs: 1234,
    })

    expect(result).toBe('retry')
    expect(logger.error).toHaveBeenCalledWith('检测到微信开发者工具登录状态失效，请先登录后重试。')
    expect(logger.warn).toHaveBeenCalledWith('请先打开微信开发者工具完成登录。')
    expect(logger.warn).toHaveBeenCalledWith('微信开发者工具返回登录错误：\n- message: 需要重新登录')
    expect(logger.info).toHaveBeenCalledWith('按 Enter 重试，按 q / Esc / Ctrl+C 退出（2s 内无输入将自动失败）。')
    expect(waitForExclusiveKeypressMock).toHaveBeenCalledWith({
      ignoreInitialMs: RETRY_PROMPT_INITIAL_IGNORE_MS,
      onKeypress: expect.any(Function),
      timeoutMs: 1234,
    })
  })

  it('skips interactive retry when retry is disabled', async () => {
    const { promptWechatIdeLoginRetry } = await import('../src/cli/retry')

    const result = await promptWechatIdeLoginRetry({
      allowRetry: false,
      error: new Error('需要重新登录 (code 10)'),
      logger,
      promptOpenIdeLogin: true,
    })

    expect(result).toBe('cancel')
    expect(waitForExclusiveKeypressMock).not.toHaveBeenCalled()
  })

  it('logs timeout as error and returns cancel', async () => {
    waitForExclusiveKeypressMock.mockResolvedValue('timeout')
    const { promptWechatIdeLoginRetry } = await import('../src/cli/retry')

    const result = await promptWechatIdeLoginRetry({
      error: new Error('需要重新登录 (code 10)'),
      logger,
      retryTimeoutMs: 4321,
    })

    expect(result).toBe('cancel')
    expect(logger.error).toHaveBeenNthCalledWith(2, '等待登录重试输入超时（4321ms），已自动取消。')
  })

  it('uses warn level when cancelLevel is warn', async () => {
    waitForExclusiveKeypressMock.mockResolvedValue('cancel')
    const { promptWechatIdeLoginRetry } = await import('../src/cli/retry')

    const result = await promptWechatIdeLoginRetry({
      cancelLevel: 'warn',
      error: new Error('需要重新登录 (code 10)'),
      logger,
    })

    expect(result).toBe('cancel')
    expect(logger.warn).toHaveBeenCalledWith('已取消重试。完成登录后请重新执行当前命令。')
  })
})
