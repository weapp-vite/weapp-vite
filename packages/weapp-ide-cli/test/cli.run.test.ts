import { beforeEach, describe, expect, it, vi } from 'vitest'

const runMinidevMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())
const promptForCliPathMock = vi.hoisted(() => vi.fn())
const isOperatingSystemSupportedMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../src/cli/minidev', () => ({
  runMinidev: runMinidevMock,
}))

vi.mock('../src/cli/resolver', () => ({
  resolveCliPath: resolveCliPathMock,
}))

vi.mock('../src/cli/prompt', () => ({
  promptForCliPath: promptForCliPathMock,
}))

vi.mock('../src/runtime/platform', () => ({
  isOperatingSystemSupported: isOperatingSystemSupportedMock,
  operatingSystemName: 'Darwin',
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

async function loadRunModule() {
  return import('../src/cli/run')
}

describe('cli parsing', () => {
  beforeEach(() => {
    vi.resetModules()
    runMinidevMock.mockReset()
    resolveCliPathMock.mockReset()
    promptForCliPathMock.mockReset()
    loggerMock.log.mockReset()
    loggerMock.warn.mockReset()
    loggerMock.error.mockReset()
    isOperatingSystemSupportedMock.mockReset()
    isOperatingSystemSupportedMock.mockReturnValue(true)
    resolveCliPathMock.mockResolvedValue({
      cliPath: '/Applications/wechat-cli',
      source: 'default',
    })
  })

  it('delegates alipay namespace to minidev runner', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['alipay', 'login'])

    expect(runMinidevMock).toHaveBeenCalledWith(['login'])
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(isOperatingSystemSupportedMock).not.toHaveBeenCalled()
  })

  it('supports ali alias for minidev runner', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['ali', 'open'])

    expect(runMinidevMock).toHaveBeenCalledWith(['open'])
  })
})
