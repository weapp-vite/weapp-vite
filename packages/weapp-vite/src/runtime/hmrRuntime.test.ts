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
      'HMR 模式：stateful-experimental（auto：微信开发者工具热重载已开启）',
      '切换模式：在微信开发者工具中关闭“热重载”并重启 wv dev，可切换为 classic；也可通过 weapp.hmr.runtime 显式锁定模式。',
    ])
  })

  it('explains the auto classic selection and how to switch to stateful HMR', () => {
    expect(formatHmrRuntimeStartupMessages({
      platform: 'weapp',
      configured: undefined,
      compileHotReLoad: false,
      runtime: 'classic',
    })).toEqual([
      'HMR 模式：classic（auto：微信开发者工具热重载未开启或无法确认）',
      '切换模式：在微信开发者工具中开启“热重载”并重启 wv dev，可切换为 stateful-experimental；也可通过 weapp.hmr.runtime 显式锁定模式。',
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
      'HMR 模式：classic（auto：stateful-experimental 仅支持微信小程序）',
      '切换模式：可通过 weapp.hmr.runtime 显式锁定 classic；stateful-experimental 仅支持微信小程序。',
    ])
  })
})
