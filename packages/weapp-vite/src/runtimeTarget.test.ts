import { describe, expect, it, vi } from 'vitest'
import { platformBackendRegistry } from './backends'
import {
  getSupportedWeappVitePlatforms,
  isWebPlatform,
  resolveWeappViteTarget,
} from './runtimeTarget'

describe('runtime target', () => {
  it('resolves config, mini-program, web and all runtime targets', () => {
    expect(resolveWeappViteTarget()).toMatchObject({
      kind: 'miniprogram',
      runMini: true,
      runWeb: false,
      label: 'config',
    })
    expect(resolveWeappViteTarget('wechat')).toMatchObject({
      kind: 'miniprogram',
      runMini: true,
      runWeb: false,
      platform: 'weapp',
      label: 'weapp',
    })
    expect(resolveWeappViteTarget('h5')).toMatchObject({
      kind: 'web',
      runMini: false,
      runWeb: true,
      platform: 'web',
      label: 'web',
    })
    expect(resolveWeappViteTarget('all')).toMatchObject({
      kind: 'all',
      runMini: true,
      runWeb: true,
      label: 'weapp + web',
    })
    expect(resolveWeappViteTarget('both')).toMatchObject({
      kind: 'all',
      runMini: true,
      runWeb: true,
      label: 'weapp + web',
    })
  })

  it('reports web aliases and supported target platforms', () => {
    expect(isWebPlatform()).toBe(false)
    expect(isWebPlatform('web')).toBe(true)
    expect(isWebPlatform('h5')).toBe(true)
    expect(isWebPlatform('weapp')).toBe(false)
    expect(getSupportedWeappVitePlatforms()).toContain('weapp')
    expect(getSupportedWeappVitePlatforms()).toContain('web')
  })

  it('falls back to default mini-program target for unknown input', () => {
    const warn = vi.fn()

    expect(resolveWeappViteTarget('unknown', { warn })).toMatchObject({
      kind: 'miniprogram',
      runMini: true,
      runWeb: false,
      platform: 'weapp',
      label: 'weapp',
    })
    expect(warn).toHaveBeenCalledWith('未识别的平台 "unknown"，已回退到 weapp')
  })

  it('describes registries with either runtime backend omitted', () => {
    const getExecutionOrder = vi.spyOn(platformBackendRegistry, 'getExecutionOrder')
    const original = [...platformBackendRegistry.getExecutionOrder()]
    const mini = original.find(backend => backend.descriptor.runtime === 'miniprogram')!
    const web = original.find(backend => backend.descriptor.runtime === 'web')!

    getExecutionOrder.mockReturnValueOnce([mini])
    expect(getSupportedWeappVitePlatforms()).not.toContain('web')

    getExecutionOrder.mockReturnValueOnce([web])
    expect(getSupportedWeappVitePlatforms()).toContain('web')
    expect(getSupportedWeappVitePlatforms()).toContain('weapp')
    getExecutionOrder.mockRestore()
  })
})
