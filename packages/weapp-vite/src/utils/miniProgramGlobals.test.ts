import { describe, expect, it } from 'vitest'
import {
  createMiniProgramGlobalResolveExpression,
  getMiniProgramGlobalKeys,
  getMiniProgramPlatformGlobalKey,
  getRouteRuntimeGlobalKeys,
} from './miniProgramGlobals'

describe('miniProgramGlobals utils', () => {
  it('exposes shared mini-program global keys and platform mappings', () => {
    expect(getMiniProgramGlobalKeys()).toEqual(['my', 'wx', 'tt', 'swan', 'jd', 'xhs'])
    expect(getRouteRuntimeGlobalKeys()).toEqual(['wx', 'tt', 'my', 'swan', 'jd', 'xhs'])
    expect(getMiniProgramPlatformGlobalKey()).toBeUndefined()
    expect(getMiniProgramPlatformGlobalKey('weapp')).toBe('wx')
    expect(getMiniProgramPlatformGlobalKey('alipay')).toBe('my')
    expect(getMiniProgramPlatformGlobalKey('xhs')).toBe('xhs')
    expect(getMiniProgramPlatformGlobalKey('custom')).toBe('custom')
  })

  it('creates mini-program global resolve expressions', () => {
    expect(createMiniProgramGlobalResolveExpression()).toBe('(globalThis.my ?? globalThis.wx ?? globalThis.tt ?? globalThis.swan ?? globalThis.jd ?? globalThis.xhs)')
    expect(createMiniProgramGlobalResolveExpression({
      globalKeys: ['wx', 'tt', 'my'],
      hostExpression: '__host',
    })).toBe('(__host.wx ?? __host.tt ?? __host.my)')
  })
})
