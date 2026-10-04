import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyWechatCliSelection, resolveWechatCliPath } from './devtoolsCli'

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
})
