import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyWechatCliSelection, resolveWechatCliPath, selectWechatE2EInstallation, withWechatE2ESelectionEnvironment } from './devtoolsCli'

describe('DevTools CLI selection', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses explicit selection before environment selection', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' stable-cli ')
    expect(resolveWechatCliPath(' rc-cli ')).toBe('rc-cli')
    expect(resolveWechatCliPath()).toBe('stable-cli')
    expect(resolveWechatCliPath('   ', 'win32')).toBe('stable-cli')
  })

  it('keeps platform defaults when selection is empty', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' ')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', '')
    expect(resolveWechatCliPath(undefined, 'darwin')).toBe('/Applications/wechatwebdevtools.app/Contents/MacOS/cli')
    expect(resolveWechatCliPath(undefined, 'win32')).toBe('C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat')
  })

  it('propagates the selected installation only to this process environment', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' stable-cli ')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'other-cli')
    expect(applyWechatCliSelection()).toBe('stable-cli')
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('stable-cli')
  })

  it('requires explicit E2E selection even when a public CLI override exists', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', '')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'other-cli')
    expect(() => applyWechatCliSelection()).toThrow('需要显式设置')
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('other-cli')
  })
  it.each(['CHANNEL', 'VERSION'])('rejects conflicting legacy and current E2E %s selectors', async (key) => {
    vi.stubEnv(`WEAPP_VITE_E2E_DEVTOOLS_${key}`, key === 'CHANNEL' ? 'stable' : '2.02.1')
    vi.stubEnv(`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_${key}`, key === 'CHANNEL' ? 'nightly' : '2.02.2')
    await expect(selectWechatE2EInstallation()).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
  })
  it.each([false, true])('restores inherited selection after a scoped run (failure=%s)', async (failure) => {
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'original-cli')
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CHANNEL', undefined)
    const run = withWechatE2ESelectionEnvironment(async () => {
      process.env.WEAPP_IDE_CLI_PATH = 'temporary-cli'
      process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL = 'nightly'
      if (failure) {
        throw new Error('fixture failed')
      }
      return 0
    })
    if (failure) {
      await expect(run).rejects.toThrow('fixture failed')
    }
    else {
      expect(await run).toBe(0)
    }
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('original-cli')
    expect(process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL).toBeUndefined()
  })
})
