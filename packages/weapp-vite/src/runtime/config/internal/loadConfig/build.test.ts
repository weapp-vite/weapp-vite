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
      normalizedCliPlatform: 'h5',
      isWebRuntime: true,
    })

    expect(resolveCliPlatformRuntime(undefined)).toEqual({
      normalizedCliPlatform: undefined,
      isWebRuntime: false,
    })
  })

  it('builds multi-platform project config hint paths', () => {
    expect(resolveMultiPlatformProjectConfigHint('weapp')).toBe('config/weapp/project.config.weapp.json')
    expect(resolveMultiPlatformProjectConfigHint('alipay', 'configs')).toBe('configs/alipay/project.config.alipay.json')
  })
})
