import {
  getDefaultMiniProgramRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKeys,
} from '@weapp-core/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

const runtimeKeys = getMiniProgramRuntimeGlobalKeys()
const trackedKeys = [...runtimeKeys, 'getApp', 'getCurrentPages']
const originalDescriptors = new Map(
  trackedKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
)

describe('polyfill entry installation contract', () => {
  afterEach(() => {
    for (const key of trackedKeys) {
      const descriptor = originalDescriptors.get(key)
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      }
      else {
        Reflect.deleteProperty(globalThis, key)
      }
    }
    vi.resetModules()
  })

  it('preserves existing host globals and exposes facade operations', async () => {
    const defaultKey = getDefaultMiniProgramRuntimeGlobalKey()
    const getApp = vi.fn(() => ({ id: 'existing-app' }))
    const getCurrentPages = vi.fn(() => [])
    const bridge = {
      env: { USER_DATA_PATH: '/existing/user-data' },
      existing: true,
    }
    Object.assign(globalThis, {
      [defaultKey]: bridge,
      getApp,
      getCurrentPages,
    })

    const api = await import('../src/runtime/polyfill')

    for (const key of runtimeKeys) {
      expect((globalThis as Record<string, unknown>)[key]).toBe(bridge)
    }
    expect(bridge.env.USER_DATA_PATH).toBe('/existing/user-data')
    expect(globalThis.getApp).toBe(getApp)
    expect(globalThis.getCurrentPages).toBe(getCurrentPages)

    await expect(api.setNavigationBarTitle({ title: 'Title' })).resolves.toBeUndefined()
    await expect(api.setNavigationBarColor({ backgroundColor: '#fff' })).resolves.toBeUndefined()
    await expect(api.showNavigationBarLoading()).resolves.toBeUndefined()
    await expect(api.hideNavigationBarLoading()).resolves.toBeUndefined()
    await expect(api.setBackgroundColor()).resolves.toMatchObject({ errMsg: 'setBackgroundColor:ok' })
    await expect(api.setBackgroundTextStyle()).resolves.toMatchObject({ errMsg: 'setBackgroundTextStyle:ok' })
  })

  it('resolves capabilities across runtime aliases and missing bridges', async () => {
    const api = await import('../src/runtime/polyfill')
    for (const key of runtimeKeys) {
      Reflect.deleteProperty(globalThis, key)
    }
    Object.assign(globalThis, {
      [runtimeKeys[0]!]: 'invalid',
      [runtimeKeys[1]!]: { feature: vi.fn() },
    })
    expect(api.canIUse('feature')).toBe(true)

    for (const key of runtimeKeys) {
      Reflect.deleteProperty(globalThis, key)
    }
    expect(api.canIUse('missing')).toBe(false)
  })
})
