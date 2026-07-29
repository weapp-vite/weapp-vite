import { describe, expect, it } from 'vitest'
import {
  cloneLaunchOptions,
  resolveCurrentPages,
  resolveFallbackLaunchOptions,
} from '../src/runtime/polyfill/appState'
import { checkRuntimeCapability } from '../src/runtime/polyfill/capability'

describe('app state and runtime capability contracts', () => {
  it('filters current instances and clones launch options without shared bags', () => {
    const first = { page: 'first' }
    expect(resolveCurrentPages([
      { instance: first },
      {},
      { instance: null },
      { instance: { page: 'second' } },
    ])).toEqual([first, { page: 'second' }])

    const source = {
      path: 'pages/home/index',
      query: { id: '1' },
      referrerInfo: { appId: 'source' },
      scene: 1001,
    }
    const cloned = cloneLaunchOptions(source)
    expect(cloned).toEqual(source)
    expect(cloned.query).not.toBe(source.query)
    expect(cloned.referrerInfo).not.toBe(source.referrerInfo)
  })

  it('resolves empty and latest-entry fallback launch options', () => {
    expect(resolveFallbackLaunchOptions([])).toEqual({
      path: '',
      query: {},
      referrerInfo: {},
      scene: 0,
    })
    expect(resolveFallbackLaunchOptions([
      { id: 'pages/first', query: {} },
      { id: 'pages/latest', query: { source: 'history' } },
    ])).toEqual({
      path: 'pages/latest',
      query: { source: 'history' },
      referrerInfo: {},
      scene: 0,
    })
  })

  it('parses prefixed, dotted and bracketed capability schemas', () => {
    const bridge = {
      cloud: { callFunction() {} },
      nested: { value: {} },
      scalar: 1,
    }
    expect(checkRuntimeCapability(bridge, 'wx.cloud.callFunction')).toBe(true)
    expect(checkRuntimeCapability(bridge, 'my.nested[value]')).toBe(true)
    expect(checkRuntimeCapability(bridge, 'tt.scalar')).toBe(false)
    expect(checkRuntimeCapability(bridge, 'missing.child')).toBe(false)
    expect(checkRuntimeCapability({ nested: null }, 'nested.child')).toBe(false)
    expect(checkRuntimeCapability(undefined, 'cloud')).toBe(false)
    expect(checkRuntimeCapability(bridge, '')).toBe(false)
    expect(checkRuntimeCapability(bridge, null as any)).toBe(false)
    expect(checkRuntimeCapability(bridge, '[]')).toBe(false)
  })
})
