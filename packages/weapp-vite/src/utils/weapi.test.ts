import { describe, expect, it } from 'vitest'
import {
  createGlobalHostExpression,
  createNativeApiFallbackExpression,
  createWeapiAccessExpression,
  createWeapiHostExpression,
  getNativeApiFallbackChecks,
  getWeapiGlobalHostCandidates,
} from './weapi'

describe('weapi utils', () => {
  it('collects global host candidates in stable platform order', () => {
    expect(getWeapiGlobalHostCandidates()).toEqual([
      `((typeof globalThis !== 'undefined' && globalThis)`,
      ` || (typeof self !== 'undefined' && self)`,
      ` || (typeof window !== 'undefined' && window)`,
      ` || (typeof global !== 'undefined' && global)`,
      ` || (typeof my !== 'undefined' && my)`,
      ` || (typeof wx !== 'undefined' && wx)`,
      ` || (typeof tt !== 'undefined' && tt)`,
      ` || (typeof swan !== 'undefined' && swan)`,
      ` || (typeof jd !== 'undefined' && jd)`,
      ` || (typeof xhs !== 'undefined' && xhs)`,
      ` || {})`,
    ])
  })

  it('creates host and native fallback expressions from platform globals', () => {
    expect(createGlobalHostExpression()).toContain(`typeof globalThis !== 'undefined'`)
    expect(createWeapiHostExpression()).toBe(createGlobalHostExpression())
    expect(getNativeApiFallbackChecks()).toEqual([
      `((typeof my !== 'undefined' && my)`,
      ` || (typeof wx !== 'undefined' && wx)`,
      ` || (typeof tt !== 'undefined' && tt)`,
      ` || (typeof swan !== 'undefined' && swan)`,
      ` || (typeof jd !== 'undefined' && jd)`,
      ` || (typeof xhs !== 'undefined' && xhs)`,
    ])

    const fallback = createNativeApiFallbackExpression()
    expect(fallback).toContain(`typeof my !== 'undefined' && my`)
    expect(fallback).toContain(`typeof wx !== 'undefined' && wx`)
    expect(fallback).toContain(`typeof xhs !== 'undefined' && xhs`)
    expect(fallback.endsWith(` || undefined)`)).toBe(true)
  })

  it('creates access expressions with the provided global key', () => {
    const expression = createWeapiAccessExpression('weapi')

    expect(expression).toContain(`["weapi"]`)
    expect(expression).toContain(`typeof globalThis !== 'undefined'`)
    expect(expression).toContain(`typeof wx !== 'undefined' && wx`)
  })
})
