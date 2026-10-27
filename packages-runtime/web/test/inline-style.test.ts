import { nothing } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureInlineStyleUnits, transformInlineStyle, transformInlineStyleValue } from '../src/runtime/inlineStyle'
import { createTemplate } from '../src/runtime/template'
import { resolveStyleUnitOptions } from '../src/shared/styleUnits/options'

afterEach(() => configureInlineStyleUnits())

describe('inline style units', () => {
  it('uses the configured rpx variable and device viewport variables', () => {
    configureInlineStyleUnits(resolveStyleUnitOptions({ rpxVar: '--custom-rpx', designWidth: 375 }))
    expect(transformInlineStyle('height:calc(100vh - 200rpx);width:50vw')).toBe(
      'height:calc(var(--weapp-viewport-height) - calc(var(--custom-rpx) * 200));width:calc(var(--weapp-viewport-width) * 50 / 100)',
    )
  })

  it('uses the explicit static ratio without inferring it from the current viewport', () => {
    const options = resolveStyleUnitOptions({ pxPerRpx: 0.25 })
    configureInlineStyleUnits(options)
    options.ratio = 1
    expect(transformInlineStyle('height:200rpx;width:50vw')).toBe('height:50px;width:50vw')
    configureInlineStyleUnits(resolveStyleUnitOptions({ pxPerRpx: 0.25, designWidth: 375 }))
    expect(transformInlineStyle('height:200rpx')).toBe('height:calc(var(--rpx) * 200)')
  })

  it('keeps generated viewport expressions stable across repeated conversion', () => {
    const once = transformInlineStyle('width:50vw;height:calc(100vh - .5rpx);top:10vmin;left:10vmax')
    expect(transformInlineStyle(once)).toBe(once)
    const fallback = 'width:var(--weapp-viewport-width, 100vw);height:var(--weapp-viewport-height, 100dvh)'
    expect(transformInlineStyle(fallback)).toBe(fallback)
  })

  it('preserves protected literals while converting actual safe area fallback units', () => {
    const protectedValue = 'content:"env(safe-area-inset-top) 10rpx";background:url("a-10rpx.png?env(safe-area-inset-bottom)")'
    expect(transformInlineStyle(protectedValue)).toBe(protectedValue)
    expect(transformInlineStyle('padding:env(safe-area-inset-bottom, 10rpx)')).toBe(
      'padding:var(--weapp-safe-area-inset-bottom, calc(var(--rpx) * 10))',
    )
  })

  it('reuses template style normalization for objects, arrays and fallback declarations', () => {
    expect(transformInlineStyleValue([
      'width:10rpx',
      { 'height': '20rpx', 'marginTop': '-.5rpx', '--customHeight': '3rpx' },
      [{ display: ['block', 'flex'] }, null],
    ])).toBe('width:calc(var(--rpx) * 10);height:calc(var(--rpx) * 20);margin-top:calc(var(--rpx) * -0.5);--customHeight:calc(var(--rpx) * 3);display:block;display:flex')
  })

  it('preserves non-style values for the calling renderer to interpret', () => {
    for (const value of [null, undefined, false, 12, nothing]) {
      expect(transformInlineStyleValue(value)).toBe(value)
    }
    expect(transformInlineStyleValue('')).toBe('')
    expect(transformInlineStyleValue([null, undefined])).toBe('')
  })

  it('evaluates a legacy style expression only once per render', () => {
    const readStyle = vi.fn(() => ({ width: '10rpx' }))
    const template = createTemplate('<view style="{{readStyle()}}"/>')
    expect(template({ readStyle })).toContain('style="width:calc(var(--rpx) * 10)"')
    expect(readStyle).toHaveBeenCalledOnce()
  })
})
