import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}))
const colorsMock = vi.hoisted(() => ({
  green: vi.fn((value: string) => value),
}))

vi.mock('../src/utils', () => ({
  execute: executeMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: colorsMock,
}))

async function loadMinidevModule() {
  return import('../src/cli/minidev')
}

describe('minidev runner', () => {
  beforeEach(() => {
    vi.resetModules()
    executeMock.mockReset()
    loggerMock.log.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.info.mockReset()
    loggerMock.error.mockReset()
    colorsMock.green.mockClear()
  })

  it('delegates to minidev executable with provided arguments', async () => {
    executeMock.mockResolvedValue(undefined)
    const { runMinidev } = await loadMinidevModule()

    await runMinidev(['login', '--quiet'])

    expect(executeMock).toHaveBeenCalledWith('minidev', ['login', '--quiet'])
  })

  it('informs user to install minidev when command missing', async () => {
    const missingBinaryError = Object.assign(new Error('spawn ENOENT'), {
      code: 'ENOENT',
    })
    executeMock.mockRejectedValueOnce(missingBinaryError)

    const { runMinidev } = await loadMinidevModule()

    await expect(runMinidev(['login'])).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith('未检测到支付宝小程序 CLI：minidev')
    expect(loggerMock.warn).toHaveBeenCalledWith('请先安装 minidev，可使用以下任一命令：')
  })

  it('rethrows unexpected execution errors', async () => {
    const failure = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    })
    executeMock.mockRejectedValueOnce(failure)

    const { runMinidev } = await loadMinidevModule()

    await expect(runMinidev(['login'])).rejects.toBe(failure)
  })
})
