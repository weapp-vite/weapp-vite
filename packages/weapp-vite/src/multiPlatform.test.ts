import { describe, expect, it } from 'vitest'
import { resolveMultiPlatformConfig, supportsMultiPlatformTarget } from './multiPlatform'
import { getSupportedMiniProgramPlatforms } from './platform'

const projectConfigs = Object.freeze({
  xhs: Object.freeze({ appid: 'xhs-app', setting: { urlCheck: false } }),
  weapp: Object.freeze({ appid: 'wx-app' }),
})

describe('inline multi-platform project configs', () => {
  it('infers the allowlist from canonical keys without changing the source map', () => {
    const resolved = resolveMultiPlatformConfig({ projectConfigs })

    expect(resolved.targets).toEqual(['xhs', 'weapp'])
    expect(supportsMultiPlatformTarget(resolved, 'xhs')).toBe(true)
    expect(supportsMultiPlatformTarget(resolved, 'alipay')).toBe(false)
    expect(projectConfigs.weapp).toEqual({ appid: 'wx-app' })
  })

  it('keeps explicit target restrictions and lets all include unconfigured platforms', () => {
    const restricted = resolveMultiPlatformConfig({ projectConfigs, targets: ['weapp'] })
    expect(restricted.targets).toEqual(['weapp'])
    expect(supportsMultiPlatformTarget(restricted, 'xhs')).toBe(false)
    expect(resolveMultiPlatformConfig({ projectConfigs, targets: 'all' }).targets).toEqual(getSupportedMiniProgramPlatforms())
  })

  it.each([null, {}, [], ['weapp'], 'weapp', false, 1, () => ({}), new Date(0)].map(value => ({ value })))('rejects an invalid map: $value', ({ value }) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs: value })).toThrow(TypeError)
  })

  it.each(['wechat', 'mp-weixin', 'WEAPP', ' weapp ', 'web', 'all', 'unknown'])('rejects noncanonical map key %s alongside a supported key', (platform) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs: { weapp: { appid: 'wx-app' }, [platform]: {} } })).toThrow(/projectConfigs/)
  })

  it.each([null, undefined, [], 'app-id', 123, () => ({}), new Date(0)].map(entry => ({ entry })))('rejects an invalid native entry: $entry', ({ entry }) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs: { weapp: entry } })).toThrow(TypeError)
  })

  it.each(['miniprogramRoot', 'srcMiniprogramRoot', 'smartProgramRoot'])('rejects bundler-owned root field %s', (field) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs: { weapp: { [field]: 'custom' } } })).toThrow(/build.outDir/)
  })

  it.each(['appid', 'appId'])('rejects non-string %s values', (field) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs: { alipay: { [field]: 123 } } })).toThrow(TypeError)
  })

  it.each(['config', '', 'custom'])('rejects an explicit file root alongside a map: %s', (projectConfigRoot) => {
    expect(() => resolveMultiPlatformConfig({ projectConfigs, projectConfigRoot })).toThrow(/projectConfigRoot/)
  })

  it('rejects disabled multi-platform mode with inline configs instead of falling back to files', () => {
    expect(() => resolveMultiPlatformConfig({ enabled: false, projectConfigs })).toThrow(/enabled: false/)
  })
})
