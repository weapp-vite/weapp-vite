/**
 * @file 入口行为测试。
 */
import { describe, expect, it, vi } from 'vitest'
import * as api from './index'

describe('miniprogram-automator', () => {
  it('exports the public api through named exports', () => {
    expect(api.Automator).toBeTypeOf('function')
    expect(api.Element).toBeTypeOf('function')
    expect(api.Launcher).toBeTypeOf('function')
    expect(api.decodeQrCode).toBeTypeOf('function')
  })
  it('keeps plugin path helpers compatible', () => {
    expect(api.isPluginPath('plugin-private://abc/pages/index')).toBe(true)
    expect(api.extractPluginId('plugin-private://abc/pages/index')).toBe('abc')
    expect(api.extractPluginId('/pages/index/index')).toBe('')
  })
  it('supports the headless runtime provider switch', async () => {
    vi.resetModules()
    const launchHeadlessAutomator = vi.fn(async () => ({ provider: 'headless' }))
    vi.doMock('./headless', () => ({
      launchHeadlessAutomator,
    }))
    const { default: MockedLauncher } = await import('./Launcher')
    const launcher = new MockedLauncher()
    const result = await launcher.launch({
      runtimeProvider: 'headless',
      projectPath: '/tmp/project',
    })
    expect(result).toEqual({ provider: 'headless' })
    expect(launchHeadlessAutomator).toHaveBeenCalledWith({
      projectPath: '/tmp/project',
    })
    vi.doUnmock('./headless')
  })
  it('exposes the launcher class directly', async () => {
    const { default: Launcher } = await import('./Launcher')
    expect(Launcher).toBeTypeOf('function')
  })
})
