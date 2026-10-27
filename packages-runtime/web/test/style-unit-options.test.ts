import { describe, expect, it } from 'vitest'
import { resolveStyleUnitOptions } from '../src/shared/styleUnits/options'

describe('style unit configuration', () => {
  it('uses runtime variables by default', () => {
    expect(resolveStyleUnitOptions()).toEqual({
      useVariable: true,
      rpxVar: '--rpx',
      ratio: 0.5,
      designWidth: 750,
    })
  })

  it('keeps an explicit static ratio without a finite design width', () => {
    for (const designWidth of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveStyleUnitOptions({ pxPerRpx: 0.25, designWidth, rpxVar: '--custom-rpx' }))
        .toMatchObject({ useVariable: false, ratio: 0.25, rpxVar: '--custom-rpx' })
    }
  })

  it('gives a finite design width priority over an explicit static ratio', () => {
    expect(resolveStyleUnitOptions({ pxPerRpx: 0.25, designWidth: 375, rpxVar: '--custom-rpx' }))
      .toEqual({ useVariable: true, ratio: 0.25, designWidth: 375, rpxVar: '--custom-rpx' })
  })

  it('keeps zero static ratios and the original input unchanged', () => {
    const input = Object.freeze({ pxPerRpx: 0 })
    expect(resolveStyleUnitOptions(input)).toEqual({
      useVariable: false,
      rpxVar: '--rpx',
      ratio: 0,
      designWidth: 750,
    })
  })
})
