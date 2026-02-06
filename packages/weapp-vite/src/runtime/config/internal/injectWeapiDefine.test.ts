import { describe, expect, it } from 'vitest'
import { createInjectWeapiDefine } from './injectWeapiDefine'

describe('createInjectWeapiDefine', () => {
  it('returns empty define when injectWeapi is disabled', () => {
    expect(createInjectWeapiDefine(false)).toEqual({})
    expect(createInjectWeapiDefine(undefined)).toEqual({})
  })

  it('does not replace wx/my when replaceWx is omitted', () => {
    expect(createInjectWeapiDefine(true)).toEqual({})
    expect(createInjectWeapiDefine({ enabled: true })).toEqual({})
  })

  it('creates platform api defines when replaceWx is true', () => {
    const define = createInjectWeapiDefine({ enabled: true, replaceWx: true })
    expect(define.wx).toContain('typeof globalThis')
    expect(define.wx).toContain('["wpi"]')
    expect(define.wx).toContain('typeof my')
    expect(define.my).toBe(define.wx)
    expect(define.tt).toBe(define.wx)
    expect(define.swan).toBe(define.wx)
    expect(define.jd).toBe(define.wx)
    expect(define.xhs).toBe(define.wx)
  })

  it('supports custom global name', () => {
    const define = createInjectWeapiDefine({ enabled: true, replaceWx: true, globalName: 'weapi' })
    expect(define.wx).toContain('["weapi"]')
    expect(define.my).toBe(define.wx)
  })
})
