import { describe, expect, it } from 'vitest'
import { formatHmrRuntimeStartupMessages, resolveHmrRuntime } from './hmrRuntime'

describe('resolveHmrRuntime', () => {
  it('uses stateful runtime when WeChat hot reload is enabled', () => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'auto', compileHotReLoad: true })).toBe('stateful-experimental')
  })

  it.each([false, undefined, 'true', 1])('uses classic when hot reload is not confirmed (%s)', (compileHotReLoad) => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'auto', compileHotReLoad })).toBe('classic')
  })

  it('uses classic for auto on non-WeChat platforms', () => {
    expect(resolveHmrRuntime({ platform: 'alipay', configured: 'auto', compileHotReLoad: true })).toBe('classic')
  })

  it('keeps explicit runtime settings authoritative', () => {
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'classic', compileHotReLoad: true })).toBe('classic')
    expect(resolveHmrRuntime({ platform: 'weapp', configured: 'stateful-experimental', compileHotReLoad: false })).toBe('stateful-experimental')
  })

  it('explains the auto stateful selection and how to switch to classic', () => {
    expect(formatHmrRuntimeStartupMessages({
      platform: 'weapp',
      configured: 'auto',
      compileHotReLoad: true,
      runtime: 'stateful-experimental',
    })).toEqual([
      'HMR 模式：stateful-experimental（自动检测：微信开发者工具热重载已开启）',
      'HMR 切换：关闭微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
    ])
  })

  it('explains the auto classic selection and how to switch to stateful HMR', () => {
    expect(formatHmrRuntimeStartupMessages({
      platform: 'weapp',
      configured: undefined,
      compileHotReLoad: false,
      runtime: 'classic',
    })).toEqual([
      'HMR 模式：classic（自动检测：微信开发者工具热重载未开启或无法确认）',
      'HMR 切换：开启微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
    ])
  })

  it('explains explicit and non-WeChat runtime selections', () => {
    expect(formatHmrRuntimeStartupMessages({
      platform: 'weapp',
      configured: 'classic',
      compileHotReLoad: true,
      runtime: 'classic',
    })[1]).toContain('auto 或 stateful-experimental')
    expect(formatHmrRuntimeStartupMessages({
      platform: 'alipay',
      configured: 'auto',
      compileHotReLoad: true,
      runtime: 'classic',
    })).toEqual([
      'HMR 模式：classic（自动检测：仅微信小程序支持 stateful-experimental）',
      'HMR 切换：可通过 weapp.hmr.runtime 显式配置 classic。',
    ])
  })
})
