import {
  WEAPP_VITE_WEB_ANALYTICS_EVENTS_KEY,
  WEAPP_VITE_WEB_EXT_CONFIG_KEY,
  WEAPP_VITE_WEB_UPDATE_MANAGER_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLogManagerBridge,
  createUpdateManagerBridge,
  readExtConfigValue,
  readRuntimeConsole,
  reportAnalyticsEvent,
  resolveSubPackageName,
  resolveUpdateManagerPreset,
} from '../src/runtime/polyfill/platformRuntime'
import {
  buildMenuButtonRect,
  buildWindowInfoSnapshot,
  normalizeMemorySize,
  normalizePositiveNumber,
  readDeviceMemorySize,
  readSystemInfoSnapshot,
  resolveAccountAppId,
  resolveDeviceOrientation,
  resolvePlatformName,
  resolveRuntimeTheme,
  resolveSystemName,
  rpx2px,
} from '../src/runtime/polyfill/system'

describe('web platform runtime contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>)[WEAPP_VITE_WEB_ANALYTICS_EVENTS_KEY]
  })

  it('normalizes subpackage names and update manager preset shapes', () => {
    expect(resolveSubPackageName()).toBe('')
    expect(resolveSubPackageName({ name: 1, root: ' package-a ' })).toBe('package-a')
    expect(resolveSubPackageName({ name: ' named ', root: 'ignored' })).toBe('named')

    for (const [preset, expected] of [
      [true, { hasUpdate: true, ready: true, failed: false }],
      [false, { hasUpdate: false, ready: false, failed: false }],
      ['', { hasUpdate: false, ready: false, failed: false }],
      ['none', { hasUpdate: false, ready: false, failed: false }],
      ['false', { hasUpdate: false, ready: false, failed: false }],
      ['fail', { hasUpdate: true, ready: false, failed: true }],
      ['failed', { hasUpdate: true, ready: false, failed: true }],
      ['error', { hasUpdate: true, ready: false, failed: true }],
      ['ready', { hasUpdate: true, ready: true, failed: false }],
      [{ updateReady: true }, { hasUpdate: true, ready: true, failed: false }],
      [{ fail: true }, { hasUpdate: true, ready: false, failed: true }],
      [{ hasUpdate: false, ready: true, failed: true }, { hasUpdate: false, ready: false, failed: false }],
      [null, { hasUpdate: false, ready: false, failed: false }],
    ] as const) {
      vi.stubGlobal(WEAPP_VITE_WEB_UPDATE_MANAGER_KEY, preset)
      expect(resolveUpdateManagerPreset()).toEqual(expected)
    }
    vi.stubGlobal(WEAPP_VITE_WEB_UPDATE_MANAGER_KEY, () => ({ hasUpdate: true, ready: true }))
    expect(resolveUpdateManagerPreset()).toEqual({ hasUpdate: true, ready: true, failed: false })
  })

  it('schedules update manager callbacks only for matching states', () => {
    const scheduled: Array<() => void> = []
    let preset = { hasUpdate: true, ready: true, failed: false }
    const manager = createUpdateManagerBridge(() => preset, callback => scheduled.push(callback))
    const check = vi.fn()
    const ready = vi.fn()
    const failed = vi.fn()
    manager.applyUpdate()
    manager.onCheckForUpdate(undefined)
    manager.onUpdateReady(undefined)
    manager.onUpdateFailed(undefined)
    manager.onCheckForUpdate(check)
    manager.onUpdateReady(ready)
    manager.onUpdateFailed(failed)
    scheduled.splice(0).forEach(callback => callback())
    expect(check).toHaveBeenCalledWith({ hasUpdate: true })
    expect(ready).toHaveBeenCalledOnce()
    expect(failed).not.toHaveBeenCalled()

    preset = { hasUpdate: true, ready: false, failed: true }
    manager.onUpdateReady(ready)
    manager.onUpdateFailed(failed)
    scheduled.splice(0).forEach(callback => callback())
    expect(failed).toHaveBeenCalledOnce()

    preset = { hasUpdate: false, ready: false, failed: false }
    manager.onUpdateReady(ready)
    manager.onUpdateFailed(failed)
    expect(scheduled).toEqual([])
  })

  it('bridges runtime console, ext config, log levels and analytics', () => {
    expect(readRuntimeConsole()).toBe(console)
    vi.stubGlobal(WEAPP_VITE_WEB_EXT_CONFIG_KEY, { env: 'test' })
    const config = readExtConfigValue()
    expect(config).toEqual({ env: 'test' })
    expect(config).not.toBe((globalThis as any)[WEAPP_VITE_WEB_EXT_CONFIG_KEY])
    vi.stubGlobal(WEAPP_VITE_WEB_EXT_CONFIG_KEY, 'invalid')
    expect(readExtConfigValue()).toEqual({})

    const runtimeConsole = {
      debug: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    }
    const verbose = createLogManagerBridge(0, runtimeConsole)
    verbose.debug('debug')
    verbose.info('info')
    verbose.log('log')
    verbose.warn('warn')
    expect(runtimeConsole.debug).toHaveBeenCalledWith('debug')
    expect(runtimeConsole.info).toHaveBeenCalledWith('info')
    expect(runtimeConsole.log).toHaveBeenCalledWith('log')
    expect(runtimeConsole.warn).toHaveBeenCalledWith('warn')

    const quiet = createLogManagerBridge(1, {})
    expect(quiet.debug('ignored')).toBeUndefined()
    quiet.info('ignored')

    vi.spyOn(Date, 'now').mockReturnValue(123)
    reportAnalyticsEvent('open', { source: 'test' })
    reportAnalyticsEvent(null as unknown as string)
    expect((globalThis as any)[WEAPP_VITE_WEB_ANALYTICS_EVENTS_KEY]).toEqual([
      { eventName: 'open', data: { source: 'test' }, timestamp: 123 },
      { eventName: '', data: {}, timestamp: 123 },
    ])
  })
})

