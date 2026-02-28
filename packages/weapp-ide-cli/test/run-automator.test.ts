import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const commandMocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  navigateBack: vi.fn(),
  reLaunch: vi.fn(),
  switchTab: vi.fn(),
  pageStack: vi.fn(),
  currentPage: vi.fn(),
  systemInfo: vi.fn(),
  pageData: vi.fn(),
  tap: vi.fn(),
  input: vi.fn(),
  scrollTo: vi.fn(),
  audit: vi.fn(),
  remote: vi.fn(),
}))

const runScreenshotMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('../src/cli/commands', () => commandMocks)
vi.mock('../src/cli/screenshot', () => ({
  runScreenshot: runScreenshotMock,
}))
vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

async function loadModule() {
  return import('../src/cli/run-automator')
}

describe('run-automator', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.resetModules()
    const { setLocale } = await import('../src/i18n')
    setLocale('zh')
    Object.values(commandMocks).forEach((mockFn) => {
      mockFn.mockReset()
      mockFn.mockResolvedValue(undefined)
    })
    runScreenshotMock.mockReset()
    runScreenshotMock.mockResolvedValue(undefined)
    loggerMock.warn.mockReset()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('recognizes automator commands', async () => {
    const { isAutomatorCommand } = await loadModule()
    expect(isAutomatorCommand('navigate')).toBe(true)
    expect(isAutomatorCommand('remote')).toBe(true)
    expect(isAutomatorCommand('open')).toBe(false)
  })

  it('delegates screenshot command', async () => {
    const { runAutomatorCommand } = await loadModule()

    await runAutomatorCommand('screenshot', ['-p', '/tmp/demo'])

    expect(runScreenshotMock).toHaveBeenCalledWith(['-p', '/tmp/demo'])
  })

  it('parses navigate arguments and calls navigateTo', async () => {
    const { runAutomatorCommand } = await loadModule()

    await runAutomatorCommand('navigate', ['pages/detail/index', '-p', '/tmp/demo', '--timeout', '5000'])

    expect(commandMocks.navigateTo).toHaveBeenCalledWith({
      json: false,
      positionals: ['pages/detail/index'],
      projectPath: '/tmp/demo',
      timeout: 5000,
      url: 'pages/detail/index',
    })
  })

  it('supports help output without running command', async () => {
    const { runAutomatorCommand } = await loadModule()

    await runAutomatorCommand('navigate', ['--help'])

    expect(commandMocks.navigateTo).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: weapp navigate <url> -p <project-path>'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('参数：'))
  })

  it('throws when required input args are missing', async () => {
    const { runAutomatorCommand } = await loadModule()

    await expect(runAutomatorCommand('input', ['.selector'])).rejects.toThrow('input 命令缺少 selector 或 value 参数')
    expect(commandMocks.input).not.toHaveBeenCalled()
  })

  it('passes audit output path from both short and long options', async () => {
    const { runAutomatorCommand } = await loadModule()

    await runAutomatorCommand('audit', ['-o', '/tmp/audit-short.json'])
    await runAutomatorCommand('audit', ['--output=/tmp/audit-long.json'])

    expect(commandMocks.audit).toHaveBeenNthCalledWith(1, {
      json: false,
      positionals: [],
      projectPath: process.cwd(),
      timeout: undefined,
      outputPath: '/tmp/audit-short.json',
    })

    expect(commandMocks.audit).toHaveBeenNthCalledWith(2, {
      json: false,
      positionals: [],
      projectPath: process.cwd(),
      timeout: undefined,
      outputPath: '/tmp/audit-long.json',
    })
  })

  it('maps remote --disable to enable=false', async () => {
    const { runAutomatorCommand } = await loadModule()

    await runAutomatorCommand('remote', ['--disable'])

    expect(commandMocks.remote).toHaveBeenCalledWith({
      enable: false,
      json: false,
      positionals: [],
      projectPath: process.cwd(),
      timeout: undefined,
    })
  })

  it('rejects unsupported command options', async () => {
    const { runAutomatorCommand } = await loadModule()

    await expect(runAutomatorCommand('remote', ['--unknown'])).rejects.toThrow(
      '\'remote\' 命令不支持参数 \'--unknown\'',
    )
    expect(commandMocks.remote).not.toHaveBeenCalled()
  })

  it('prints english help when locale is en', async () => {
    const { runAutomatorCommand } = await loadModule()
    const { setLocale } = await import('../src/i18n')
    setLocale('en')

    await runAutomatorCommand('navigate', ['--help'])

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Navigate to a page'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Options:'))
  })
})
