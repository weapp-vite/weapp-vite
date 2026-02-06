import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runMinidevMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())
const promptForCliPathMock = vi.hoisted(() => vi.fn())
const isOperatingSystemSupportedMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))
const mockCwd = '/workspace/project'

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
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
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

  afterEach(() => {
    cwdSpy.mockRestore()
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

  it('delegates open --platform alipay to minidev ide command', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['open', '--platform', 'alipay', '-p', './dist/dev/mp-alipay'])

    expect(runMinidevMock).toHaveBeenCalledWith([
      'ide',
      '--project',
      `${mockCwd}/dist/dev/mp-alipay`,
    ])
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(isOperatingSystemSupportedMock).not.toHaveBeenCalled()
  })

  it('supports --platform=ali style when delegating open to minidev', async () => {
    const { parse } = await loadRunModule()
    runMinidevMock.mockResolvedValue(undefined)

    await parse(['open', '--platform=ali', '-p'])

    expect(runMinidevMock).toHaveBeenCalledWith([
      'ide',
      '--project',
      mockCwd,
    ])
  })
})