describe('web system snapshot contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes operating system and platform names', () => {
    expect(resolveSystemName('Android')).toBe('Android')
    expect(resolveSystemName('iPhone')).toBe('iOS')
    expect(resolveSystemName('Windows NT')).toBe('Windows')
    expect(resolveSystemName('Mac OS X')).toBe('macOS')
    expect(resolveSystemName('Linux')).toBe('Linux')
    expect(resolveSystemName('Other')).toBe('Unknown')

    expect(resolvePlatformName('', { userAgentData: { platform: 'Android' } } as any)).toBe('android')
    expect(resolvePlatformName('', { platform: 'iPad' } as Navigator)).toBe('ios')
    expect(resolvePlatformName('', { platform: 'Win32' } as Navigator)).toBe('windows')
    expect(resolvePlatformName('', { platform: 'MacIntel' } as Navigator)).toBe('mac')
    expect(resolvePlatformName('', { platform: 'Linux x86_64' } as Navigator)).toBe('linux')
    expect(resolvePlatformName('', { platform: 'Custom' } as Navigator)).toBe('custom')
    expect(resolvePlatformName('', undefined)).toBe('unknown')
  })

  it('normalizes dimensions, orientation, memory and theme capabilities', () => {
    expect(normalizePositiveNumber(undefined, 5)).toBe(5)
    expect(normalizePositiveNumber(Number.NaN, 5)).toBe(5)
    expect(normalizePositiveNumber(0, 5)).toBe(5)
    expect(normalizePositiveNumber(2, 5)).toBe(2)
    expect(normalizeMemorySize(undefined)).toBe(0)
    expect(normalizeMemorySize(Number.NaN)).toBe(0)
    expect(normalizeMemorySize(-1)).toBe(0)
    expect(normalizeMemorySize(1.5)).toBe(1536)

    vi.stubGlobal('window', { innerWidth: 900, innerHeight: 600 })
    expect(resolveDeviceOrientation()).toBe('landscape')
    vi.stubGlobal('window', { innerWidth: 600, innerHeight: 900 })
    expect(resolveDeviceOrientation()).toBe('portrait')
    vi.stubGlobal('window', undefined)
    expect(resolveDeviceOrientation()).toBe('portrait')
    expect(resolveRuntimeTheme()).toBe('light')
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(resolveRuntimeTheme()).toBe('dark')
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(resolveRuntimeTheme()).toBe('light')
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('blocked')
      },
    })
    expect(resolveRuntimeTheme()).toBe('light')
  })

  it('builds system, window, account and menu snapshots with browser fallbacks', () => {
    vi.stubGlobal('window', { innerWidth: 375, innerHeight: 667, devicePixelRatio: 2 })
    vi.stubGlobal('screen', { width: 390, height: 844 })
    vi.stubGlobal('navigator', {
      appVersion: '1.0',
      deviceMemory: 4,
      language: 'zh-CN',
      platform: 'MacIntel',
      userAgent: 'Mac OS X',
    })
    vi.stubGlobal('location', { hostname: 'example.test' })
    const snapshot = readSystemInfoSnapshot()
    expect(snapshot).toMatchObject({
      language: 'zh-CN',
      model: 'MacIntel',
      pixelRatio: 2,
      platform: 'mac',
      screenHeight: 844,
      screenWidth: 390,
      system: 'macOS',
      windowHeight: 667,
      windowWidth: 375,
    })
    expect(readDeviceMemorySize()).toBe(4096)
    expect(resolveAccountAppId()).toBe('web:example.test')
    expect(rpx2px(750)).toBe(375)
    expect(buildWindowInfoSnapshot(snapshot).safeArea).toMatchObject({ width: 375, height: 667 })
    expect(buildMenuButtonRect(375, 20)).toEqual({
      width: 88,
      height: 32,
      top: 26,
      right: 367,
      bottom: 58,
      left: 279,
    })

    vi.stubGlobal('window', { innerWidth: 0, innerHeight: 0, devicePixelRatio: 0 })
    vi.stubGlobal('screen', { width: 0, height: 0 })
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('location', undefined)
    expect(readSystemInfoSnapshot()).toMatchObject({ model: 'web', language: 'en', platform: 'unknown' })
    expect(readDeviceMemorySize()).toBe(0)
    expect(resolveAccountAppId()).toBe('web')
    expect(rpx2px(Number.NaN)).toBe(0)
    expect(rpx2px(10)).toBe(0)
    expect(buildMenuButtonRect(40, -20)).toMatchObject({ right: 88, left: 0, top: 0 })
  })
})
