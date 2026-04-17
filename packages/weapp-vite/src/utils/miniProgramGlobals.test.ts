import { describe, expect, it } from 'vitest'
import {
  createMiniProgramGlobalResolveExpression,
  createMiniProgramGlobalValueMap,
  createMiniProgramHostOrTopLevelResolveExpression,
  createMiniProgramTopLevelAccessChecks,
  createMiniProgramTopLevelResolveExpression,
  getMiniProgramGlobalKeys,
  getMiniProgramPlatformGlobalKey,
  getRouteRuntimeGlobalKeys,
  resolveMiniProgramGlobalHostExpression,
} from './miniProgramGlobals'

describe('miniProgramGlobals utils', () => {
  it('exposes shared mini-program global keys and platform mappings', () => {
    expect(getMiniProgramGlobalKeys()).toEqual(['my', 'wx', 'tt', 'swan', 'jd', 'xhs'])
    expect(createMiniProgramGlobalValueMap('demo')).toEqual({
      my: 'demo',
      wx: 'demo',
      tt: 'demo',
      swan: 'demo',
      jd: 'demo',
      xhs: 'demo',
    })
    expect(getRouteRuntimeGlobalKeys()).toEqual(['wx', 'tt', 'my', 'swan', 'jd', 'xhs'])
    expect(getMiniProgramPlatformGlobalKey()).toBeUndefined()
    expect(getMiniProgramPlatformGlobalKey('weapp')).toBe('wx')
    expect(getMiniProgramPlatformGlobalKey('alipay')).toBe('my')
    expect(getMiniProgramPlatformGlobalKey('xhs')).toBe('xhs')
    expect(getMiniProgramPlatformGlobalKey('custom')).toBe('custom')
  })

  it('creates mini-program global resolve expressions', () => {
    expect(resolveMiniProgramGlobalHostExpression()).toBe('globalThis')
    expect(resolveMiniProgramGlobalHostExpression('__host')).toBe('__host')
    expect(createMiniProgramGlobalResolveExpression()).toBe('(globalThis.my ?? globalThis.wx ?? globalThis.tt ?? globalThis.swan ?? globalThis.jd ?? globalThis.xhs)')
    expect(createMiniProgramGlobalResolveExpression({
      globalKeys: ['wx', 'tt', 'my'],
      hostExpression: '__host',
    })).toBe('(__host.wx ?? __host.tt ?? __host.my)')
  })

  it('creates top-level global guard expressions for host fallbacks', () => {
    expect(createMiniProgramTopLevelAccessChecks()).toEqual([
      `((typeof my !== 'undefined' && my)`,
      ` || (typeof wx !== 'undefined' && wx)`,
      ` || (typeof tt !== 'undefined' && tt)`,
      ` || (typeof swan !== 'undefined' && swan)`,
      ` || (typeof jd !== 'undefined' && jd)`,
      ` || (typeof xhs !== 'undefined' && xhs)`,
    ])
    expect(createMiniProgramTopLevelResolveExpression()).toBe(`((typeof my !== 'undefined' && my) || (typeof wx !== 'undefined' && wx) || (typeof tt !== 'undefined' && tt) || (typeof swan !== 'undefined' && swan) || (typeof jd !== 'undefined' && jd) || (typeof xhs !== 'undefined' && xhs) || undefined)`)
    expect(createMiniProgramTopLevelResolveExpression({
      globalKeys: ['wx', 'tt'],
      fallbackExpression: 'null',
    })).toBe(`((typeof wx !== 'undefined' && wx) || (typeof tt !== 'undefined' && tt) || null)`)
    expect(createMiniProgramHostOrTopLevelResolveExpression({
      globalKeys: ['wx', 'tt'],
      hostExpression: '__host',
      fallbackExpression: 'null',
    })).toBe(`((__host.wx ?? __host.tt) ?? ((typeof wx !== 'undefined' && wx) || (typeof tt !== 'undefined' && tt) || null))`)
  })
})
