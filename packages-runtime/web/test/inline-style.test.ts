import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetInlineStyleUnitCache,
  transformInlineStyle,
  transformInlineStyleValue,
} from '../src/runtime/inlineStyle'

describe('transformInlineStyle', () => {
  it('converts rpx to the runtime variable', () => {
    expect(transformInlineStyle('height:200rpx')).toBe('height:calc(var(--rpx) * 200)')
    expect(transformInlineStyle('padding: 10rpx 20rpx')).toBe(
      'padding: calc(var(--rpx) * 10) calc(var(--rpx) * 20)',
    )
  })

  it('supports negative and decimal rpx values', () => {
    expect(transformInlineStyle('margin-top:-10rpx')).toBe('margin-top:calc(var(--rpx) * -10)')
    expect(transformInlineStyle('top:.5rpx')).toBe('top:calc(var(--rpx) * 0.5)')
  })

  it('converts viewport units to device viewport variables', () => {
    expect(transformInlineStyle('height:100vh')).toBe('height:var(--weapp-viewport-height, 100dvh)')
    expect(transformInlineStyle('width:50vw')).toBe(
      'width:calc(var(--weapp-viewport-width, 100vw) * 50 / 100)',
    )
    expect(transformInlineStyle('height:calc(100vh - 455rpx)')).toBe(
      'height:calc(var(--weapp-viewport-height, 100dvh) - calc(var(--rpx) * 455))',
    )
  })

  it('converts vmin and vmax', () => {
    expect(transformInlineStyle('font-size:10vmin')).toContain('min(var(--weapp-viewport-width')
    expect(transformInlineStyle('font-size:10vmax')).toContain('max(var(--weapp-viewport-width')
  })

  it('maps safe-area env() to runtime variables', () => {
    expect(transformInlineStyle('padding-bottom:env(safe-area-inset-bottom)')).toBe(
      'padding-bottom:var(--weapp-safe-area-inset-bottom)',
    )
    expect(transformInlineStyle('padding-top:env(safe-area-inset-top, 20px)')).toBe(
      'padding-top:var(--weapp-safe-area-inset-top)',
    )
  })

  it('normalizes zero values without a unit', () => {
    expect(transformInlineStyle('width:0rpx')).toBe('width:0px')
    expect(transformInlineStyle('height:0vh')).toBe('height:0px')
  })

  it('leaves px, percentages and unitless values untouched', () => {
    const value = 'width:20px;height:50%;line-height:1.5;opacity:0.8'
    expect(transformInlineStyle(value)).toBe(value)
  })

  it('does not rewrite rpx inside url() or string literals', () => {
    expect(transformInlineStyle('background:url(a-10rpx.png)')).toBe('background:url(a-10rpx.png)')
  })

  it('is idempotent for already converted values', () => {
    const once = transformInlineStyle('height:calc(100vh - 455rpx)')
    expect(transformInlineStyle(once)).toBe(once)
  })

  it('returns empty values as-is', () => {
    expect(transformInlineStyle('')).toBe('')
  })
})

describe('transformInlineStyleValue', () => {
  it('accepts object styles and camelCase keys', () => {
    expect(transformInlineStyleValue({ height: '200rpx', marginTop: '10rpx' })).toBe(
      'height:calc(var(--rpx) * 200);margin-top:calc(var(--rpx) * 10)',
    )
  })

  it('merges array styles', () => {
    expect(transformInlineStyleValue(['width:10rpx', { height: '20rpx' }])).toBe(
      'width:calc(var(--rpx) * 10) height:calc(var(--rpx) * 20)',
    )
  })

  it('skips nullish and false entries', () => {
    expect(transformInlineStyleValue({ width: '10rpx', height: null, color: false })).toBe(
      'width:calc(var(--rpx) * 10)',
    )
  })

  it('passes through plain numbers and unknown types', () => {
    expect(transformInlineStyleValue(12)).toBe(12)
    expect(transformInlineStyleValue(undefined)).toBe(undefined)
  })
})

describe('static rpx mode', () => {
  const originalDocument = globalThis.document
  const originalWindow = globalThis.window

  beforeEach(() => {
    resetInlineStyleUnitCache()
    vi.stubGlobal('document', {
      documentElement: { clientWidth: 375 },
      querySelector: () => null,
    })
    vi.stubGlobal('window', { innerWidth: 375 })
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalDocument) {
      vi.stubGlobal('document', originalDocument)
    }
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow)
    }
    resetInlineStyleUnitCache()
  })

  it('falls back to px when the runtime rpx variable is absent', () => {
    expect(transformInlineStyle('height:200rpx')).toBe('height:100px')
  })
})

describe('runtime rpx mode', () => {
  beforeEach(() => {
    resetInlineStyleUnitCache()
    vi.stubGlobal('document', {
      documentElement: { clientWidth: 375 },
      querySelector: () => null,
    })
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '0.5px' }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetInlineStyleUnitCache()
  })

  it('keeps the calc() form when --rpx is injected', () => {
    expect(transformInlineStyle('height:200rpx')).toBe('height:calc(var(--rpx) * 200)')
  })
})
