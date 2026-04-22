import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.hoisted(() => vi.fn())
const promptWechatIdeLoginRetryMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const createWechatIdeLoginRequiredExitErrorMock = vi.hoisted(() => vi.fn())
const runWithSuspendedSharedInputMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../src/utils', () => ({
  execute: executeMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

vi.mock('../src/i18n', () => ({
  i18nText: (zh: string) => zh,
}))

vi.mock('../src/cli/retry', () => ({
  createWechatIdeLoginRequiredExitError: createWechatIdeLoginRequiredExitErrorMock,
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  promptWechatIdeLoginRetry: promptWechatIdeLoginRetryMock,
}))

vi.mock('../src/cli/inputCoordinator', () => ({
  runWithSuspendedSharedInput: runWithSuspendedSharedInputMock,
}))

describe('runWechatCliWithRetry', () => {
  let originalStdinIsTTY: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CI', '')
    originalStdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true,
    })
    executeMock.mockReset()
    promptWechatIdeLoginRetryMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    createWechatIdeLoginRequiredExitErrorMock.mockReset()
    runWithSuspendedSharedInputMock.mockReset()
    loggerMock.error.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()

    executeMock.mockResolvedValue({ stdout: '', stderr: '' })
    promptWechatIdeLoginRetryMock.mockResolvedValue('cancel')
    isWechatIdeLoginRequiredErrorMock.mockImplementation((error: unknown) => error instanceof Error)
    createWechatIdeLoginRequiredExitErrorMock.mockImplementation(() => new Error('cancelled'))
    runWithSuspendedSharedInputMock.mockImplementation(async (runner: () => Promise<unknown>) => await runner())
  })

  afterEach(() => {
    if (originalStdinIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalStdinIsTTY)
    }
    else {
      delete (process.stdin as any).isTTY
    }
    vi.unstubAllEnvs()
  })

  it('runs wechat cli retry loop inside suspended shared input guard', async () => {
    const loginRequiredError = new Error('需要重新登录')
    executeMock.mockRejectedValueOnce(loginRequiredError).mockResolvedValueOnce({ stdout: '', stderr: '' })
    promptWechatIdeLoginRetryMock.mockResolvedValue('retry')

    const { runWechatCliWithRetry } = await import('../src/cli/run-login')
    await runWechatCliWithRetry('/Applications/wechat-cli', ['compile', '--project', '/project/dist'])

    expect(runWithSuspendedSharedInputMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })
})
