import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      projectPath: '/tmp/demo',
      trustProject: true,
    })
    expect(runWechatCliWithRetryMock).toHaveBeenCalledWith('/Applications/wechat-cli', [
      'open',
      '--project',
      '/tmp/demo',
      '--trust-project',
    ])
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
