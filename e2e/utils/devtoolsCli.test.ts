import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveWechatCliPath } from './devtoolsCli'

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
    expect(resolveWechatCliPath(undefined, 'darwin')).toBe('/Applications/wechatwebdevtools.app/Contents/MacOS/cli')
    expect(resolveWechatCliPath(undefined, 'win32')).toBe('C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat')
  })
})
