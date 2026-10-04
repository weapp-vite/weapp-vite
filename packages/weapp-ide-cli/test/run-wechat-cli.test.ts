import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => run() }))

const selectedTarget = vi.hoisted(() => ({ cliPath: '/Applications/wechat-cli', installationId: 'selected', appPath: '/Applications/app.asar', profileDir: '/tmp/selected-profile' }))
const hostGuard = vi.hoisted(() => vi.fn())
vi.mock('../src/devtoolsTarget', () => ({
  resolveWechatDevtoolsTarget: vi.fn(async () => selectedTarget),
  assertWechatDevtoolsHost: hostGuard,
}))

const resolveCliPathMock = vi.hoisted(() => vi.fn())
const promptForCliPathMock = vi.hoisted(() => vi.fn())
const isOperatingSystemSupportedMock = vi.hoisted(() => vi.fn())
const readCustomConfigMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())
const runWechatCliWithRetryMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
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

vi.mock('../src/config/custom', () => ({
  readCustomConfig: readCustomConfigMock,
}))

vi.mock('../src/cli/wechatDevtoolsSettings', () => ({
  bootstrapWechatDevtoolsSettings: bootstrapWechatDevtoolsSettingsMock,
}))

vi.mock('../src/cli/run-login', () => ({
  runWechatCliWithRetry: runWechatCliWithRetryMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: {
    bold: (value: string) => value,
    green: (value: string) => value,
  },
}))

describe('runWechatCliCommand', () => {
  beforeEach(() => {
    hostGuard.mockReset().mockResolvedValue(undefined)
    resolveCliPathMock.mockReset()
    promptForCliPathMock.mockReset()
    isOperatingSystemSupportedMock.mockReset()
    readCustomConfigMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    runWechatCliWithRetryMock.mockReset()
    loggerMock.error.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()

    isOperatingSystemSupportedMock.mockReturnValue(true)
    resolveCliPathMock.mockResolvedValue({
      cliPath: '/Applications/wechat-cli',
      source: 'default',
    })
    readCustomConfigMock.mockResolvedValue({})
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValue(undefined)
    runWechatCliWithRetryMock.mockResolvedValue(undefined)
  })

  it('bootstraps devtools settings before executing open command', async () => {
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')

    await runWechatCliCommand(['open', '--project', '/tmp/demo', '--trust-project'])

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      target: selectedTarget,
      projectPath: '/tmp/demo',
      trustProject: true,
    })
    expect(runWechatCliWithRetryMock).toHaveBeenCalledWith('/Applications/wechat-cli', [
      'open',
      '--project',
      '/tmp/demo',
      '--trust-project',
    ], { target: selectedTarget })
  })

  it('opens the target project before auto-preview so devtools is foregrounded', async () => {
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')

    await runWechatCliCommand([
      'auto-preview',
      '--project',
      '/tmp/demo',
      '--info-output',
      '/tmp/auto-preview.json',
    ])

    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
      target: selectedTarget,
      projectPath: '/tmp/demo',
      trustProject: false,
    })
    expect(runWechatCliWithRetryMock).toHaveBeenNthCalledWith(1, '/Applications/wechat-cli', [
      'open',
      '--project',
      '/tmp/demo',
    ], { target: selectedTarget })
    expect(runWechatCliWithRetryMock).toHaveBeenNthCalledWith(2, '/Applications/wechat-cli', [
      'auto-preview',
      '--project',
      '/tmp/demo',
      '--info-output',
      '/tmp/auto-preview.json',
    ], { target: selectedTarget })
  })

  it('passes configured project trust to the auto-preview foreground open command', async () => {
    readCustomConfigMock.mockResolvedValueOnce({
      autoTrustProject: true,
    })
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')

    await runWechatCliCommand(['auto-preview', '--appid', 'wx123', '--ext-appid', 'wx456'])

    expect(runWechatCliWithRetryMock).toHaveBeenNthCalledWith(1, '/Applications/wechat-cli', [
      'open',
      '--appid',
      'wx123',
      '--ext-appid',
      'wx456',
      '--trust-project',
    ], { target: selectedTarget })
    expect(runWechatCliWithRetryMock).toHaveBeenNthCalledWith(2, '/Applications/wechat-cli', [
      'auto-preview',
      '--appid',
      'wx123',
      '--ext-appid',
      'wx456',
    ], { target: selectedTarget })
  })

  it('stops before bootstrap or execution when another installation owns the host', async () => {
    hostGuard.mockRejectedValue(new Error('DEVTOOLS_INSTALLATION_MISMATCH'))
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')
    await expect(runWechatCliCommand(['open'])).rejects.toThrow('DEVTOOLS_INSTALLATION_MISMATCH')
    expect(bootstrapWechatDevtoolsSettingsMock).not.toHaveBeenCalled()
    expect(runWechatCliWithRetryMock).not.toHaveBeenCalled()
  })

  it('keeps the resolved target even when the global selection is unavailable', async () => {
    resolveCliPathMock.mockRejectedValue(new Error('global selection is unavailable'))
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')
    await runWechatCliCommand(['open'], { target: selectedTarget })
    expect(resolveCliPathMock).not.toHaveBeenCalled()
    expect(promptForCliPathMock).not.toHaveBeenCalled()
    expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ target: selectedTarget }))
    expect(runWechatCliWithRetryMock).toHaveBeenCalledWith(selectedTarget.cliPath, ['open'], { target: selectedTarget })
  })

  it('prompts for cli path when resolver returns missing', async () => {
    resolveCliPathMock.mockResolvedValueOnce({
      cliPath: '',
      source: 'missing',
    })
    const { runWechatCliCommand } = await import('../src/cli/run-wechat-cli')

    await runWechatCliCommand(['open'])

    expect(promptForCliPathMock).toHaveBeenCalledTimes(1)
    expect(runWechatCliWithRetryMock).not.toHaveBeenCalled()
  })
})
