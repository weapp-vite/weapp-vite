import { describe, expect, it } from 'vitest'
import { resolveHmrRuntime } from './hmrRuntime'

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
})
