import { afterEach, describe, expect, it } from 'vitest'
import { detectGlobalAdapter } from './adapter'

const GLOBAL_ADAPTER_KEYS = ['wx', 'my', 'tt', 'qq', 'swan', 'ks', 'jd', 'xhs', 'dd', 'qa', 'qapp', 'uni'] as const

function clearGlobalAdapters() {
  for (const key of GLOBAL_ADAPTER_KEYS) {
    delete (globalThis as Record<string, unknown>)[key]
  }
}

describe('detectGlobalAdapter', () => {
  afterEach(() => {
    clearGlobalAdapters()
  })

  it('returns empty result when no adapter exists on global object', () => {
    expect(detectGlobalAdapter()).toEqual({})
  })

  it('detects adapter in priority order', () => {
    const wxAdapter = { request() {} }
    const myAdapter = { request() {} }
    ;(globalThis as any).my = myAdapter
    ;(globalThis as any).wx = wxAdapter

    expect(detectGlobalAdapter()).toEqual({
      adapter: wxAdapter,
      platform: 'wx',
    })
  })

  it('accepts function-like adapter values', () => {
    const ttAdapter = () => {}
    ;(globalThis as any).tt = ttAdapter

    expect(detectGlobalAdapter()).toEqual({
      adapter: ttAdapter,
      platform: 'tt',
    })
  })

  it('detects shared mini program globals that are not wechat-like', () => {
    const swanAdapter = { request() {} }
    ;(globalThis as any).swan = swanAdapter

    expect(detectGlobalAdapter()).toEqual({
      adapter: swanAdapter,
      platform: 'swan',
    })
  })

  it('skips non-object adapter candidates', () => {
    ;(globalThis as any).wx = 1
    ;(globalThis as any).my = 'invalid'
    ;(globalThis as any).qq = false

    expect(detectGlobalAdapter()).toEqual({})
  })
})
