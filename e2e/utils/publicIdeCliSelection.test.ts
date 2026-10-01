import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertPublicIdeCliSelection } from './publicIdeCliSelection'

const { config, canonicalPath } = vi.hoisted(() => ({
  config: vi.fn(),
  canonicalPath: vi.fn(),
}))
vi.mock('weapp-ide-cli', () => ({ getConfig: config }))
vi.mock('node:fs/promises', () => ({ realpath: canonicalPath }))

describe('public CLI E2E installation selection', () => {
  beforeEach(() => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' selected-cli ')
    config.mockResolvedValue({ cliPath: 'configured-cli' })
    canonicalPath.mockImplementation(async value => value)
  })
  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
  })

  it('rejects implicit selection before reading global configuration', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', '')
    await expect(assertPublicIdeCliSelection()).rejects.toThrow('需要显式设置')
    expect(config).not.toHaveBeenCalled()
    expect(canonicalPath).not.toHaveBeenCalled()
  })

  it('rejects missing public CLI configuration', async () => {
    config.mockResolvedValue({})
    await expect(assertPublicIdeCliSelection()).rejects.toThrow('未配置开发者工具')
    expect(canonicalPath).not.toHaveBeenCalled()
  })

  it('rejects a configured installation different from the selected stable CLI', async () => {
    await expect(assertPublicIdeCliSelection()).rejects.toThrow('已停止启动')
  })

  it('accepts different aliases that resolve to the same selected installation', async () => {
    canonicalPath.mockResolvedValue('same-installation-cli')
    await expect(assertPublicIdeCliSelection()).resolves.toBeUndefined()
    expect(canonicalPath).toHaveBeenCalledWith('selected-cli')
    expect(canonicalPath).toHaveBeenCalledWith('configured-cli')
  })

  it('fails when an installation cannot be resolved instead of falling back', async () => {
    canonicalPath.mockRejectedValue(new Error('unavailable installation'))
    await expect(assertPublicIdeCliSelection()).rejects.toThrow('unavailable installation')
  })
})
