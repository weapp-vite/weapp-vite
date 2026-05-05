import { describe, expect, it } from 'vitest'
import {
  resolveCliPlatformRuntime,
  resolveMultiPlatformProjectConfigHint,
} from './build'

describe('loadConfig build helpers', () => {
  it('resolves normalized cli platform runtime state', () => {
    expect(resolveCliPlatformRuntime(' weapp ')).toEqual({
      normalizedCliPlatform: 'weapp',
      isWebRuntime: false,
    })

    expect(resolveCliPlatformRuntime('H5')).toEqual({
      normalizedCliPlatform: 'web',
      isWebRuntime: true,
    })

    expect(resolveCliPlatformRuntime('web')).toEqual({
      normalizedCliPlatform: 'web',
      isWebRuntime: true,
    })

    expect(resolveCliPlatformRuntime(undefined)).toEqual({
      normalizedCliPlatform: undefined,
      isWebRuntime: false,
    })
  })

  it('builds multi-platform project config hint paths', () => {
    expect(resolveMultiPlatformProjectConfigHint('weapp')).toBe('config/weapp/project.config.json')
    expect(resolveMultiPlatformProjectConfigHint('alipay', 'configs')).toBe('configs/alipay/mini.project.json')
    expect(resolveMultiPlatformProjectConfigHint('swan')).toBe('config/swan/project.swan.json')
  })
})
